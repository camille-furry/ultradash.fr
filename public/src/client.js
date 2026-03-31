const socket = io("http://localhost:3000");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let camera = {
  x: 0,
  y: 0
};

function getDeadZone() {
  return {
    left: canvas.width * 0.25,
    right: canvas.width * 0.75
  };
}

let serverPlayers = {};
let smoothPlayers = {};
let serverMap = [];

let input = {
  left: false,
  right: false,
  jump: false,
  dash: false
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// 🔁 input send
setInterval(() => {
  socket.emit("input", input);
}, 1000 / 60);

// ⌨️ input keyboard
document.addEventListener("keydown", (e) => {
  if (e.key === "q") input.left = true;
  if (e.key === "d") input.right = true;

  if (e.key === "z") {
    input.jump = true;
    setTimeout(() => input.jump = false, 50);
  }

  if (e.key === "Shift") input.dash = true;
});

document.addEventListener("keyup", (e) => {
  if (e.key === "q") input.left = false;
  if (e.key === "d") input.right = false;
  if (e.key === "Shift") input.dash = false;
});

// 📡 state from server
socket.on("state", (state) => {
  serverPlayers = state.players;
  serverMap = state.map;

  for (let id in serverPlayers) {
    if (!smoothPlayers[id]) {
      smoothPlayers[id] = {
        x: serverPlayers[id].x,
        y: serverPlayers[id].y
      };
    }
  }

  for (let id in smoothPlayers) {
    if (!serverPlayers[id]) {
      delete smoothPlayers[id];
    }
  }
});

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 🎥 CAMERA UPDATE (dead zone)
function updateCamera() {
  let me = Object.values(smoothPlayers)[0];
  if (!me) return;

  const deadZone = getDeadZone();

  let playerScreenX = me.x - camera.x;

  if (playerScreenX < deadZone.left) {
    camera.x = me.x - deadZone.left;
  }

  if (playerScreenX > deadZone.right) {
    camera.x = me.x - deadZone.right;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateCamera();

  // 🧱 MAP
  ctx.fillStyle = "green";
  for (let plat of serverMap) {
    ctx.fillRect(
      plat.x - camera.x,
      plat.y - camera.y,
      plat.w,
      plat.h
    );
  }

  // 👤 PLAYERS
  for (let id in serverPlayers) {
    let target = serverPlayers[id];
    let smooth = smoothPlayers[id];

    if (!smooth) continue;

    smooth.x = lerp(smooth.x, target.x, 0.2);
    smooth.y = lerp(smooth.y, target.y, 0.2);

    ctx.fillStyle = "blue";
    ctx.fillRect(
      smooth.x - camera.x,
      smooth.y - camera.y,
      20,
      20
    );
  }

  requestAnimationFrame(draw);
}

ctx.imageSmoothingEnabled = false;
draw();