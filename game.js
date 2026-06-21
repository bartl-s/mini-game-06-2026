// 🦆 DUCKY FLOAT — SKAILE Academy Building Challenge #1
// Ein Pixel-Art Flappy-Spiel. Halt die Gummiente mit Taps über Wasser.
// ---------------------------------------------------------------------------
// Schritt 1: Fundament — Canvas, Game-Loop, State-Machine, Input.
// Schritt 2: Gummiente — Pixel-Sprite + Physik (Schwerkraft / Auftrieb).

"use strict";

// --- Canvas ----------------------------------------------------------------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false; // harte Pixel, kein Anti-Aliasing

const W = canvas.width; // 288
const H = canvas.height; // 512

// --- Spielzustände ---------------------------------------------------------
const STATE = { MENU: "menu", PLAY: "play", OVER: "over" };
let state = STATE.MENU;

// --- Globale Spielzeit (für Animationen) -----------------------------------
let ticks = 0;

// --- Punkte ----------------------------------------------------------------
let score = 0;
let best = loadBest();
let newBest = false; // im letzten Lauf neuen Highscore erreicht?

// Medaillen-Stufen nach Score (großzügig, da das Spiel jetzt sanfter ist).
const MEDALS = [
  { min: 40, name: "GOLD", face: "#ffe066", ring: "#c8961f", text: "#7a5a00" },
  { min: 25, name: "SILBER", face: "#e2e8ee", ring: "#9aa7b4", text: "#4a5560" },
  { min: 12, name: "BRONZE", face: "#e09a5a", ring: "#a5642e", text: "#5a3210" },
];
function medalFor(s) {
  for (const m of MEDALS) if (s >= m.min) return m;
  return null;
}

function loadBest() {
  try {
    return parseInt(localStorage.getItem("duckyfloat_best") || "0", 10) || 0;
  } catch (e) {
    return 0;
  }
}
function saveBest() {
  try {
    localStorage.setItem("duckyfloat_best", String(best));
  } catch (e) {
    /* localStorage evtl. blockiert — egal */
  }
}

// ===========================================================================
// GUMMIENTE
// ===========================================================================
// Sprite als Pixel-Grid (16x16). Jeder Buchstabe ist ein Farb-Pixel, das beim
// Zeichnen auf PX Canvas-Einheiten vergrößert wird -> chunky Retro-Look.
const DUCK_PX = 3; // Pixelgröße der Ente
const DUCK_SPRITE = [
  "......oooo......",
  ".....oBBBBo.....",
  "....oBBBBBBo....",
  "...oBBHHBBBBo...",
  "...oBHHBBBBBo...",
  "...oBBBBeeBBoo..",
  "...oBBBBepBBobbo",
  "...oBBBBBBBBoddo",
  "..oBBBBBBBBBBoo.",
  ".oBBBBBBBBBBBBo.",
  "oBBBwwBBBBBBBBBo",
  "oBBwSSwBBBBBBBBo",
  "oBBwSSSwBBBBBBBo",
  ".oBBwSSSwBBBBBo.",
  "..oBBBBBBBBBBBo.",
  "...ooooooooooo..",
];
const DUCK_COLORS = {
  o: "#2a2410", // Outline
  B: "#ffd23f", // Körper
  S: "#e3a82a", // Schatten
  H: "#fff0b8", // Glanzlicht
  e: "#ffffff", // Augweiß
  p: "#1a1428", // Pupille
  b: "#ff8c1a", // Schnabel
  d: "#e06b00", // Schnabel-Schatten
  w: "#c8901f", // Flügel-Linie
};

// Physik-Parameter (bewusst sanft & verzeihend abgestimmt)
const GRAVITY = 0.30; // floatiger Fall
const FLAP_VELOCITY = -5.2; // weicherer Sprung (kein harter Schubser)
const MAX_FALL = 7.5; // begrenzt das Tempo nach unten
const DUCK_X = 86; // feste horizontale Position
const DUCK_R = 12; // Kollisionsradius (kleiner als Sprite = fair)

