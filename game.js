/* ============================================================
   GOD PULL — SURVIVE THE PULL
   Vanilla JS. No build step. No external audio/game assets.
   ============================================================ */
(() => {
"use strict";

/* ---- roundRect polyfill (Safari <16, older Android WebViews) ---- */
if (!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    if (typeof r === "number") r = {tl:r,tr:r,br:r,bl:r};
    this.beginPath();
    this.moveTo(x+r.tl, y);
    this.lineTo(x+w-r.tr, y);
    this.arcTo(x+w, y, x+w, y+r.tr, r.tr);
    this.lineTo(x+w, y+h-r.br);
    this.arcTo(x+w, y+h, x+w-r.br, y+h, r.br);
    this.lineTo(x+r.bl, y+h);
    this.arcTo(x, y+h, x, y+h-r.bl, r.bl);
    this.lineTo(x, y+r.tl);
    this.arcTo(x, y, x+r.tl, y, r.tl);
    this.closePath();
    return this;
  };
}

/* ---------------------------------------------------------
   ROSTER
--------------------------------------------------------- */
const ROSTER = [
  { id:"cheese",  name:"CHEDDAR",  img:"assets/cheese-guy.jpg" },
  { id:"pink",    name:"PUNCH",    img:"assets/pink-fighter.jpg" },
  { id:"betty",   name:"BETTY",    img:"assets/betty.jpg" },
];
let selectedCharacter = ROSTER[0];

/* ---------------------------------------------------------
   AUDIO ENGINE (Web Audio API — synthesized, no files)
--------------------------------------------------------- */
const Sound = (() => {
  let ctx = null;
  let muted = false;

  function ensureCtx(){
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type="sine", vol=0.18, delay=0, glideTo=null){
    if (muted) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, c.currentTime + delay + dur);
    gain.gain.setValueAtTime(0, c.currentTime + delay);
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + dur + 0.02);
  }

  function noiseBurst(dur=0.35, vol=0.35, delay=0){
    if (muted) return;
    const c = ensureCtx();
    const bufferSize = c.sampleRate * dur;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++){
      data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(c.currentTime + delay);
  }

  return {
    click:      () => tone(720, 0.06, "square", 0.10),
    green:      () => { tone(440,0.12,"triangle",0.16); tone(660,0.14,"triangle",0.14,0.09); },
    redAlarm:   () => { tone(180,0.4,"sawtooth",0.22); tone(140,0.5,"sawtooth",0.18,0.12); },
    tick:       () => tone(950, 0.045, "square", 0.08),
    eliminate:  () => { noiseBurst(0.5,0.4); tone(90,0.6,"sawtooth",0.25,0.02,40); },
    step:       () => tone(300, 0.08, "triangle", 0.12),
    stepBad:    () => { noiseBurst(0.4,0.35); tone(80,0.5,"sawtooth",0.2,0,30); },
    win:        () => {
      [523,659,784,1047].forEach((f,i)=> tone(f, 0.22, "triangle", 0.18, i*0.11));
    },
    whoosh:     () => tone(220,0.25,"sine",0.12,0,520),
    setMuted:   (m) => { muted = m; },
    getMuted:   () => muted,
    warm:       () => ensureCtx(),
  };
})();

/* ---------------------------------------------------------
   SCREEN MANAGER
--------------------------------------------------------- */
const screens = {};
document.querySelectorAll(".screen").forEach(s => screens[s.id] = s);
function showScreen(id){
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[id].classList.add("active");
}

/* ---------------------------------------------------------
   GLOBAL GAME STATE
--------------------------------------------------------- */
const state = {
  survivors: 0,
  roundReached: 1,
};

