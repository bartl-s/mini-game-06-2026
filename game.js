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

// Physik-Parameter
const GRAVITY = 0.42;
const FLAP_VELOCITY = -6.6;
const MAX_FALL = 9.5;
const DUCK_X = 86; // feste horizontale Position
const DUCK_R = 13; // Kollisionsradius (etwas kleiner als Sprite = fair)

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

// Zeichnet die Ente an (cx, cy) mit Rotation abhängig von der Geschwindigkeit.
function drawDuck(cx, cy, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const off = (DUCK_SPRITE.length * DUCK_PX) / 2;
  for (let row = 0; row < DUCK_SPRITE.length; row++) {
    const line = DUCK_SPRITE[row];
    for (let col = 0; col < line.length; col++) {
      const c = line[col];
      if (c === ".") continue;
      ctx.fillStyle = DUCK_COLORS[c];
      ctx.fillRect(col * DUCK_PX - off, row * DUCK_PX - off, DUCK_PX, DUCK_PX);
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

// Schwierigkeit (wird in Schritt 7 dynamisch erhöht)
let pipeSpeed = 2.1; // Scroll-Tempo
let gapH = 142; // Lückenhöhe
const SPAWN_X = W + 40; // Startposition rechts außerhalb
const SPAWN_GAP_PX = 168; // horizontaler Abstand zwischen Rohren

let pipes = [];
let spawnAcc = 0;

function resetPipes() {
  pipes = [];
  spawnAcc = 0;
  pipeSpeed = 2.1;
  gapH = 142;
}

function spawnPipe() {
  const minGapY = 46;
  const maxGapY = H - FLOOR_H - gapH - 46;
  const gapY = minGapY + Math.random() * (maxGapY - minGapY);
  pipes.push({ x: SPAWN_X, gapY, passed: false });
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
// EINGABE
// ===========================================================================
let overLockUntil = 0; // verhindert versehentlichen Sofort-Neustart

function flap() {
  if (state === STATE.MENU) {
    startGame();
  } else if (state === STATE.PLAY) {
    flapDuck();
  } else if (state === STATE.OVER) {
    if (ticks >= overLockUntil) startGame();
  }
}

function startGame() {
  resetDuck();
  resetPipes();
  flapDuck(); // kleiner Anschub beim Start
  state = STATE.PLAY;
}

function gameOver() {
  state = STATE.OVER;
  overLockUntil = ticks + 30; // ~0.5 s Sperre
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    flap();
  }
});
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  flap();
});
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
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
  if (state === STATE.PLAY) {
    updateDuck();
    updatePipes();
    // Boden / Decke beenden das Spiel erst ab Schritt 4 sauber; vorerst clampen.
    if (duck.y > H - FLOOR_H - DUCK_R) {
      duck.y = H - FLOOR_H - DUCK_R;
      duck.vy = 0;
    }
    if (duck.y < 0) {
      duck.y = 0;
      duck.vy = 0;
    }
  }
}

// Boden zeichnen (Platzhalter — Detail folgt in Schritt 5).
function drawFloor() {
  ctx.fillStyle = "#3aa0c8";
  ctx.fillRect(0, H - FLOOR_H, W, FLOOR_H);
  ctx.fillStyle = "#2c86a8";
  ctx.fillRect(0, H - FLOOR_H, W, 4);
}

function draw() {
  // Hintergrund (Platzhalter — echtes Badezimmer folgt in Schritt 5)
  ctx.fillStyle = "#7ec8d6";
  ctx.fillRect(0, 0, W, H);

  if (state === STATE.MENU) {
    drawFloor();
    // Ente schwebt sanft auf und ab
    const bob = Math.sin(ticks / 18) * 6;
    drawDuck(W / 2, H / 2 - 40 + bob, Math.sin(ticks / 18) * 0.08);
    pixelText("DUCKY FLOAT", W / 2, H / 2 + 40, 24, "#ffd23f");
    if (Math.floor(ticks / 30) % 2 === 0) {
      pixelText("TAP ZUM START", W / 2, H / 2 + 90, 14, "#1a1428");
    }
  } else if (state === STATE.PLAY) {
    drawPipes();
    drawFloor();
    drawDuck(DUCK_X, duck.y, duckAngle());
  } else if (state === STATE.OVER) {
    drawPipes();
    drawFloor();
    drawDuck(DUCK_X, duck.y, duckAngle());
    pixelText("GAME OVER", W / 2, H / 2, 20, "#e23b3b");
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
