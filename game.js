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
    // Boden / Decke beenden das Spiel erst ab Schritt 4 sauber; vorerst clampen.
    if (duck.y > H - 40) {
      duck.y = H - 40;
      duck.vy = 0;
    }
    if (duck.y < 0) {
      duck.y = 0;
      duck.vy = 0;
    }
  }
}

function draw() {
  // Hintergrund (Platzhalter — echtes Badezimmer folgt in Schritt 5)
  ctx.fillStyle = "#7ec8d6";
  ctx.fillRect(0, 0, W, H);

  if (state === STATE.MENU) {
    // Ente schwebt sanft auf und ab
    const bob = Math.sin(ticks / 18) * 6;
    drawDuck(W / 2, H / 2 - 40 + bob, Math.sin(ticks / 18) * 0.08);
    pixelText("DUCKY FLOAT", W / 2, H / 2 + 40, 24, "#ffd23f");
    if (Math.floor(ticks / 30) % 2 === 0) {
      pixelText("TAP ZUM START", W / 2, H / 2 + 90, 14, "#1a1428");
    }
  } else if (state === STATE.PLAY) {
    drawDuck(DUCK_X, duck.y, duckAngle());
  } else if (state === STATE.OVER) {
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
