const BaseProjectile = require("./baseProjectile");

class HitscanProjectile extends BaseProjectile {
  constructor(config = {}) {
    super(null, {
      ...config,
      kind: "hitscan",
      radius: 0,
      ttl: 1,
      gravity: 0,
      vx: 0,
      vy: 0,
    });

    this.dirX = Number.isFinite(config.dirX) ? config.dirX : 1;
    this.dirY = Number.isFinite(config.dirY) ? config.dirY : 0;
  }

  update() {
    this.alive = false;
  }

  toShot() {
    return {
      ownerId: this.ownerId,
      ownerTeam: this.ownerTeam,
      x: this.x,
      y: this.y,
      dirX: this.dirX,
      dirY: this.dirY,
      damage: this.damage,
    };
  }
}

module.exports = HitscanProjectile;