const duck = {
  y: H / 2,
  vy: 0,
};

function resetDuck() {
  duck.y = H / 2;
  duck.vy = 0;
}

function flapDuck() {
  duck.vy = FLAP_VELOCITY;
}

function updateDuck() {
  duck.vy += GRAVITY;
  if (duck.vy > MAX_FALL) duck.vy = MAX_FALL;
  duck.y += duck.vy;
}

// Zeichnet die Ente an (cx, cy) mit Rotation und optionaler Pixelgröße.
function drawDuck(cx, cy, angle, px) {
  px = px || DUCK_PX;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const off = (DUCK_SPRITE.length * px) / 2;
  for (let row = 0; row < DUCK_SPRITE.length; row++) {
    const line = DUCK_SPRITE[row];
    for (let col = 0; col < line.length; col++) {
      const c = line[col];
      if (c === ".") continue;
      ctx.fillStyle = DUCK_COLORS[c];
      ctx.fillRect(col * px - off, row * px - off, px, px);
    }
  }
  ctx.restore();
}

// Neigung der Ente aus ihrer Vertikalgeschwindigkeit ableiten.
function duckAngle() {
  const t = (duck.vy - FLAP_VELOCITY) / (MAX_FALL - FLAP_VELOCITY); // 0..1
  const deg = -22 + t * (70 + 22); // -22° (steigt) bis +70° (fällt)
  return (Math.max(-22, Math.min(70, deg)) * Math.PI) / 180;
}

// ===========================================================================
// HINDERNISSE (Badezimmer-Rohre)
// ===========================================================================
const FLOOR_H = 56; // Höhe des Bodens (Wasser/Fliesen) unten
const PIPE_W = 54; // Breite eines Rohrs
const RIM_H = 16; // Höhe der Rohr-Kappe an der Lücke
const RIM_OVER = 5; // wie weit die Kappe seitlich übersteht

// Schwierigkeit (steigt langsam & sanft mit dem Score)
const BASE_SPEED = 1.75; // Start-Scroll-Tempo (langsamer Einstieg)
const BASE_GAP = 172; // große Start-Lücke
let pipeSpeed = BASE_SPEED;
let gapH = BASE_GAP;
const SPAWN_X = W + 40; // Startposition rechts außerhalb
const SPAWN_GAP_PX = 192; // mehr Abstand = mehr Reaktionszeit

let pipes = [];
let spawnAcc = 0;

function resetPipes() {
  pipes = [];
  spawnAcc = 0;
  pipeSpeed = BASE_SPEED;
  gapH = BASE_GAP;
}

function spawnPipe() {
  const minGapY = 46;
  const maxGapY = H - FLOOR_H - gapH - 46;
  const gapY = minGapY + Math.random() * (maxGapY - minGapY);
  const p = { x: SPAWN_X, gapY, passed: false };
  pipes.push(p);
  maybeSpawnToken(p);
}

function updatePipes() {
  // Tempo-basiertes Spawnen, damit der Abstand bei Tempoänderung konstant bleibt.
  spawnAcc += pipeSpeed;
  if (pipes.length === 0 || spawnAcc >= SPAWN_GAP_PX) {
    spawnPipe();
    spawnAcc = 0;
  }
  for (const p of pipes) p.x -= pipeSpeed;
  // alte Rohre entfernen
  pipes = pipes.filter((p) => p.x + PIPE_W > -RIM_OVER);
}

