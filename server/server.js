const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:8000",
    methods: ["GET", "POST"],
  },
});

// =====================
// STATIC
// =====================
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

  console.log("[CONNECT]", socket.id, "mode:", mode);

  const gameMode = modes[mode] || modes.dev;

  socket.join(mode);
  socket.data.mode = mode;

  gameMode.onJoin(socket, io, mode);
});

// =====================
// START
// =====================
server.listen(3000, () => {
  console.log("Server running → http://localhost:3000");
});
