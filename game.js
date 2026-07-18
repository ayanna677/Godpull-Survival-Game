/* ============================================================
   GOD PULL — SURVIVE THE PULL
   Real 3D build on Three.js. All images are inlined as base64
   data URIs in assets-data.js — nothing to fail to load, no
   server required, works opened straight from disk.
   ============================================================ */
(() => {
"use strict";

/* ---------------------------------------------------------
   INJECT INLINE ASSETS INTO ALL <img data-asset> TAGS
--------------------------------------------------------- */
document.querySelectorAll("[data-asset]").forEach(el => {
  const key = el.getAttribute("data-asset");
  if (window.ASSETS && ASSETS[key]) el.src = ASSETS[key];
});

/* ---------------------------------------------------------
   ROSTER — the two fighters supplied for the project
--------------------------------------------------------- */
const ROSTER = [
  { id:"smudge", name:"SMUDGE", key:"smudge" },
  { id:"pink",   name:"PUNCH",  key:"pink"   },
  { id:"betty",  name:"BETTY",  key:"betty"  },
];
let selectedCharacter = ROSTER[0];

/* ---------------------------------------------------------
   TEXTURE CACHE (Three.js)
--------------------------------------------------------- */
const TextureCache = (() => {
  const loader = new THREE.TextureLoader();
  const cache = {};
  return {
    get(key){
      if (!cache[key]){
        const tex = loader.load(ASSETS[key]);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        cache[key] = tex;
      }
      return cache[key];
    }
  };
})();

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
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
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
    eliminate:  () => { noiseBurst(0.5,0.4); tone(90,0.6,"sawtooth",0.25,0.02,40); },
    step:       () => tone(300, 0.08, "triangle", 0.12),
    stepBad:    () => { noiseBurst(0.4,0.35); tone(80,0.5,"sawtooth",0.2,0,30); },
    win:        () => { [523,659,784,1047].forEach((f,i)=> tone(f, 0.22, "triangle", 0.18, i*0.11)); },
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

const letterboxTop = document.getElementById("letterboxTop");
const letterboxBottom = document.getElementById("letterboxBottom");
function setLetterbox(on){
  letterboxTop.classList.toggle("on", on);
  letterboxBottom.classList.toggle("on", on);
}

/* ---------------------------------------------------------
   GLOBAL GAME STATE
--------------------------------------------------------- */
const state = { survivors: 0, roundReached: 1 };

/* ---------------------------------------------------------
   ROSTER UI
--------------------------------------------------------- */
function buildRoster(){
  const el = document.getElementById("roster");
  const previewImg = document.getElementById("previewImg");
  const previewName = document.getElementById("previewName");
  el.innerHTML = "";
  ROSTER.forEach((c, i) => {
    const card = document.createElement("button");
    card.className = "roster-card" + (i===0 ? " selected" : "");
    card.setAttribute("role","listitem");
    card.innerHTML = `<img src="${ASSETS[c.key]}" alt="${c.name}">`;
    card.addEventListener("click", () => {
      Sound.click();
      selectedCharacter = c;
      document.querySelectorAll(".roster-card").forEach(x=>x.classList.remove("selected"));
      card.classList.add("selected");
      previewImg.src = ASSETS[c.key];
      previewName.textContent = c.name;
    });
    el.appendChild(card);
  });
  previewImg.src = ASSETS[ROSTER[0].key];
  previewName.textContent = ROSTER[0].name;
}
buildRoster();

/* ---------------------------------------------------------
   LOADING SCREEN (warm up textures before first round)
--------------------------------------------------------- */
const loadingScreen = document.getElementById("loadingScreen");
const loadingBarFill = document.getElementById("loadingBarFill");
function runLoadingScreen(cb){
  loadingScreen.classList.remove("hidden");
  let p = 0;
  const iv = setInterval(()=>{
    p += 14 + Math.random()*20;
    loadingBarFill.style.width = Math.min(p,100)+"%";
    if (p >= 100){
      clearInterval(iv);
      setTimeout(()=>{ loadingScreen.classList.add("hidden"); cb(); }, 180);
    }
  }, 90);
}

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
  setLetterbox(true);
  runLoadingScreen(()=> Round1.start());
});
document.getElementById("btnRetry").addEventListener("click", () => {
  Sound.click();
  setLetterbox(false);
  showScreen("screen-start");
});
document.getElementById("muteBtn").addEventListener("click", (e) => {
  const m = !Sound.getMuted();
  Sound.setMuted(m);
  e.target.textContent = m ? "🔇" : "🔊";
});

function goToResult(won, roundReached){
  setLetterbox(false);
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
      : roundReached === 2
        ? "The glass didn't hold."
        : "Your team went into the pit.";
  }
  showScreen("screen-result");
}