// Ein Rohr-Segment im Pixel-Chrom-Look zeichnen.
function drawPipeSegment(x, y, h) {
  // Korpus mit vertikalem Verlauf (links dunkel, Mitte hell -> Chrom-Glanz)
  ctx.fillStyle = "#8fa6b8";
  ctx.fillRect(x, y, PIPE_W, h);
  ctx.fillStyle = "#c6d6e2"; // Glanzstreifen
  ctx.fillRect(x + 8, y, 10, h);
  ctx.fillStyle = "#eef6fb"; // heller Highlight
  ctx.fillRect(x + 10, y, 4, h);
  ctx.fillStyle = "#5f7488"; // rechte Schattenkante
  ctx.fillRect(x + PIPE_W - 8, y, 8, h);
  ctx.fillStyle = "#3f5060"; // Außenlinie links/rechts
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + PIPE_W - 3, y, 3, h);
}

// Kappe (Rim) an der Lücken-Seite.
function drawPipeRim(x, yTop) {
  const rx = x - RIM_OVER;
  const rw = PIPE_W + RIM_OVER * 2;
  ctx.fillStyle = "#8fa6b8";
  ctx.fillRect(rx, yTop, rw, RIM_H);
  ctx.fillStyle = "#c6d6e2";
  ctx.fillRect(rx + 8, yTop, 12, RIM_H);
  ctx.fillStyle = "#eef6fb";
  ctx.fillRect(rx + 10, yTop, 5, RIM_H);
  ctx.fillStyle = "#5f7488";
  ctx.fillRect(rx + rw - 10, yTop, 10, RIM_H);
  ctx.fillStyle = "#3f5060";
  ctx.fillRect(rx, yTop, 3, RIM_H);
  ctx.fillRect(rx + rw - 3, yTop, 3, RIM_H);
  ctx.fillRect(rx, yTop, rw, 2); // obere/untere Linie
  ctx.fillRect(rx, yTop + RIM_H - 2, rw, 2);
}

// Kreis (Ente) gegen Rechteck testen.
function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Prüft Kollision der Ente mit irgendeinem Rohr.
function duckHitsPipe() {
  for (const p of pipes) {
    // nur Rohre in der Nähe der Ente prüfen
    if (p.x + PIPE_W < DUCK_X - DUCK_R || p.x > DUCK_X + DUCK_R) continue;
    const topH = p.gapY;
    const botY = p.gapY + gapH;
    const botH = H - FLOOR_H - botY;
    if (circleHitsRect(DUCK_X, duck.y, DUCK_R, p.x, 0, PIPE_W, topH)) return true;
    if (circleHitsRect(DUCK_X, duck.y, DUCK_R, p.x, botY, PIPE_W, botH)) return true;
  }
  return false;
}

// Score erhöhen, wenn die Ente ein Rohr passiert hat.
function updateScore() {
  for (const p of pipes) {
    if (!p.passed && p.x + PIPE_W < DUCK_X) {
      p.passed = true;
      score++;
      sndPoint();
    }
  }
}

function drawPipes() {
  for (const p of pipes) {
    const topH = p.gapY;
    const botY = p.gapY + gapH;
    const botH = H - FLOOR_H - botY;
    // oberes Rohr
    drawPipeSegment(p.x, 0, topH - RIM_H);
    drawPipeRim(p.x, topH - RIM_H);
    // unteres Rohr
    drawPipeRim(p.x, botY);
    drawPipeSegment(p.x, botY + RIM_H, botH - RIM_H);
  }
}

// ===========================================================================
// HINTERGRUND (Badezimmer-Fliesen + Parallax-Blasen)
// ===========================================================================
const TILE = 36; // Fliesengröße
let bgScroll = 0; // Parallax-Versatz der Fliesenwand

// Seifenblasen als sanfte Parallax-Deko (driften nach oben).
const bubbles = [];
function initBubbles() {
  for (let i = 0; i < 14; i++) {
    bubbles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 2 + Math.random() * 5,
      spd: 0.2 + Math.random() * 0.5,
      drift: Math.random() * Math.PI * 2,
    });
  }
}
initBubbles();

