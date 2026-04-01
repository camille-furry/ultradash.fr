module.exports = (io) => {
  const players = {};
  const DevMap = require("../map/dev/devMap");
  const { resolvePlatformCollision } = require("../physics/collision");

  const Ninja = require("../personnage/role/ninja");
  const Accrobate = require("../personnage/role/accrobate");
  const Dasher = require("../personnage/role/dasher");
  const Valkiry = require("../personnage/role/walkiry");

  const map = new DevMap();

  function createPlayer(type, id) {
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

  io.on("connection", (socket) => {
    players[socket.id] = createPlayer("ninja", socket.id);

    socket.on("input", (input) => {
      if (players[socket.id]) {
        players[socket.id].setInput(input);
      }
    });

    socket.on("changeClass", (type) => {
      const old = players[socket.id];
      if (!old) return;

      const p = createPlayer(type, socket.id);

      p.x = old.x;
      p.y = old.y;

      players[socket.id] = p;
    });

    socket.on("disconnect", () => {
      delete players[socket.id];
    });
  });

  setInterval(() => {
    const state = {};
    const platforms = map.getPlatforms();

    for (let id in players) {
      const p = players[id];

      p.update();
      resolvePlatformCollision(p, platforms);

      state[id] = p.getState();
    }

    io.emit("state", {
      players: state,
      map: platforms,
    });
  }, 1000 / 60);
};
