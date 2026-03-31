const express = require("express");
const http = require("http");
const path = require("path");

const Acrobate = require("./personnage/role/accrobate");
const { resolvePlatformCollision } = require("./physics/collision");
const Map = require("./map/map");

const gameMap = new Map();

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:8000",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, "../public")));

let players = {};

io.on("connection", (socket) => {
  players[socket.id] = new Acrobate(socket.id);

  socket.on("input", (input) => {
    if (players[socket.id]) {
      players[socket.id].setInput(input);
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  let state = {};

  for (let id in players) {
    let p = players[id];

    // 1. input horizontal
    p.applyInput();

    // 2. gravity
    p.applyGravity();

    // 3. movement
    p.x += p.vx;
    p.y += p.vy;

    // 4. collision
    p.onGround = false;
    resolvePlatformCollision(p, gameMap.getPlatforms());

    // 5. jump buffer
    if (p.jumpBuffer > 0) {
      p.jumpBuffer--;

      if (p.onGround) {
        p.vy = -10;
        p.jumpBuffer = 0;
      }
    }

    state[id] = p.getState();
  }

  io.emit("state", {
    players: state,
    map: gameMap.getPlatforms()
  });

}, 1000 / 60);

server.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
});