/* ---------------------------------------------------------
   ROSTER UI
--------------------------------------------------------- */
function buildRoster(){
  const el = document.getElementById("roster");
  el.innerHTML = "";
  ROSTER.forEach((c, i) => {
    const card = document.createElement("button");
    card.className = "roster-card" + (i===0 ? " selected" : "");
    card.setAttribute("role","listitem");
    card.innerHTML = `<img src="${c.img}" alt="${c.name}"><span>${c.name}</span>`;
    card.addEventListener("click", () => {
      Sound.click();
      selectedCharacter = c;
      document.querySelectorAll(".roster-card").forEach(x=>x.classList.remove("selected"));
      card.classList.add("selected");
    });
    el.appendChild(card);
  });
}
buildRoster();

/* ---------------------------------------------------------
   NAV BUTTONS
--------------------------------------------------------- */
document.getElementById("btnPlay").addEventListener("click", () => {
  Sound.warm(); Sound.click();
  showScreen("screen-howto");
});
document.getElementById("btnStartRound1").addEventListener("click", () => {
  Sound.click();
  showScreen("screen-round1");
  Round1.start();
});
document.getElementById("btnRetry").addEventListener("click", () => {
  Sound.click();
  showScreen("screen-start");
});
document.getElementById("muteBtn").addEventListener("click", (e) => {
  const m = !Sound.getMuted();
  Sound.setMuted(m);
  e.target.textContent = m ? "🔇" : "🔊";
});

function goToResult(won, roundReached){
  state.roundReached = roundReached;
  document.getElementById("resultSurvivors").textContent = Math.max(state.survivors,0);
  document.getElementById("resultRound").textContent = roundReached;
  const title = document.getElementById("resultTitle");
  const sub = document.getElementById("resultSub");
  if (won){
    title.textContent = "YOU SURVIVED";
    title.classList.add("win");
    sub.textContent = "You made it through the Pull. Front-run the ashes.";
    Sound.win();
  } else {
    title.textContent = "ELIMINATED";
    title.classList.remove("win");
    sub.textContent = roundReached === 1
      ? "You moved when the light was red."
      : "The glass didn't hold.";
  }
  showScreen("screen-result");
}

/* ============================================================
   ROUND 1 — RED LIGHT / GREEN LIGHT
   ============================================================ */