function updateBubbles() {
  for (const b of bubbles) {
    b.y -= b.spd;
    b.drift += 0.04;
    b.x += Math.sin(b.drift) * 0.3;
    if (b.y + b.r < 0) {
      b.y = H + b.r;
      b.x = Math.random() * W;
    }
  }
}

function drawBackground() {
  // Grundfarbe der Wand
  ctx.fillStyle = "#86cdda";
  ctx.fillRect(0, 0, W, H);

  // Fliesenraster mit leichtem Schachbrett-Ton + Fugen
  const off = Math.floor(bgScroll) % TILE;
  for (let ty = -1; ty * TILE < H + TILE; ty++) {
    for (let tx = -1; tx * TILE - off < W + TILE; tx++) {
      const x = tx * TILE - off;
      const y = ty * TILE;
      const checker = (tx + ty) % 2 === 0;
      ctx.fillStyle = checker ? "#8ed3df" : "#7ec5d3";
      ctx.fillRect(x, y, TILE, TILE);
      // sanftes Glanzlicht oben links jeder Fliese
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + 2, y + 2, TILE - 10, 3);
    }
  }
  // Fugenlinien
  ctx.fillStyle = "rgba(70,160,180,0.45)";
  for (let tx = -1; tx * TILE - off < W + TILE; tx++) {
    ctx.fillRect(tx * TILE - off, 0, 2, H);
  }
  for (let ty = 0; ty * TILE < H; ty++) {
    ctx.fillRect(0, ty * TILE, W, 2);
  }

  // Blasen
  for (const b of bubbles) {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.4, 1.5, 1.5);
  }
}

// ===========================================================================
// BONUS-ENTE (goldenes Sammelobjekt in manchen Lücken)
// ===========================================================================
const TOKEN_R = 11; // Einsammel-Radius
const TOKEN_BONUS = 3; // Extrapunkte
let tokens = [];

function resetTokens() {
  tokens = [];
}

// Beim Spawnen eines Rohrs ggf. eine Bonus-Ente in die Lückenmitte setzen.
function maybeSpawnToken(p) {
  if (Math.random() < 0.4) {
    tokens.push({
      x: p.x + PIPE_W / 2,
      y: p.gapY + gapH / 2,
      taken: false,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function updateTokens() {
  for (const t of tokens) {
    t.x -= pipeSpeed;
    t.phase += 0.12;
    // Einsammeln, wenn die Ente nah genug ist
    const dx = t.x - DUCK_X;
    const dy = t.y - duck.y;
    if (!t.taken && dx * dx + dy * dy < (TOKEN_R + DUCK_R) * (TOKEN_R + DUCK_R)) {
      t.taken = true;
      score += TOKEN_BONUS;
      spawnSparkle(t.x, t.y);
      sndCoin();
    }
  }
  tokens = tokens.filter((t) => !t.taken && t.x + TOKEN_R > -4);
}

function drawTokens() {
  for (const t of tokens) {
    const pulse = 1 + Math.sin(t.phase) * 0.12;
    ctx.save();
    ctx.translate(t.x, t.y);
    // goldener Glow-Ring
    ctx.globalAlpha = 0.35 + Math.sin(t.phase) * 0.15;
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.arc(0, 0, (TOKEN_R + 4) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    // kleine Ente
    drawDuck(t.x, t.y, Math.sin(t.phase) * 0.15, 2);
    // Funkel-Sternchen oben rechts
    const sx = t.x + 9 + Math.cos(t.phase) * 2;
    const sy = t.y - 10 + Math.sin(t.phase) * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sx - 1, sy - 3, 2, 6);
    ctx.fillRect(sx - 3, sy - 1, 6, 2);
  }
}

// ===========================================================================
// EFFEKTE (Partikel + Screen-Shake)
// ===========================================================================
let particles = [];
let shakeT = 0; // verbleibende Frames Screen-Shake

function spawnSplash(x, y) {
  // kleine Wassertropfen beim Flap, nach hinten/unten spritzend
  for (let i = 0; i < 5; i++) {
    particles.push({
      x,
      y,
      vx: -1 - Math.random() * 1.5,
      vy: 0.5 - Math.random() * 2,
      life: 18 + Math.random() * 10,
      max: 28,
      size: 2 + Math.random() * 2,
      color: "#bdeaf6",
    });
  }
}

function spawnBurst(x, y) {
  // Feder-/Wasser-Explosion beim Crash
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 3.5;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 1,
      life: 24 + Math.random() * 18,
      max: 42,
      size: 2 + Math.random() * 3,
      color: Math.random() < 0.5 ? "#ffd23f" : "#ffffff",
    });
  }
}

// Goldenes Konfetti für die NEW-BEST-Feier (regnet von oben).
const CONFETTI_COLORS = ["#ffd23f", "#ff8c1a", "#ffffff", "#ff5d8f", "#5fc3e0"];
function spawnConfetti() {
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * W,
      y: -10 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1 + Math.random() * 2.5,
      life: 90 + Math.random() * 60,
      max: 150,
      size: 3 + Math.random() * 3,
      color: CONFETTI_COLORS[(i * 7) % CONFETTI_COLORS.length],
      grav: 0.05,
    });
  }
}

