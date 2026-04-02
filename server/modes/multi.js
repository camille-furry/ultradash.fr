const Accrobate = require("../personnage/role/accrobate");
const Ninja = require("../personnage/role/ninja");
const Valkiry = require("../personnage/role/walkiry");
const Dasher = require("../personnage/role/dasher");

const DevMap = require("../map/dev/devMap");
const { updatePhysics } = require("../physics/physicsEngine");

const sessions = {};

class MultiSession {
  constructor(room, io) {
    this.room = room;
    this.io = io;

    this.players = {};
    this.map = new DevMap();

    this.startLoop();
  }

  createPlayer(type, id) {
    switch (type) {
      case "accrobate":
        return new Accrobate(id);
      case "dasher":
        return new Dasher(id);
      case "valkiry":
        return new Valkiry(id);
      default:
        return new Ninja(id);
    }
  }

  addPlayer(socket) {
    const role = socket.data.role || "ninja";
    this.players[socket.id] = this.createPlayer(role, socket.id);

    socket.on("input", (input) => {
      const player = this.players[socket.id];
      if (player) player.setInput(input);
    });

    socket.on("changeClass", (type) => {
      const old = this.players[socket.id];
      if (!old) return;

      const player = this.createPlayer(type, socket.id);
      player.x = old.x;
      player.y = old.y;

      this.players[socket.id] = player;
    });

    socket.on("disconnect", () => {
      delete this.players[socket.id];

      if (Object.keys(this.players).length === 0) {
        delete sessions[this.room];
      }
    });
  }

  startLoop() {
    setInterval(() => {
      const state = {};
      const platforms = this.map.getPlatforms();

      for (let id in this.players) {
        const player = this.players[id];

        player.update();
        updatePhysics(player, platforms);

        state[id] = player.getState();
      }

      this.io.to(this.room).emit("state", {
        players: state,
        map: platforms,
      });
    }, 1000 / 60);
  }
}

module.exports = {
  onJoin(socket, io, room) {
    if (!sessions[room]) {
      sessions[room] = new MultiSession(room, io);
    }

    sessions[room].addPlayer(socket);
  },
};
