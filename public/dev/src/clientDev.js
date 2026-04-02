// =====================
// ROLE
// =====================
const selectedRole = localStorage.getItem("selectedRole") || "ninja";

// =====================
// ENEMIES STATE
// =====================
let serverEnemies = {};
let smoothEnemies = {};

// =====================
// SOCKET
// =====================
const socket = io("http://localhost:3000", {
  query: {
    mode: "dev",
    role: selectedRole,
  },
});

// =====================
// CANVAS
// =====================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let camera = { x: 0, y: 0 };

let serverPlayers = {};
let smoothPlayers = {};
let serverMap = [];

let keys = {
  left: false,
  right: false,
  jump: false,
  dash: false,
};

// =====================
// RESIZE
// =====================
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// =====================
// INPUT
// =====================
document.addEventListener("keydown", (e) => {
  if (e.key === "q") keys.left = true;
  if (e.key === "d") keys.right = true;
  if (e.key === "z") keys.jump = true;
  if (e.key === "Shift") keys.dash = true;
});

document.addEventListener("keyup", (e) => {
  if (e.key === "q") keys.left = false;
  if (e.key === "d") keys.right = false;
  if (e.key === "z") keys.jump = false;
  if (e.key === "Shift") keys.dash = false;
});

// =====================
// SEND INPUT
// =====================
setInterval(() => {
  socket.emit("input", keys);
}, 1000 / 60);

// =====================
// STATE
// =====================
socket.on("state", (state) => {
  serverPlayers = state.players;
  serverEnemies = state.enemies || {};
  serverMap = state.map;

  // PLAYERS
  for (let id in serverPlayers) {
    if (!smoothPlayers[id]) {
      smoothPlayers[id] = { x: serverPlayers[id].x, y: serverPlayers[id].y };
    }
  }

  for (let id in smoothPlayers) {
    if (!serverPlayers[id]) delete smoothPlayers[id];
  }

  // ENEMIES
  for (let id in serverEnemies) {
    if (!smoothEnemies[id]) {
      smoothEnemies[id] = { x: serverEnemies[id].x, y: serverEnemies[id].y };
    }
  }

  for (let id in smoothEnemies) {
    if (!serverEnemies[id]) delete smoothEnemies[id];
  }
});

// =====================
// LERP
// =====================
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// =====================
// MY PLAYER
// =====================
function getMyPlayer() {
  return serverPlayers[socket.id];
}

// =====================
// CAMERA
// =====================
function updateCamera() {
  const me = getMyPlayer();
  if (!me) return;

  const left = canvas.width * 0.35;
  const right = canvas.width * 0.65;

  const px = me.x - camera.x;

  if (px < left) camera.x = me.x - left;
  if (px > right) camera.x = me.x - right;
}

// =====================
// DRAW
// =====================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateCamera();

  // MAP
  ctx.fillStyle = "green";
  for (let p of serverMap) {
    ctx.fillRect(p.x - camera.x, p.y - camera.y, p.w, p.h);
  }

  // PLAYERS
  for (let id in serverPlayers) {
    let t = serverPlayers[id];
    let s = smoothPlayers[id];
    if (!s) continue;

    s.x = lerp(s.x, t.x, 0.25);
    s.y = lerp(s.y, t.y, 0.25);

    ctx.fillStyle = "blue";
    ctx.fillRect(s.x - camera.x, s.y - camera.y, 20, 20);
  }

  // ENEMIES
  for (let id in serverEnemies) {
    let t = serverEnemies[id];
    let s = smoothEnemies[id];
    if (!s) continue;

    s.x = lerp(s.x, t.x, 0.25);
    s.y = lerp(s.y, t.y, 0.25);

    ctx.fillStyle = "red";
    ctx.fillRect(s.x - camera.x, s.y - camera.y, 20, 20);
  }

  requestAnimationFrame(draw);
}

draw();

// =====================
// CLASS SWITCH
// =====================
window.addEventListener("DOMContentLoaded", () => {
  const classSelect = document.getElementById("classSelect");
  const applyBtn = document.getElementById("applyClass");

  if (!classSelect || !applyBtn) return;

  classSelect.value = selectedRole;

  applyBtn.addEventListener("click", () => {
    socket.emit("changeClass", classSelect.value);
  });
});
