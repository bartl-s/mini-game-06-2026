// 🦆 DUCKY FLOAT — SKAILE Academy Building Challenge #1
// Ein Pixel-Art Flappy-Spiel. Halt die Gummiente mit Taps über Wasser.
// ---------------------------------------------------------------------------
// Schritt 1: Fundament — Canvas, Game-Loop, State-Machine, Input.

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

// --- Eingabe ---------------------------------------------------------------
// "flap()" ist die einzige Spielaktion: im Menü startet sie, im Spiel lässt
// sie die Ente auftauchen, im Game-Over startet sie (nach kurzer Sperre) neu.
let overLockUntil = 0; // verhindert versehentlichen Sofort-Neustart

function flap() {
  if (state === STATE.MENU) {
    startGame();
  } else if (state === STATE.PLAY) {
    // wird in Schritt 2 mit Physik gefüllt
  } else if (state === STATE.OVER) {
    if (ticks >= overLockUntil) startGame();
  }
}

function startGame() {
  state = STATE.PLAY;
}

function gameOver() {
  state = STATE.OVER;
  overLockUntil = ticks + 30; // ~0.5 s Sperre
}

// Tastatur
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    flap();
  }
});

// Maus / Touch direkt auf dem Canvas
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

// --- Render-Helfer ----------------------------------------------------------
// Pixel-Text zentriert zeichnen (mit Schatten für Retro-Lesbarkeit).
function pixelText(text, x, y, size, color, align = "center") {
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a1428";
  ctx.fillText(text, x + 1, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// --- Update / Draw pro State ------------------------------------------------
function update() {
  ticks++;
  // State-spezifische Logik kommt in den nächsten Schritten dazu.
}

function draw() {
  // Hintergrund (Platzhalter — echtes Badezimmer folgt in Schritt 5)
  ctx.fillStyle = "#7ec8d6";
  ctx.fillRect(0, 0, W, H);

  if (state === STATE.MENU) {
    pixelText("DUCKY FLOAT", W / 2, H / 2 - 30, 24, "#ffd23f");
    if (Math.floor(ticks / 30) % 2 === 0) {
      pixelText("TAP ZUM START", W / 2, H / 2 + 30, 14, "#1a1428");
    }
  } else if (state === STATE.PLAY) {
    pixelText("LET'S FLOAT!", W / 2, H / 2, 16, "#1a1428");
  } else if (state === STATE.OVER) {
    pixelText("GAME OVER", W / 2, H / 2, 20, "#e23b3b");
  }
}

// --- Game-Loop (feste Logik-Rate, smoothes Rendering) ----------------------
let last = 0;
let acc = 0;
const STEP = 1000 / 60; // 60 Logik-Updates pro Sekunde

function loop(now) {
  if (!last) last = now;
  acc += now - last;
  last = now;
  // Spiral-of-death verhindern
  if (acc > 250) acc = 250;
  while (acc >= STEP) {
    update();
    acc -= STEP;
  }
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