// Funkel-Sternchen beim Einsammeln der Bonus-Ente.
function spawnSparkle(x, y) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 2.5;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 20 + Math.random() * 16,
      max: 36,
      size: 2 + Math.random() * 2,
      color: Math.random() < 0.5 ? "#fff7c4" : "#ffd23f",
      grav: 0.02,
    });
  }
}

function updateParticles() {
  for (const p of particles) {
    p.vy += p.grav !== undefined ? p.grav : 0.18; // Schwerkraft
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }
  particles = particles.filter((p) => p.life > 0);
  if (shakeT > 0) shakeT--;
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ===========================================================================
// SOUND (synthetisiert via Web Audio API — keine externen Dateien)
// ===========================================================================
let audioCtx = null;
let muted = loadMuted();

function loadMuted() {
  try {
    return localStorage.getItem("duckyfloat_muted") === "1";
  } catch (e) {
    return false;
  }
}
function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem("duckyfloat_muted", muted ? "1" : "0");
  } catch (e) {}
}

// AudioContext darf erst nach einer Nutzergeste erzeugt werden.
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

// Ein Ton mit Hüllkurve und optionalem Frequenz-Sweep.
function tone(freq, freqTo, dur, type, vol, startAt) {
  if (!audioCtx || muted) return;
  const t0 = audioCtx.currentTime + (startAt || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqTo && freqTo !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Gummienten-Quietschen: kurzer Chirp hoch-runter.
function sndSqueak() {
  tone(1100, 1500, 0.07, "square", 0.12, 0);
  tone(1500, 950, 0.07, "square", 0.1, 0.06);
}
// Punkt: helles Zwei-Ton-Bling.
function sndPoint() {
  tone(880, 880, 0.07, "square", 0.12, 0);
  tone(1320, 1320, 0.1, "square", 0.12, 0.07);
}
// Münze / Bonus-Ente: helles aufsteigendes Arpeggio.
function sndCoin() {
  tone(988, 988, 0.06, "square", 0.11, 0);
  tone(1319, 1319, 0.06, "square", 0.11, 0.05);
  tone(1760, 1760, 0.1, "square", 0.11, 0.1);
}
// Fanfare bei neuem Highscore.
function sndFanfare() {
  tone(523, 523, 0.1, "square", 0.11, 0);
  tone(659, 659, 0.1, "square", 0.11, 0.1);
  tone(784, 784, 0.1, "square", 0.11, 0.2);
  tone(1047, 1047, 0.22, "square", 0.12, 0.3);
}
// Crash: kurzer Rausch-Knall + absteigender Ton.
function sndCrash() {
  if (!audioCtx || muted) return;
  tone(320, 50, 0.32, "sawtooth", 0.16, 0);
  // Rauschburst
  const t0 = audioCtx.currentTime;
  const len = Math.floor(audioCtx.sampleRate * 0.18);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  src.connect(g).connect(audioCtx.destination);
  src.start(t0);
}

// ===========================================================================
// EINGABE
// ===========================================================================
let overLockUntil = 0; // verhindert versehentlichen Sofort-Neustart

function flap() {
  ensureAudio();
  if (state === STATE.MENU) {
    startGame();
  } else if (state === STATE.PLAY) {
    flapDuck();
    sndSqueak();
    spawnSplash(DUCK_X - 12, duck.y + 8);
  } else if (state === STATE.OVER) {
    if (ticks >= overLockUntil) startGame();
  }
}

function startGame() {
  resetDuck();
  resetPipes();
  resetTokens();
  particles = [];
  shakeT = 0;
  score = 0;
  newBest = false;
  flapDuck(); // kleiner Anschub beim Start
  state = STATE.PLAY;
}

// Schwierigkeit steigt langsam mit dem Score: leicht schneller + etwas engere
// Lücke, mit großzügigen Untergrenzen, damit es fair bleibt.
function applyDifficulty() {
  pipeSpeed = BASE_SPEED + Math.min(score * 0.022, 1.25);
  gapH = Math.max(140, BASE_GAP - score * 0.7);
}

function gameOver() {
  if (state !== STATE.PLAY) return;
  state = STATE.OVER;
  overLockUntil = ticks + 36; // ~0.6 s Sperre gegen Sofort-Neustart
  sndCrash();
  spawnBurst(DUCK_X, duck.y);
  shakeT = 16;
  if (score > best && score > 0) {
    best = score;
    newBest = true;
    saveBest();
    spawnConfetti();
    sndFanfare();
  }
}

// Bereich des Lautsprecher-Icons (oben rechts).
const MUTE_BTN = { x: W - 30, y: 8, w: 22, h: 20 };
function pointInMuteBtn(px, py) {
  return (
    px >= MUTE_BTN.x - 4 &&
    px <= MUTE_BTN.x + MUTE_BTN.w + 4 &&
    py >= MUTE_BTN.y - 4 &&
    py <= MUTE_BTN.y + MUTE_BTN.h + 4
  );
}

// Canvas-Koordinaten aus einem Pointer-Event (berücksichtigt CSS-Skalierung).
function canvasPos(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * W,
    y: ((clientY - r.top) / r.height) * H,
  };
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    flap();
  } else if (e.code === "KeyM") {
    toggleMute();
  }
});
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const p = canvasPos(e.clientX, e.clientY);
  if (pointInMuteBtn(p.x, p.y)) {
    ensureAudio();
    toggleMute();
    return;
  }
  flap();
});
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const p = canvasPos(t.clientX, t.clientY);
    if (pointInMuteBtn(p.x, p.y)) {
      ensureAudio();
      toggleMute();
      return;
    }
    flap();
  },
  { passive: false }
);

