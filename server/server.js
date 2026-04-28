const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const { getAvailableHeroes } = require("./personnage/hero/registry");

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:8000",
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

const io = new Server(server, {
  cors: {
    origin: "*", // ⚠️ change en prod
  },
});

app.use(express.static(path.join(__dirname, "../public")));
app.use(
  "/multi-map-assets",
  express.static(path.join(__dirname, "map/multi/img")),
);

app.get("/api/heroes", (req, res) => {
  try {
    const heroes = getAvailableHeroes();
    res.json({ heroes });
  } catch (error) {
    res.status(500).json({ heroes: [], error: "Unable to load heroes" });
  }
});

// =====================
// MODES
// =====================
const modes = {
  dev: require("./modes/dev"),
  solo: require("./modes/solo"),
  multi: require("./modes/multi"),
};

app.get("/api/dev/rooms", (req, res) => {
  const rooms = modes.dev.listOpenRooms();
  res.json({ rooms, maxPlayers: modes.dev.MAX_ROOM_PLAYERS });
});

app.get("/api/dev/room-modes", (req, res) => {
  const modesList = modes.dev.listRoomModes();
  res.json({ modes: modesList });
});

app.get("/api/dev/rooms/:room", (req, res) => {
  const room = modes.dev.normalizeRoomName(req.params.room);
  if (!room) {
    return res.status(400).json({ error: "Invalid room name" });
  }

  const snapshot = modes.dev.getRoomLobby(room);
  if (!snapshot) {
    return res.status(404).json({ error: "Room not found" });
  }

  return res.json(snapshot);
});

app.post("/api/dev/rooms", (req, res) => {
  const requestedName = req.body?.name;
  const requestedMode = modes.dev.normalizeRoomMode(req.body?.mode);
  const room = modes.dev.normalizeRoomName(requestedName);

  if (!room) {
    return res.status(400).json({ error: "Invalid room name" });
  }

  const createdRoom = modes.dev.ensureRoomExists(room, io, requestedMode);
  if (!createdRoom) {
    return res.status(400).json({ error: "Invalid room name" });
  }

  return res.status(201).json({
    room: createdRoom,
    mode: requestedMode,
    maxPlayers: modes.dev.MAX_ROOM_PLAYERS,
  });
});

app.get("/api/multi/rooms", (req, res) => {
  const rooms = modes.multi.listOpenRooms();
  res.json({ rooms, maxPlayers: modes.multi.MAX_ROOM_PLAYERS });
});

app.get("/api/multi/room-modes", (req, res) => {
  const modesList = modes.multi.listRoomModes();
  res.json({ modes: modesList });
});

app.get("/api/multi/rooms/:room", (req, res) => {
  const room = modes.multi.normalizeRoomName(req.params.room);
  if (!room) {
    return res.status(400).json({ error: "Invalid room name" });
  }

  const snapshot = modes.multi.getRoomLobby(room);
  if (!snapshot) {
    return res.status(404).json({ error: "Room not found" });
  }

  return res.json(snapshot);
});

app.post("/api/multi/rooms", (req, res) => {
  const requestedName = req.body?.name;
  const requestedMode = modes.multi.normalizeRoomMode(req.body?.mode);
  const room = modes.multi.normalizeRoomName(requestedName);

  if (!room) {
    return res.status(400).json({ error: "Invalid room name" });
  }

  const createdRoom = modes.multi.ensureRoomExists(room, io, requestedMode);
  if (!createdRoom) {
    return res.status(400).json({ error: "Invalid room name" });
  }

  return res.status(201).json({
    room: createdRoom,
    mode: requestedMode,
    maxPlayers: modes.multi.MAX_ROOM_PLAYERS,
  });
});

// =====================
// SOCKET
// =====================
io.on("connection", (socket) => {
  const mode = socket.handshake.query.mode || "dev";
  const modeModule = modes[mode] || modes.dev;
  const role = socket.handshake.query.role || "ninja";
  const roomMode = modeModule.normalizeRoomMode(
    socket.handshake.query.roomMode || "team3v3",
  );
  const team = modeModule.normalizeTeam(socket.handshake.query.team);
  const requestedRoom = socket.handshake.query.room;
  const nicknameRaw = String(socket.handshake.query.nickname || "").trim();
  const nickname = nicknameRaw.slice(0, 20) || "Player";

  console.log("[CONNECT]", socket.id, "mode:", mode, "role:", role);

  const gameMode = modeModule;

  let room = socket.id;
  if (mode === "dev" || mode === "multi") {
    room = modeModule.normalizeRoomName(requestedRoom);
    if (!room) {
      socket.emit("roomError", { code: "INVALID_ROOM" });
      socket.disconnect(true);
      return;
    }

    const session = modeModule.getRoomSession(room);
    if (!session) {
      socket.emit("roomError", { code: "ROOM_NOT_FOUND" });
      socket.disconnect(true);
      return;
    }

    if (session.mode !== roomMode) {
      socket.emit("roomError", { code: "ROOM_MODE_MISMATCH" });
      socket.disconnect(true);
      return;
    }

    if (!modeModule.isRoomJoinable(room)) {
      socket.emit("roomError", {
        code: "ROOM_FULL",
        maxPlayers: session.rules.maxPlayers,
      });
      socket.disconnect(true);
      return;
    }

    socket.data.roomMode = roomMode;
    socket.data.team = team;
  }

  socket.data.mode = mode;
  socket.data.role = role;
  socket.data.room = room;
  socket.data.nickname = nickname;

  const joinResult = gameMode.onJoin(socket, io, room, {
    roomMode,
    team,
  });
  if (joinResult && joinResult.ok === false) {
    socket.emit("roomError", joinResult);
    socket.disconnect(true);
    return;
  }

  socket.join(room);

  if (mode === "dev" || mode === "multi") {
    socket.emit("joinedRoom", {
      room,
      nickname,
      mode: joinResult.roomState?.mode || roomMode,
      team: joinResult.team || team,
      roomState: joinResult.roomState,
      maxPlayers: joinResult.maxPlayers || modeModule.MAX_ROOM_PLAYERS,
    });
  }
});

// =====================
// START
// =====================
server.listen(3000, () => {
  console.log("Server running → http://localhost:3000");
});