const Round1 = (() => {
  const canvas = document.getElementById("canvasRound1");
  const ctx = canvas.getContext("2d");
  const lightBanner = document.getElementById("lightBanner");
  const progressFill = document.getElementById("progressFill");
  const survivorsEl = document.getElementById("survivorsCount");
  const timeEl = document.getElementById("timeLeft");
  const moveBtn = document.getElementById("moveBtn");
  const vignette = document.getElementById("vignetteFlash");

  const playerImg = new Image();
  const botImgs = ROSTER.map(c => { const im = new Image(); im.src = c.img; return im; });

  let W, H, DPR;
  let running = false;
  let light = "green"; // green | turning | red
  let lightTimer = 0;
  let lightDuration = 2;
  let dollFlip = 1; // 1 = facing away (green), -1 facing player (red)
  let dollShake = 0;
  let timeLeft = 60;
  let isMoving = false;
  let player, bots;
  let finishY;
  const FINISH_MARGIN = 90;
  const START_MARGIN = 90;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+"px"; canvas.style.height = H+"px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
    finishY = FINISH_MARGIN;
  }
  window.addEventListener("resize", resize);

  function makeRacers(){
    playerImg.src = selectedCharacter.img;
    const laneCount = 7;
    bots = [];
    for (let i=0;i<laneCount;i++){
      const img = botImgs[i % botImgs.length];
      bots.push({
        img,
        lane: i,
        y: H - START_MARGIN + (Math.random()*30-15),
        alive: true,
        speed: 26 + Math.random()*22,
        riskiness: 0.10 + Math.random()*0.12, // chance to get caught moving on red
        movingState: false,
        finished: false,
      });
    }
    player = { y: H - START_MARGIN, alive: true, finished: false };
    state.survivors = bots.length + 1;
  }

  function layoutX(lane, total){
    const pad = 60;
    const usable = W - pad*2;
    return pad + (usable/(total)) * (lane+0.5);
  }

  function setLight(next){
    light = next;
    lightBanner.classList.remove("green","red");
    if (next === "green"){
      lightBanner.textContent = "GREEN LIGHT";
      lightBanner.classList.add("green");
      dollFlip = 1;
      lightDuration = 1.4 + Math.random()*1.8;
      Sound.green();
    } else if (next === "turning"){
      lightBanner.textContent = "···";
      lightDuration = 0.35 + Math.random()*0.25;
    } else {
      lightBanner.textContent = "RED LIGHT";
      lightBanner.classList.add("red");
      dollFlip = -1;
      dollShake = 10;
      lightDuration = 1.6 + Math.random()*1.7;
      Sound.redAlarm();
    }
    lightTimer = 0;
  }

  function eliminatePlayer(){
    if (!player.alive) return;
    player.alive = false;
    running = false;
    Sound.eliminate();
    vignette.classList.add("on");
    setTimeout(()=> vignette.classList.remove("on"), 260);
    setTimeout(()=> goToResult(false, 1), 500);
  }

  function eliminateBot(b){
    if (!b.alive) return;
    b.alive = false;
    state.survivors = Math.max(0, state.survivors-1);
    survivorsEl.textContent = state.survivors;
  }

  /* ---- input ---- */
  function setMoving(v){
    isMoving = v;
    moveBtn.classList.toggle("active", v);
    if (v && light === "red" && player.alive){
      eliminatePlayer();
    }
  }
  moveBtn.addEventListener("touchstart", e=>{ e.preventDefault(); setMoving(true); }, {passive:false});
  moveBtn.addEventListener("touchend",   e=>{ e.preventDefault(); setMoving(false); }, {passive:false});
  moveBtn.addEventListener("touchcancel",e=>{ setMoving(false); });
  moveBtn.addEventListener("mousedown", ()=> setMoving(true));
  window.addEventListener("mouseup",   ()=> setMoving(false));
  moveBtn.addEventListener("mouseleave", ()=>{ if(!('ontouchstart' in window)) {} });
  window.addEventListener("keydown", e=>{
    if (!screens["screen-round1"].classList.contains("active")) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code==="KeyW"){
      e.preventDefault();
      if (!isMoving) setMoving(true);
    }
  });
  window.addEventListener("keyup", e=>{
    if (e.code === "Space" || e.code === "ArrowUp" || e.code==="KeyW"){
      setMoving(false);
    }
  });

  /* ---- loop ---- */
  let lastT = 0;
  function loop(ts){
    if (!running) return;
    if (!lastT) lastT = ts;
    const dt = Math.min((ts-lastT)/1000, 0.05);
    lastT = ts;

    lightTimer += dt;
    if (dollShake > 0) dollShake = Math.max(0, dollShake - dt*40);

    if (lightTimer >= lightDuration){
      if (light === "green") setLight("turning");
      else if (light === "turning") setLight("red");
      else setLight("green");
    }

    // timer
    timeLeft -= dt;
    if (timeLeft <= 0){
      timeLeft = 0;
      timeEl.textContent = "0";
      if (player.alive && !player.finished){
        running = false;
        Sound.eliminate();
        setTimeout(()=> goToResult(false,1), 300);
      }
    } else {
      timeEl.textContent = Math.ceil(timeLeft);
    }

    // player movement
    if (player.alive && !player.finished && isMoving && light === "green"){
      player.y -= 78*dt;
      if (player.y <= finishY){
        player.y = finishY;
        player.finished = true;
        running = false;
        setTimeout(()=> {
          showScreen("screen-round2");
          Round2.start();
        }, 500);
      }
    }
    const total = (H - START_MARGIN) - finishY;
    const progressed = Math.max(0, Math.min(1, ((H-START_MARGIN) - player.y) / total));
    progressFill.style.width = (progressed*100).toFixed(1)+"%";

    // bots
    bots.forEach(b=>{
      if (!b.alive || b.finished) return;
      const wantsMove = light === "green" || (light==="red" && Math.random() < b.riskiness*dt*3);
      if (wantsMove){
        b.y -= b.speed*dt;
        if (light === "red"){
          eliminateBot(b);
        }
      }
      if (b.y <= finishY){ b.y = finishY; b.finished = true; }
    });

    draw();
    requestAnimationFrame(loop);
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // backdrop
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, "#0a0a10");
    grad.addColorStop(1, "#050506");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    // ground lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x=0; x<W; x+=40){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    }

    // finish line
    ctx.fillStyle = "rgba(255,30,60,0.08)";
    ctx.fillRect(0,0,W,finishY);
    ctx.strokeStyle = "#ff1e3c";
    ctx.setLineDash([10,8]);
    ctx.beginPath(); ctx.moveTo(0,finishY); ctx.lineTo(W,finishY); ctx.stroke();
    ctx.setLineDash([]);

    // doll
    const dollX = W/2, dollY = finishY/2 + 8;
    ctx.save();
    ctx.translate(dollX + (dollShake ? (Math.random()*2-1)*dollShake : 0), dollY);
    ctx.scale(dollFlip, 1);
    ctx.fillStyle = "#0a0a0d";
    ctx.beginPath(); ctx.roundRect(-26,-26,52,52,10); ctx.fill();
    ctx.strokeStyle = light==="red" ? "#ff1e3c" : "#1e3aff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-26,-26,52,52,10); ctx.stroke();
    // eyes
    ctx.fillStyle = light==="red" ? "#ff1e3c" : "#39ff6a";
    ctx.beginPath(); ctx.arc(-9,-2,4,0,7); ctx.arc(9,-2,4,0,7); ctx.fill();
    ctx.restore();

    // bots
    bots.forEach(b=>{
      const x = layoutX(b.lane, bots.length);
      drawRacer(x, b.y, b.img, !b.alive, 30);
    });

    // player
    if (player){
      drawRacer(W/2, player.y, playerImg, !player.alive, 40, true);
    }
  }

  function drawRacer(x,y,img,dead,size,isPlayer){
    ctx.save();
    ctx.translate(x,y);
    if (dead){ ctx.globalAlpha = 0.35; ctx.rotate(Math.PI/2); }
    ctx.beginPath();
    ctx.arc(0,0,size/2+3,0,Math.PI*2);
    ctx.fillStyle = isPlayer ? "#ff1e3c" : "#1e3aff";
    ctx.fill();
    try {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0,0,size/2,0,Math.PI*2);
      ctx.clip();
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -size/2,-size/2,size,size);
      ctx.restore();
    } catch(e){}
    ctx.restore();
  }

  function start(){
    resize();
    timeLeft = 60;
    isMoving = false;
    makeRacers();
    survivorsEl.textContent = state.survivors;
    timeEl.textContent = "60";
    progressFill.style.width = "0%";
    setLight("green");
    running = true;
    lastT = 0;
    requestAnimationFrame(loop);
  }

  return { start };
})();