// ===========================================================================
// RENDER-HELFER
// ===========================================================================
function pixelText(text, x, y, size, color, align = "center") {
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a1428";
  ctx.fillText(text, x + 1, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ===========================================================================
// UPDATE / DRAW
// ===========================================================================
function update() {
  ticks++;
  updateBubbles();
  updateParticles();
  if (state === STATE.PLAY) {
    applyDifficulty();
    bgScroll += pipeSpeed * 0.3; // dezenter Parallax-Effekt
    updateDuck();
    updatePipes();
    updateTokens();
    updateScore();
    // Decke: anstoßen, aber nicht sterben (klassisches Flappy-Verhalten)
    if (duck.y < DUCK_R) {
      duck.y = DUCK_R;
      if (duck.vy < 0) duck.vy = 0;
    }
    // Boden = Game Over
    if (duck.y > H - FLOOR_H - DUCK_R) {
      duck.y = H - FLOOR_H - DUCK_R;
      gameOver();
    } else if (duckHitsPipe()) {
      gameOver();
    }
  }
}

// Boden zeichnen: Wasserbecken mit Wellen-Oberfläche und scrollenden Fliesen.
function drawFloor() {
  const top = H - FLOOR_H;
  // Wasserkörper
  ctx.fillStyle = "#34a6cf";
  ctx.fillRect(0, top, W, FLOOR_H);
  ctx.fillStyle = "#2b8fb8";
  ctx.fillRect(0, top + 14, W, FLOOR_H - 14);
  // Wellen-Oberfläche (kleine Pixel-Wellen)
  const ph = Math.floor(bgScroll) % 12;
  ctx.fillStyle = "#bdeaf6";
  for (let x = -12; x < W + 12; x += 12) {
    ctx.fillRect(x - ph, top, 6, 3);
  }
  ctx.fillStyle = "#5fc3e0";
  for (let x = -12; x < W + 12; x += 12) {
    ctx.fillRect(x - ph + 6, top + 3, 6, 2);
  }
  // Boden-Fliesenkante ganz unten
  ctx.fillStyle = "#1f6f93";
  ctx.fillRect(0, H - 6, W, 6);
}

function draw() {
  // Screen-Shake: gesamte Szene leicht versetzt zeichnen.
  ctx.save();
  if (shakeT > 0) {
    const m = (shakeT / 16) * 6;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  drawBackground();

  if (state === STATE.MENU) {
    drawFloor();
    // Ente schwebt sanft auf und ab
    const bob = Math.sin(ticks / 18) * 6;
    drawDuck(W / 2, H / 2 - 44 + bob, Math.sin(ticks / 18) * 0.08);
    pixelText("DUCKY FLOAT", W / 2, H / 2 + 36, 24, "#ffd23f");
    pixelText("BEST  " + best, W / 2, H / 2 + 66, 12, "#1a1428");
    if (Math.floor(ticks / 30) % 2 === 0) {
      pixelText("TAP ZUM START", W / 2, H / 2 + 100, 14, "#1a1428");
    }
  } else if (state === STATE.PLAY) {
    drawPipes();
    drawTokens();
    drawFloor();
    drawParticles();
    drawDuck(DUCK_X, duck.y, duckAngle());
    pixelText(String(score), W / 2, 54, 40, "#ffffff");
  } else if (state === STATE.OVER) {
    drawPipes();
    drawTokens();
    drawFloor();
    drawParticles();
    drawDuck(DUCK_X, duck.y, duckAngle());
    drawGameOver();
  }

  ctx.restore();
  drawMuteIcon(); // Icon ohne Shake, immer ruhig
}

// Lautsprecher-Icon (klein, oben rechts). Zeigt an/aus.
function drawMuteIcon() {
  const x = MUTE_BTN.x;
  const y = MUTE_BTN.y;
  ctx.save();
  // Box-Hintergrund für Lesbarkeit
  ctx.fillStyle = "rgba(26,20,40,0.35)";
  ctx.fillRect(x - 4, y - 3, MUTE_BTN.w + 8, MUTE_BTN.h + 6);
  ctx.fillStyle = "#ffffff";
  // Lautsprecher-Korpus
  ctx.fillRect(x, y + 6, 5, 8);
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 10);
  ctx.lineTo(x + 12, y + 3);
  ctx.lineTo(x + 12, y + 17);
  ctx.lineTo(x + 5, y + 10);
  ctx.fill();
  if (muted) {
    // rotes Kreuz
    ctx.strokeStyle = "#e23b3b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 4);
    ctx.lineTo(x + 21, y + 16);
    ctx.moveTo(x + 21, y + 4);
    ctx.lineTo(x + 14, y + 16);
    ctx.stroke();
  } else {
    // Schallwellen
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 13, y + 10, 4, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 13, y + 10, 7, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

// Game-Over-Panel mit Score & Highscore.
// Medaillen-Scheibe mit Band, Glanz und Stern.
function drawMedal(cx, cy, r, medal) {
  // Bänder hinter der Medaille
  ctx.fillStyle = "#e23b3b";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy - r);
  ctx.lineTo(cx - r * 0.2, cy - r * 1.8);
  ctx.lineTo(cx + r * 0.1, cy - r * 0.7);
  ctx.fill();
  ctx.fillStyle = "#3a86d0";
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.7, cy - r);
  ctx.lineTo(cx + r * 0.2, cy - r * 1.8);
  ctx.lineTo(cx - r * 0.1, cy - r * 0.7);
  ctx.fill();
  // Ring
  ctx.fillStyle = medal.ring;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Scheibe
  ctx.fillStyle = medal.face;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.fill();
  // Glanz-Sichel
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.25, r - 6, Math.PI * 0.9, Math.PI * 1.6);
  ctx.fill();
  // Stern in der Mitte
  pixelText("★", cx, cy + 1, r, medal.text);
}

function drawGameOver() {
  // halbtransparenter Overlay
  ctx.fillStyle = "rgba(26, 20, 40, 0.55)";
  ctx.fillRect(0, 0, W, H);
  // Panel
  const medal = medalFor(score);
  const pw = 212;
  const ph = 196;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2 - 6;
  ctx.fillStyle = "#fff0b8";
  ctx.fillRect(px - 3, py - 3, pw + 6, ph + 6);
  ctx.fillStyle = "#2a2140";
  ctx.fillRect(px, py, pw, ph);

  pixelText("GAME OVER", W / 2, py + 30, 22, "#e23b3b");

  if (medal) {
    // Medaille links, Werte rechts
    drawMedal(px + 52, py + 96, 28, medal);
    pixelText(medal.name, px + 52, py + 138, 12, medal.face);
    const rx = px + 128;
    pixelText("SCORE", rx, py + 66, 12, "#b8a8d8", "center");
    pixelText(String(score), rx, py + 90, 26, "#ffd23f", "center");
    pixelText("BEST", rx, py + 120, 12, "#b8a8d8", "center");
    pixelText(String(best), rx, py + 140, 20, "#7ec8d6", "center");
  } else {
    // ohne Medaille: zentriert
    pixelText("SCORE", W / 2, py + 70, 14, "#b8a8d8");
    pixelText(String(score), W / 2, py + 98, 30, "#ffd23f");
    pixelText("BEST  " + best, W / 2, py + 138, 14, "#7ec8d6");
  }

  // NEW-BEST-Banner (pulsierend)
  if (newBest) {
    const s = 1 + Math.sin(ticks / 6) * 0.08;
    ctx.save();
    ctx.translate(W / 2, py + 168);
    ctx.scale(s, s);
    ctx.fillStyle = "#e23b3b";
    ctx.fillRect(-72, -12, 144, 24);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-72, -12, 144, 3);
    ctx.fillRect(-72, 9, 144, 3);
    pixelText("★ NEW BEST ★", 0, 1, 14, "#ffffff");
    ctx.restore();
  }

  if (Math.floor(ticks / 30) % 2 === 0) {
    pixelText("TAP FÜR NEUSTART", W / 2, py + ph + 22, 12, "#ffffff");
  }
}

// ===========================================================================
// GAME-LOOP (feste Logik-Rate, smoothes Rendering)
// ===========================================================================
let last = 0;
let acc = 0;
const STEP = 1000 / 60;

function loop(now) {
  if (!last) last = now;
  acc += now - last;
  last = now;
  if (acc > 250) acc = 250;
  while (acc >= STEP) {
    update();
    acc -= STEP;
  }
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
