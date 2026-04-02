const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // ⚠️ change en prod
  },
});

app.use(express.static(path.join(__dirname, "../public")));

// =====================
// MODES
// =====================
const modes = {
  dev: require("./modes/dev"),
  solo: require("./modes/solo"),
  multi: require("./modes/multi"),
};

// =====================
// SOCKET
// =====================
io.on("connection", (socket) => {
  const mode = socket.handshake.query.mode || "dev";
  const role = socket.handshake.query.role || "ninja";

  console.log("[CONNECT]", socket.id, "mode:", mode, "role:", role);

  const gameMode = modes[mode] || modes.dev;

  // 👇 ROOM UNIQUE PAR JOUEUR
  const room = socket.id;

  socket.join(room);

  socket.data.mode = mode;
  socket.data.role = role;
  socket.data.room = room;

  gameMode.onJoin(socket, io, room);
});

// =====================
// START
// =====================
server.listen(3000, () => {
  console.log("Server running → http://localhost:3000");
});