/* ============================================================
   ROUND 2 — GLASS BRIDGE
   ============================================================ */
const Round2 = (() => {
  const canvas = document.getElementById("canvasRound2");
  const ctx = canvas.getContext("2d");
  const survivorsEl = document.getElementById("survivorsCount2");
  const stepEl = document.getElementById("bridgeStep");
  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const vignette = document.getElementById("vignetteFlash");

  const TOTAL_STEPS = 9;
  const playerImg = new Image();

  let W,H,DPR;
  let step = 0;
  let correctSide = []; // precomputed per step
  let busy = false;
  let playerX = 0.5; // 0..1 lane fraction within current step (visual only)
  let broken = null; // {step, side}
  let fallAnim = null;

  function resize(){
    DPR = Math.min(window.devicePixelRatio||1,2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width=W+"px"; canvas.style.height=H+"px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener("resize", ()=>{ if(screens["screen-round2"].classList.contains("active")) { resize(); draw(); } });

  function start(){
    resize();
    playerImg.src = selectedCharacter.img;
    step = 0;
    broken = null;
    fallAnim = null;
    correctSide = Array.from({length:TOTAL_STEPS}, ()=> Math.random()<0.5?"L":"R");
    stepEl.textContent = `0/${TOTAL_STEPS}`;
    survivorsEl.textContent = state.survivors;
    draw();
  }

  function choose(side){
    if (busy || fallAnim) return;
    busy = true;
    const good = side === correctSide[step];
    if (good){
      Sound.step();
      step++;
      stepEl.textContent = `${step}/${TOTAL_STEPS}`;
      // random chance a bot behind falls for atmosphere
      if (Math.random() < 0.35 && state.survivors > 1){
        state.survivors--;
        survivorsEl.textContent = state.survivors;
      }
      draw(true, side);
      setTimeout(()=>{
        busy = false;
        if (step >= TOTAL_STEPS){
          setTimeout(()=> goToResult(true, 2), 300);
        }
      }, 260);
    } else {
      Sound.stepBad();
      broken = { step, side };
      draw(true, side, true);
      vignette.classList.add("on");
      setTimeout(()=> vignette.classList.remove("on"), 260);
      setTimeout(()=> goToResult(false, 2), 700);
    }
  }

  btnLeft.addEventListener("click", ()=> choose("L"));
  btnRight.addEventListener("click", ()=> choose("R"));
  window.addEventListener("keydown", e=>{
    if (!screens["screen-round2"].classList.contains("active")) return;
    if (e.code === "ArrowLeft") choose("L");
    if (e.code === "ArrowRight") choose("R");
  });

  function draw(animateStep, chosenSide, isFall){
    ctx.clearRect(0,0,W,H);
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,"#0a0a10"); grad.addColorStop(1,"#050506");
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    const stepH = Math.min(64, (H-40) / (TOTAL_STEPS+1));
    const bottomY = H - 30;
    const panelW = Math.min(120, W*0.36);
    const gap = 14;
    const cx = W/2;

    for (let i=0;i<TOTAL_STEPS;i++){
      const y = bottomY - i*stepH;
      const isCurrent = i === step;
      const isPast = i < step;
      const label = isPast ? (correctSide[i]) : null;

      ["L","R"].forEach(side=>{
        const x = side==="L" ? cx - gap/2 - panelW : cx + gap/2;
        let brokenHere = isPast && correctSide[i] !== side;
        if (broken && broken.step===i && broken.side===side) brokenHere = true;

        ctx.save();
        if (brokenHere){
          ctx.globalAlpha = 0.15;
        }
        ctx.fillStyle = isCurrent ? "rgba(30,58,255,0.18)" : "rgba(255,255,255,0.05)";
        ctx.strokeStyle = brokenHere ? "#ff1e3c" : (isCurrent ? "#1e3aff" : "rgba(255,255,255,0.15)");
        ctx.lineWidth = isCurrent ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y-stepH+8, panelW, stepH-12, 6);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      });
    }

    // player marker at current step
    const py = bottomY - step*stepH - stepH/2 + 4;
    ctx.save();
    ctx.translate(cx, py);
    ctx.beginPath();
    ctx.arc(0,0,20,0,Math.PI*2);
    ctx.fillStyle = "#ff1e3c";
    ctx.fill();
    try{
      ctx.save(); ctx.beginPath(); ctx.arc(0,0,17,0,Math.PI*2); ctx.clip();
      if (playerImg.complete && playerImg.naturalWidth) ctx.drawImage(playerImg,-17,-17,34,34);
      ctx.restore();
    }catch(e){}
    ctx.restore();
  }

  return { start };
})();

/* ---------------------------------------------------------
   INITIAL SIZE FIX (screens hidden = 0 size canvases)
--------------------------------------------------------- */
window.addEventListener("orientationchange", ()=>{
  setTimeout(()=>{
    if (screens["screen-round1"].classList.contains("active")) window.dispatchEvent(new Event("resize"));
    if (screens["screen-round2"].classList.contains("active")) window.dispatchEvent(new Event("resize"));
  }, 300);
});

})();
