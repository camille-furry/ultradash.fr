const Accrobate = require("../personnage/role/accrobate");
const Ninja = require("../personnage/role/ninja");
const Valkiry = require("../personnage/role/walkiry");
const Dasher = require("../personnage/role/dasher");

const DevMap = require("../map/dev/devMap");
const Mannequin = require("../ennemy/mannequin");

const { updatePhysics } = require("../physics/physicsEngine");

const sessions = {};

class DevSession {
  constructor(room, io) {
    this.room = room;
    this.io = io;

    this.players = {};
    this.map = new DevMap();

    this.enemies = {};
    this.enemyCount = 0;

    this.loadEnemiesFromMap();
    this.startLoop();
  }

  createPlayer(type, id) {
    let p;

    switch (type) {
      case "accrobate":
        p = new Accrobate(id);
        break;
      case "dasher":
        p = new Dasher(id);
        break;
      case "valkiry":
        p = new Valkiry(id);
        break;
      default:
        p = new Ninja(id);
        break;
    }

    return p;
  }

  loadEnemiesFromMap() {
    for (let spawn of this.map.getEnemySpawns()) {
      this.spawnEnemy(spawn.type, spawn.x, spawn.y);
    }
  }

  createEnemy(type, id, x, y) {
    switch (type) {
      default:
        return new Mannequin(id, x, y);
    }
  }

  spawnEnemy(type, x, y) {
    const id = "enemy_" + this.enemyCount++;
    this.enemies[id] = this.createEnemy(type, id, x, y);
  }

  addPlayer(socket) {
    const role = socket.data.role || "ninja";
    this.players[socket.id] = this.createPlayer(role, socket.id);

    socket.on("input", (input) => {
      const p = this.players[socket.id];
      if (p) p.setInput(input);
    });

    socket.on("changeClass", (type) => {
      const old = this.players[socket.id];
      if (!old) return;

      const p = this.createPlayer(type, socket.id);
      p.x = old.x;
      p.y = old.y;

      this.players[socket.id] = p;
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
      const enemyState = {};
      const platforms = this.map.getPlatforms();

      for (let id in this.players) {
        const p = this.players[id];

        p.update();
        updatePhysics(p, platforms);

        state[id] = p.getState();
      }

      for (let id in this.enemies) {
        const e = this.enemies[id];

        e.update(this.players);
        updatePhysics(e, platforms);

        enemyState[id] = e.getState();
      }

      this.io.to(this.room).emit("state", {
        players: state,
        enemies: enemyState,
        map: platforms,
      });
    }, 1000 / 60);
  }
}

module.exports = {
  onJoin(socket, io, room) {
    if (!sessions[room]) {
      sessions[room] = new DevSession(room, io);
    }

    sessions[room].addPlayer(socket);
  },
};
