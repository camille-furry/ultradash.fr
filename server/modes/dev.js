const Accrobate = require("../personnage/role/accrobate");
const Ninja = require("../personnage/role/ninja");
const Valkiry = require("../personnage/role/walkiry");
const Dasher = require("../personnage/role/dasher");
const DevMap = require("../map/dev/devMap");

const { resolvePlatformCollision } = require("../physics/collision");

module.exports = {
  players: {},
  map: new DevMap(),
  loopStarted: false,

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
      case "ninja":
      default:
        p = new Ninja(id);
        break;
    }

    if (p.dashTime !== undefined) p.dashTime = 0;
    if (p.dashCooldown !== undefined) p.dashCooldown = 0;

    p._justSwitched = 5;

    return p;
  },

  onJoin(socket, io, mode) {
    console.log("[DEV] join:", socket.id);

    this.players[socket.id] = this.createPlayer("ninja", socket.id);

    socket.on("input", (input) => {
      const p = this.players[socket.id];
      if (!p) return;

      p.setInput({
        left: !!input.left,
        right: !!input.right,
        jump: !!input.jump,
        dash: !!input.dash,
      });
    });

    socket.on("changeClass", (type) => {
      const old = this.players[socket.id];
      if (!old) return;

      const p = this.createPlayer(type, socket.id);

      p.x = old.x;
      p.y = old.y;

      p.resetForRoleSwitch();

      this.players[socket.id] = p;

      console.log("[DEV] class:", type);
    });

    socket.on("disconnect", () => {
      delete this.players[socket.id];
    });

    if (!this.loopStarted) {
      this.loopStarted = true;

      setInterval(() => {
        const state = {};
        const platforms = this.map.getPlatforms();

        for (let id in this.players) {
          const p = this.players[id];

          p.update();

          const onGround = resolvePlatformCollision(p, platforms);

          // 💥 STABLE GROUND DETECTION
          if (onGround) {
            p.onGround = true;
            p.groundLock = 3;
          } else {
            p.onGround = false;
          }

          state[id] = p.getState();
        }

        io.to(mode).emit("state", {
          players: state,
          map: platforms,
        });
      }, 1000 / 60);
    }
  },
};