/* ---------------------------------------------------------
   SHARED 3D HELPERS
--------------------------------------------------------- */
function makeRenderer(canvas){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:"high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

function makeBillboard(key, size){
  const mat = new THREE.SpriteMaterial({ map: TextureCache.get(key), transparent:true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

function makeShadowBlob(radius){
  const geo = new THREE.CircleGeometry(radius, 20);
  const mat = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.45 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI/2;
  return mesh;
}

/* soft radial-gradient sprite texture, shared by dust + glow halos */
const softDot = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
})();

function addDustField(scene, opts){
  const { count=60, spreadX=20, spreadZ=40, baseY=1, height=6, centerZ=0, color=0xffffff } = opts;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const speeds = new Float32Array(count);
  for (let i=0;i<count;i++){
    pos[i*3]   = (Math.random()*2-1)*spreadX;
    pos[i*3+1] = baseY + Math.random()*height;
    pos[i*3+2] = centerZ + (Math.random()*2-1)*spreadZ;
    speeds[i]  = 0.15 + Math.random()*0.35;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
  const mat = new THREE.PointsMaterial({
    map: softDot, color, size:0.22, transparent:true, opacity:0.35,
    depthWrite:false, blending:THREE.AdditiveBlending
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return {
    update(dt){
      const arr = pts.geometry.attributes.position.array;
      for (let i=0;i<count;i++){
        arr[i*3+1] += speeds[i]*dt;
        if (arr[i*3+1] > baseY+height) arr[i*3+1] = baseY;
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }
  };
}

function addGlowHalo(scene, position, color, size){
  const mat = new THREE.SpriteMaterial({
    map: softDot, color, transparent:true, opacity:0.55,
    depthWrite:false, blending:THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size,size,1);
  sprite.position.copy(position);
  scene.add(sprite);
  return sprite;
}

/* ============================================================
   ROUND 1 — RED LIGHT / GREEN LIGHT (3D)
   ============================================================ */
const Round1 = (() => {
  const canvas = document.getElementById("canvasRound1");
  const lightBanner = document.getElementById("lightBanner");
  const progressFill = document.getElementById("progressFill");
  const survivorsEl = document.getElementById("survivorsCount");
  const timeEl = document.getElementById("timeLeft");
  const moveBtn = document.getElementById("moveBtn");
  const vignette = document.getElementById("vignetteFlash");

  let renderer, scene, camera;
  let dollGroup, dollHeadMat, eyeL, eyeR;
  let ground;
  let racers = []; // {sprite, shadow, alive, isPlayer, z, lane, speed, riskiness, finished}
  let particles = [];
  let dust;

  let running = false;
  let light = "green";
  let lightTimer = 0;
  let lightDuration = 2;
  let dollTargetY = Math.PI; // PI = facing away (green)
  let camShake = 0;
  let timeLeft = 60;
  let isMoving = false;

  const START_Z = 17;
  const FINISH_Z = -16;
  const DOLL_Z = -19;

  function initScene(){
    renderer = makeRenderer(canvas);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070a);
    scene.fog = new THREE.FogExp2(0x07070a, 0.05);

    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);

    // lights
    scene.add(new THREE.AmbientLight(0x30303c, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(6, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left = -25; key.shadow.camera.right = 25;
    key.shadow.camera.top = 25; key.shadow.camera.bottom = -25;
    scene.add(key);
    const redRim = new THREE.PointLight(0xff1e3c, 2.2, 30);
    redRim.position.set(0, 4, DOLL_Z+2);
    scene.add(redRim);
    const blueRim = new THREE.PointLight(0x1e3aff, 1.2, 40);
    blueRim.position.set(-14, 6, 0);
    scene.add(blueRim);

    // ground
    const groundGeo = new THREE.PlaneGeometry(46, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color:0x0b0b0e, roughness:0.95, metalness:0.05 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.position.z = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(60, 30, 0x552233, 0x141418);
    grid.position.y = 0.02;
    grid.position.z = -1;
    scene.add(grid);

    // finish line strip
    const finishGeo = new THREE.BoxGeometry(30, 0.05, 0.5);
    const finishMat = new THREE.MeshStandardMaterial({ color:0xff1e3c, emissive:0xff1e3c, emissiveIntensity:0.8 });
    const finishMesh = new THREE.Mesh(finishGeo, finishMat);
    finishMesh.position.set(0, 0.03, FINISH_Z);
    scene.add(finishMesh);

    // doll
    dollGroup = new THREE.Group();
    dollGroup.position.set(0, 0, DOLL_Z);
    const torsoGeo = new THREE.BoxGeometry(3.2, 5.4, 1.8);
    const torsoMat = new THREE.MeshStandardMaterial({ color:0x0c0c10, roughness:0.7 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 2.7;
    torso.castShadow = true;
    dollGroup.add(torso);

    const legGeo = new THREE.BoxGeometry(3.2, 1.6, 1.8);
    const leg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color:0x08080a }));
    leg.position.y = 0.8;
    dollGroup.add(leg);

    const headGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
    dollHeadMat = new THREE.MeshBasicMaterial({ map: TextureCache.get("logo") });
    const darkMat = new THREE.MeshStandardMaterial({ color:0x0a0a0d });
    const headMats = [darkMat, darkMat, darkMat, darkMat, dollHeadMat, darkMat]; // +x -x +y -y +z -z ; +z = front
    const head = new THREE.Mesh(headGeo, headMats);
    head.position.y = 6.4;
    head.castShadow = true;
    dollGroup.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.14, 10, 10);
    eyeL = new THREE.Mesh(eyeGeo, new THREE.MeshStandardMaterial({ color:0x39ff6a, emissive:0x39ff6a, emissiveIntensity:1.4 }));
    eyeR = eyeL.clone();
    eyeL.position.set(-0.5, 6.5, 1.25);
    eyeR.position.set(0.5, 6.5, 1.25);
    dollGroup.add(eyeL, eyeR);

    dollGroup.rotation.y = Math.PI; // start facing away
    scene.add(dollGroup);

    addGlowHalo(scene, new THREE.Vector3(0, 4, DOLL_Z+2), 0xff1e3c, 9);
    addGlowHalo(scene, new THREE.Vector3(-14, 6, 0), 0x1e3aff, 12);
    dust = addDustField(scene, { count:70, spreadX:20, spreadZ:38, baseY:0.5, height:7, centerZ:(START_Z+DOLL_Z)/2 });

    // side pillars for depth
    for (let i=0;i<6;i++){
      const z = START_Z - i*7;
      [-16,16].forEach(x=>{
        const pGeo = new THREE.BoxGeometry(0.6, 5, 0.6);
        const pMat = new THREE.MeshStandardMaterial({ color:0x111116, roughness:0.8 });
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.set(x, 2.5, z);
        p.castShadow = true;
        scene.add(p);
      });
    }
  }

  function resize(){
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", ()=>{ if (screens["screen-round1"].classList.contains("active")) resize(); });

  function makeRacers(){
    racers.forEach(r=>{ scene.remove(r.sprite); scene.remove(r.shadow); });
    racers = [];
    const laneCount = 7;
    for (let i=0;i<laneCount;i++){
      const key = ROSTER[i % ROSTER.length].key;
      const lane = (i - (laneCount-1)/2) * 3.4 + (Math.random()*1.2-0.6);
      const sprite = makeBillboard(key, 2.1);
      const shadow = makeShadowBlob(0.9);
      sprite.position.set(lane, 1.15, START_Z + (Math.random()*2-1));
      shadow.position.set(lane, 0.02, START_Z);
      scene.add(sprite, shadow);
      racers.push({ sprite, shadow, alive:true, isPlayer:false, lane, z:sprite.position.z,
        speed: 5.6 + Math.random()*4.2, riskiness: 0.09 + Math.random()*0.12, finished:false });
    }
    const playerSprite = makeBillboard(selectedCharacter.key, 2.5);
    const playerShadow = makeShadowBlob(1.05);
    playerSprite.position.set(0, 1.3, START_Z);
    playerShadow.position.set(0, 0.02, START_Z);
    scene.add(playerSprite, playerShadow);
    racers.push({ sprite:playerSprite, shadow:playerShadow, alive:true, isPlayer:true, lane:0,
      z:START_Z, speed:0, riskiness:0, finished:false });

    state.survivors = racers.length;
  }

  function player(){ return racers.find(r=>r.isPlayer); }

  function setLight(next){
    light = next;
    lightBanner.classList.remove("green","red");
    if (next === "green"){
      lightBanner.textContent = "GREEN LIGHT";
      lightBanner.classList.add("green");
      dollTargetY = Math.PI;
      lightDuration = 1.5 + Math.random()*1.9;
      Sound.green();
    } else if (next === "turning"){
      lightBanner.textContent = "···";
      lightDuration = 0.35 + Math.random()*0.25;
    } else {
      lightBanner.textContent = "RED LIGHT";
      lightBanner.classList.add("red");
      dollTargetY = 0;
      camShake = 0.18;
      lightDuration = 1.6 + Math.random()*1.7;
      Sound.redAlarm();
    }
    lightTimer = 0;
  }

  function spawnBurst(pos, color){
    const count = 26;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count*3);
    const velocities = [];
    for (let i=0;i<count;i++){
      positions[i*3]=pos.x; positions[i*3+1]=pos.y; positions[i*3+2]=pos.z;
      velocities.push(new THREE.Vector3((Math.random()-0.5)*6,(Math.random())*5,(Math.random()-0.5)*6));
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions,3));
    const mat = new THREE.PointsMaterial({ color, size:0.16, transparent:true });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    particles.push({ pts, velocities, life:0.8, age:0 });
  }

  function eliminateRacer(r){
    if (!r.alive) return;
    r.alive = false;
    spawnBurst(r.sprite.position, r.isPlayer ? 0xff1e3c : 0x8888aa);
    scene.remove(r.sprite);
    scene.remove(r.shadow);
    if (!r.isPlayer){
      state.survivors = Math.max(0, state.survivors-1);
      survivorsEl.textContent = state.survivors;
    }
  }

  function eliminatePlayer(){
    const p = player();
    if (!p || !p.alive) return;
    eliminateRacer(p);
    running = false;
    Sound.eliminate();
    vignette.classList.add("on");
    setTimeout(()=> vignette.classList.remove("on"), 260);
    setTimeout(()=> goToResult(false, 1), 550);
  }

  /* ---- input ---- */
  function setMoving(v){
    isMoving = v;
    moveBtn.classList.toggle("active", v);
    if (v && light === "red"){
      const p = player();
      if (p && p.alive) eliminatePlayer();
    }
  }
  moveBtn.addEventListener("touchstart", e=>{ e.preventDefault(); setMoving(true); }, {passive:false});
  moveBtn.addEventListener("touchend",   e=>{ e.preventDefault(); setMoving(false); }, {passive:false});
  moveBtn.addEventListener("touchcancel",()=> setMoving(false));
  moveBtn.addEventListener("mousedown", ()=> setMoving(true));
  window.addEventListener("mouseup",   ()=> setMoving(false));
  window.addEventListener("keydown", e=>{
    if (!screens["screen-round1"].classList.contains("active")) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code==="KeyW"){
      e.preventDefault();
      if (!isMoving) setMoving(true);
    }
  });
  window.addEventListener("keyup", e=>{
    if (e.code === "Space" || e.code === "ArrowUp" || e.code==="KeyW") setMoving(false);
  });

  /* ---- loop ---- */
  let lastT = 0;
  function loop(ts){
    if (!running){ renderer.render(scene, camera); return; }
    if (!lastT) lastT = ts;
    const dt = Math.min((ts-lastT)/1000, 0.05);
    lastT = ts;

    lightTimer += dt;
    if (lightTimer >= lightDuration){
      if (light === "green") setLight("turning");
      else if (light === "turning") setLight("red");
      else setLight("green");
    }

    // doll rotation ease
    dollGroup.rotation.y += (dollTargetY - dollGroup.rotation.y) * Math.min(1, dt*9);
    eyeL.material.color.set(light==="red" ? 0xff1e3c : 0x39ff6a);
    eyeR.material.color.copy(eyeL.material.color);
    eyeL.material.emissive.copy(eyeL.material.color);
    eyeR.material.emissive.copy(eyeL.material.color);
    if (camShake > 0) camShake = Math.max(0, camShake - dt*0.6);

    // timer
    timeLeft -= dt;
    const p = player();
    if (timeLeft <= 0){
      timeLeft = 0; timeEl.textContent = "0";
      if (p && p.alive && !p.finished){
        running = false;
        Sound.eliminate();
        setTimeout(()=> goToResult(false,1), 300);
      }
    } else {
      timeEl.textContent = Math.ceil(timeLeft);
    }

    // player movement
    if (p && p.alive && !p.finished && isMoving && light === "green"){
      p.sprite.position.z -= 7.2*dt;
      p.shadow.position.z = p.sprite.position.z;
      if (p.sprite.position.z <= FINISH_Z){
        p.sprite.position.z = FINISH_Z;
        p.finished = true;
        running = false;
        setTimeout(()=> { showScreen("screen-round2"); setLetterbox(true); Round2.start(); }, 500);
      }
    }
    if (p){
      const total = START_Z - FINISH_Z;
      const progressed = Math.max(0, Math.min(1, (START_Z - p.sprite.position.z) / total));
      progressFill.style.width = (progressed*100).toFixed(1)+"%";
    }

    // bots
    racers.forEach(r=>{
      if (r.isPlayer || !r.alive || r.finished) return;
      const wantsMove = light === "green" || (light==="red" && Math.random() < r.riskiness*dt*3);
      if (wantsMove){
        r.sprite.position.z -= r.speed*dt;
        r.shadow.position.z = r.sprite.position.z;
        if (light === "red") eliminateRacer(r);
      }
      if (r.alive && r.sprite.position.z <= FINISH_Z){ r.sprite.position.z = FINISH_Z; r.finished = true; }
    });

    // particles
    particles = particles.filter(pr=>{
      pr.age += dt;
      const arr = pr.pts.geometry.attributes.position.array;
      for (let i=0;i<pr.velocities.length;i++){
        arr[i*3]   += pr.velocities[i].x*dt;
        arr[i*3+1] += (pr.velocities[i].y - 9*pr.age)*dt;
        arr[i*3+2] += pr.velocities[i].z*dt;
      }
      pr.pts.geometry.attributes.position.needsUpdate = true;
      pr.pts.material.opacity = Math.max(0, 1 - pr.age/pr.life);
      if (pr.age >= pr.life){ scene.remove(pr.pts); return false; }
      return true;
    });

    // camera
    const shakeX = camShake ? (Math.random()*2-1)*camShake : 0;
    const shakeY = camShake ? (Math.random()*2-1)*camShake : 0;
    camera.position.set(0+shakeX, 8.5+shakeY, START_Z+9);
    camera.lookAt(0, 2.2, DOLL_Z+4);
    if (dust) dust.update(dt);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function start(){
    if (!renderer) initScene();
    resize();
    timeLeft = 60;
    isMoving = false;
    camShake = 0;
    dollGroup.rotation.y = Math.PI;
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
   ROUND 2 — GLASS BRIDGE (3D)
   ============================================================ */
const Round2 = (() => {
  const canvas = document.getElementById("canvasRound2");
  const survivorsEl = document.getElementById("survivorsCount2");
  const stepEl = document.getElementById("bridgeStep");
  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const vignette = document.getElementById("vignetteFlash");

  const TOTAL_STEPS = 9;
  const TILE_GAP = 2.6;
  const START_Z = 6;

  let renderer, scene, camera;
  let tiles = []; // per step: {L:{mesh,broken}, R:{...}}
  let playerSprite, playerShadow;
  let step = 0;
  let correctSide = [];
  let busy = false;
  let running = false;
  let jumpAnim = null; // {fromZ,toZ,t,dur}
  let fallAnim = null; // {mesh/sprite, t}
  let camShake = 0;
  let dust;

  function zForStep(i){ return START_Z - i*TILE_GAP; }

  function initScene(){
    renderer = makeRenderer(canvas);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070a);
    scene.fog = new THREE.FogExp2(0x07070a, 0.045);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

    scene.add(new THREE.AmbientLight(0x30303c, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(5, 12, 8);
    key.castShadow = true;
    scene.add(key);
    const blueGlow = new THREE.PointLight(0x1e3aff, 2.0, 26);
    blueGlow.position.set(0, 3, zForStep(4));
    scene.add(blueGlow);
    const redGlow = new THREE.PointLight(0xff1e3c, 1.2, 20);
    redGlow.position.set(0, -2, zForStep(9));
    scene.add(redGlow);
    addGlowHalo(scene, new THREE.Vector3(0, 3, zForStep(4)), 0x1e3aff, 10);
    dust = addDustField(scene, { count:50, spreadX:10, spreadZ:26, baseY:-2, height:6, centerZ:zForStep(4) });

    // void floor far below for depth
    const voidGeo = new THREE.PlaneGeometry(60,80);
    const voidMat = new THREE.MeshStandardMaterial({ color:0x020203, roughness:1 });
    const voidMesh = new THREE.Mesh(voidGeo, voidMat);
    voidMesh.rotation.x = -Math.PI/2;
    voidMesh.position.y = -14;
    voidMesh.position.z = zForStep(4);
    scene.add(voidMesh);

    // starting platform
    const platGeo = new THREE.BoxGeometry(6, 0.4, 3);
    const platMat = new THREE.MeshStandardMaterial({ color:0x111116, roughness:0.8 });
    const plat = new THREE.Mesh(platGeo, platMat);
    plat.position.set(0, -0.2, START_Z+1.6);
    plat.receiveShadow = true;
    scene.add(plat);
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", ()=>{ if (screens["screen-round2"].classList.contains("active")) resize(); });

  function buildBridge(){
    tiles.forEach(pair=>{ scene.remove(pair.L.mesh); scene.remove(pair.R.mesh); });
    tiles = [];
    correctSide = Array.from({length:TOTAL_STEPS}, ()=> Math.random()<0.5?"L":"R");

    const tileGeo = new THREE.BoxGeometry(2, 0.18, 2.2);
    for (let i=0;i<TOTAL_STEPS;i++){
      const z = zForStep(i);
      const pair = {};
      ["L","R"].forEach(side=>{
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x1e3aff, transparent:true, opacity:0.24,
          roughness:0.15, metalness:0.1, emissive:0x0d1a7a, emissiveIntensity:0.4
        });
        const mesh = new THREE.Mesh(tileGeo, mat);
        mesh.position.set(side==="L" ? -1.15 : 1.15, 0, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        scene.add(mesh);
        pair[side] = { mesh, broken:false, baseOpacity:0.24 };
      });
      tiles.push(pair);
    }
  }

  function player(){ return { sprite: playerSprite }; }

  function start(){
    if (!renderer) initScene();
    resize();
    step = 0;
    busy = false;
    jumpAnim = null;
    fallAnim = null;
    camShake = 0;
    buildBridge();

    if (playerSprite) { scene.remove(playerSprite); scene.remove(playerShadow); }
    playerSprite = makeBillboard(selectedCharacter.key, 1.9);
    playerShadow = makeShadowBlob(0.8);
    playerSprite.position.set(0, 1.05, START_Z+1.6);
    playerShadow.position.set(0, -0.18, START_Z+1.6);
    scene.add(playerSprite, playerShadow);

    stepEl.textContent = `0/${TOTAL_STEPS}`;
    survivorsEl.textContent = state.survivors;
    running = true;
    lastT = 0;
    requestAnimationFrame(loop);
  }

  function choose(side){
    if (busy || !running) return;
    busy = true;
    const good = side === correctSide[step];
    const fromZ = playerSprite.position.z;
    const toZ = zForStep(step);

    if (good){
      Sound.step();
      jumpAnim = { fromZ, toZ, fromX: playerSprite.position.x, toX: side==="L"?-1.15:1.15, t:0, dur:0.32 };
      step++;
      stepEl.textContent = `${step}/${TOTAL_STEPS}`;
      if (Math.random() < 0.3 && state.survivors > 1){
        state.survivors--;
        survivorsEl.textContent = state.survivors;
      }
      setTimeout(()=>{
        busy = false;
        if (step >= TOTAL_STEPS){
          running = false;
          setTimeout(()=> { showScreen("screen-round3"); Round3.start(); }, 500);
        }
      }, 340);
    } else {
      Sound.stepBad();
      const badTile = tiles[step][side];
      badTile.broken = true;
      fallAnim = { tile: badTile.mesh, t:0 };
      jumpAnim = { fromZ, toZ, fromX: playerSprite.position.x, toX: side==="L"?-1.15:1.15, t:0, dur:0.22, fall:true };
      camShake = 0.22;
      vignette.classList.add("on");
      setTimeout(()=> vignette.classList.remove("on"), 260);
      running = false;
      setTimeout(()=> goToResult(false, 2), 750);
    }
  }

  btnLeft.addEventListener("click", ()=> choose("L"));
  btnRight.addEventListener("click", ()=> choose("R"));
  window.addEventListener("keydown", e=>{
    if (!screens["screen-round2"].classList.contains("active")) return;
    if (e.code === "ArrowLeft") choose("L");
    if (e.code === "ArrowRight") choose("R");
  });

  let lastT = 0;
  function loop(ts){
    if (!lastT) lastT = ts;
    const dt = Math.min((ts-lastT)/1000, 0.05);
    lastT = ts;

    if (jumpAnim){
      jumpAnim.t += dt;
      const k = Math.min(1, jumpAnim.t / jumpAnim.dur);
      const ease = 1 - Math.pow(1-k, 2);
      playerSprite.position.z = jumpAnim.fromZ + (jumpAnim.toZ - jumpAnim.fromZ)*ease;
      playerSprite.position.x = jumpAnim.fromX + (jumpAnim.toX - jumpAnim.fromX)*ease;
      const arc = Math.sin(k*Math.PI) * (jumpAnim.fall ? 0.6 : 1.1);
      playerSprite.position.y = 1.05 + arc;
      if (jumpAnim.fall && k >= 1){
        playerSprite.position.y -= (jumpAnim.t-jumpAnim.dur)*14;
      }
      playerShadow.position.z = playerSprite.position.z;
      playerShadow.position.x = playerSprite.position.x;
      if (k >= 1 && !jumpAnim.fall) jumpAnim = null;
    }

    if (fallAnim){
      fallAnim.t += dt;
      fallAnim.tile.position.y -= dt*10;
      fallAnim.tile.rotation.x += dt*3;
      fallAnim.tile.material.opacity = Math.max(0, fallAnim.tile.material.opacity - dt*1.2);
    }
    if (camShake > 0) camShake = Math.max(0, camShake - dt*0.7);

    const camZTarget = playerSprite.position.z + 7;
    const shakeX = camShake ? (Math.random()*2-1)*camShake : 0;
    camera.position.set(1.6+shakeX, 4.6, camZTarget);
    camera.lookAt(0, 0.6, playerSprite.position.z - 3);
    if (dust) dust.update(dt);

    renderer.render(scene, camera);
    if (screens["screen-round2"].classList.contains("active")) requestAnimationFrame(loop);
  }

  return { start };
})();

/* ============================================================
   ROUND 3 — TUG OF WAR (3D, finale)
   ============================================================ */
const Round3 = (() => {
  const canvas = document.getElementById("canvasRound3");
  const survivorsEl = document.getElementById("survivorsCount3");
  const timeEl = document.getElementById("timeLeft3");
  const pullBtn = document.getElementById("pullBtn");
  const tensionFill = document.getElementById("tensionFill");
  const tensionMarker = document.getElementById("tensionMarker");
  const vignette = document.getElementById("vignetteFlash");

  let renderer, scene, camera;
  let rope, ropeKnot, allies = [], rivals = [];
  let dust;
  let running = false;
  let tension = 0;       // -1 (pit / lose) .. +1 (win)
  let velocity = 0;
  let timeLeft = 15;
  let lastTapAt = -999;
  let ended = false;
  let camShake = 0;

  const PIT_Z = 0;
  const PLAYER_SIDE_Z = 9;
  const RIVAL_SIDE_Z = -9;

  function initScene(){
    renderer = makeRenderer(canvas);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070a);
    scene.fog = new THREE.FogExp2(0x07070a, 0.05);
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

    scene.add(new THREE.AmbientLight(0x30303c, 0.95));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(6, 12, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // pit
    const pitGeo = new THREE.PlaneGeometry(10, 6);
    const pitMat = new THREE.MeshStandardMaterial({ color:0x020203, roughness:1 });
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI/2;
    pit.position.set(0, -1.2, PIT_Z);
    scene.add(pit);
    const pitGlow = new THREE.PointLight(0xff1e3c, 1.6, 14);
    pitGlow.position.set(0, -0.6, PIT_Z);
    scene.add(pitGlow);

    // platforms
    [PLAYER_SIDE_Z, RIVAL_SIDE_Z].forEach((z,i)=>{
      const platGeo = new THREE.BoxGeometry(8, 0.6, 5);
      const platMat = new THREE.MeshStandardMaterial({ color: i===0?0x0e0e14:0x14090c, roughness:0.85 });
      const plat = new THREE.Mesh(platGeo, platMat);
      plat.position.set(0, -0.3, z + (i===0?2:-2));
      plat.receiveShadow = true;
      scene.add(plat);
    });

    // rope
    const ropeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.9, PLAYER_SIDE_Z),
      new THREE.Vector3(0, 0.6, 0),
      new THREE.Vector3(0, 0.9, RIVAL_SIDE_Z),
    ]);
    const ropeGeo = new THREE.TubeGeometry(ropeCurve, 20, 0.09, 8, false);
    const ropeMat = new THREE.MeshStandardMaterial({ color:0x8a6a3f, roughness:0.9 });
    rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.castShadow = true;
    scene.add(rope);

    ropeKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 12),
      new THREE.MeshStandardMaterial({ color:0xff1e3c, emissive:0x7a0f1c, emissiveIntensity:0.6 })
    );
    scene.add(ropeKnot);

    addGlowHalo(scene, new THREE.Vector3(0, -0.4, PIT_Z), 0xff1e3c, 8);
    dust = addDustField(scene, { count:40, spreadX:8, spreadZ:20, baseY:-1, height:5, centerZ:0 });
  }

  function resize(){
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", ()=>{ if (screens["screen-round3"].classList.contains("active")) resize(); });

  function makeTeam(zBase, dir, roster){
    const arr = [];
    for (let i=0;i<3;i++){
      const key = roster ? ROSTER[i % ROSTER.length].key : null;
      let sprite;
      if (key){
        sprite = makeBillboard(key, 2.0);
      } else {
        // silhouette rival — procedural, no texture needed
        const geo = new THREE.BoxGeometry(1.1, 2.1, 0.7);
        const mat = new THREE.MeshStandardMaterial({ color:0x0c0c10, roughness:0.9 });
        sprite = new THREE.Mesh(geo, mat);
        sprite.castShadow = true;
      }
      sprite.position.set((i-1)*1.6, 1.1, zBase + dir*(1.6 + Math.random()*0.6));
      scene.add(sprite);
      arr.push(sprite);
    }
    return arr;
  }

  function clearTeams(){
    allies.forEach(s=>scene.remove(s));
    rivals.forEach(s=>scene.remove(s));
    allies = []; rivals = [];
  }

  function updateRope(){
    const shift = tension * 3.2;
    const ropeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.9, PLAYER_SIDE_Z),
      new THREE.Vector3(0, 0.6, shift),
      new THREE.Vector3(0, 0.9, RIVAL_SIDE_Z),
    ]);
    rope.geometry.dispose();
    rope.geometry = new THREE.TubeGeometry(ropeCurve, 20, 0.09, 8, false);
    ropeKnot.position.set(0, 0.6, shift);

    const pct = ((tension+1)/2)*100;
    tensionFill.style.width = Math.abs(50-pct)+"%";
    tensionFill.style.left = pct < 50 ? pct+"%" : "50%";
    tensionMarker.style.left = pct+"%";
  }

  function pull(){
    if (ended) return;
    const now = performance.now();
    if (now - lastTapAt < 55) return; // debounce ultra-fast double fires
    lastTapAt = now;
    velocity += 0.62;
    Sound.step();
    pullBtn.classList.add("active");
    setTimeout(()=> pullBtn.classList.remove("active"), 80);
    // little dust puff at player anchor
    spawnPuff(new THREE.Vector3(0, 0.3, PLAYER_SIDE_Z-1));
  }

  function spawnPuff(pos){
    const count = 10;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count*3);
    for (let i=0;i<count;i++){ positions[i*3]=pos.x; positions[i*3+1]=pos.y; positions[i*3+2]=pos.z; }
    geo.setAttribute("position", new THREE.BufferAttribute(positions,3));
    const mat = new THREE.PointsMaterial({ map:softDot, color:0x1e3aff, size:0.3, transparent:true, opacity:0.6, depthWrite:false, blending:THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    let age = 0;
    const vel = Array.from({length:count}, ()=> new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2));
    function anim(){
      age += 0.016;
      const arr = pts.geometry.attributes.position.array;
      for (let i=0;i<count;i++){
        arr[i*3]   += vel[i].x*0.016;
        arr[i*3+1] += vel[i].y*0.016;
        arr[i*3+2] += vel[i].z*0.016;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pts.material.opacity = Math.max(0, 0.6 - age*1.2);
      if (age < 0.5) requestAnimationFrame(anim); else scene.remove(pts);
    }
    requestAnimationFrame(anim);
  }

  function bindInput(){
    pullBtn.addEventListener("touchstart", e=>{ e.preventDefault(); pull(); }, {passive:false});
    pullBtn.addEventListener("mousedown", pull);
    window.addEventListener("keydown", e=>{
      if (!screens["screen-round3"].classList.contains("active")) return;
      if (e.code === "Space"){ e.preventDefault(); pull(); }
    });
  }
  let inputBound = false;

  function finish(won){
    if (ended) return;
    ended = true;
    running = false;
    camShake = 0.3;
    if (!won){
      vignette.classList.add("on");
      setTimeout(()=> vignette.classList.remove("on"), 300);
      Sound.eliminate();
    }
    setTimeout(()=> goToResult(won, 3), 700);
  }

  let lastT = 0;
  function loop(ts){
    if (!lastT) lastT = ts;
    const dt = Math.min((ts-lastT)/1000, 0.05);
    lastT = ts;

    if (running){
      // rival AI: continuous pull with rising intensity + randomness
      const rivalPull = 0.34 + (15-timeLeft)*0.02 + Math.random()*0.28;
      velocity -= rivalPull*dt*1.4;
      // player's taps already added to velocity in pull()
      velocity *= 0.90; // damping
      tension += velocity*dt;
      tension = Math.max(-1.15, Math.min(1.15, tension));
      updateRope();

      timeLeft -= dt;
      if (timeLeft <= 0){
        timeLeft = 0;
        finish(tension >= 0);
      } else if (tension <= -1){
        finish(false);
      } else if (tension >= 1){
        finish(true);
      }
      timeEl.textContent = Math.ceil(timeLeft);
    }

    if (camShake > 0) camShake = Math.max(0, camShake - dt*0.8);
    const shakeX = camShake ? (Math.random()*2-1)*camShake : 0;
    camera.position.set(9+shakeX, 5, 3);
    camera.lookAt(0, 0.6, -2);
    if (dust) dust.update(dt);

    // idle sway for team sprites (life/juice)
    const t = ts*0.001;
    allies.forEach((s,i)=> s.position.y = 1.1 + Math.sin(t*3+i)*0.04);
    rivals.forEach((s,i)=> s.position.y = 1.05 + Math.sin(t*3+i+1)*0.04);

    renderer.render(scene, camera);
    if (screens["screen-round3"].classList.contains("active")) requestAnimationFrame(loop);
  }

  function start(){
    if (!renderer) initScene();
    if (!inputBound){ bindInput(); inputBound = true; }
    resize();
    clearTeams();
    allies = makeTeam(PLAYER_SIDE_Z, -1, true);
    rivals = makeTeam(RIVAL_SIDE_Z, 1, false);
    tension = 0; velocity = 0; timeLeft = 15; ended = false; camShake = 0;
    updateRope();
    survivorsEl.textContent = state.survivors;
    timeEl.textContent = "15";
    running = true;
    lastT = 0;
    requestAnimationFrame(loop);
  }

  return { start };
})();

})();
