const BaseProjectile = require("./baseProjectile");

class BombProjectile extends BaseProjectile {
  constructor(id, config = {}) {
    super(id, {
      ...config,
      kind: "bomb",
      radius: Number.isFinite(config.radius) ? config.radius : 6,
      ttl: Number.isFinite(config.ttl) ? config.ttl : 85,
      gravity: Number.isFinite(config.gravity) ? config.gravity : 0.35,
    });

    this.explosionRadius = Number.isFinite(config.explosionRadius)
      ? config.explosionRadius
      : 80;
    this.explosionForce = Number.isFinite(config.explosionForce)
      ? config.explosionForce
      : 14;
    this.explosionDamage = Number.isFinite(config.explosionDamage)
      ? config.explosionDamage
      : this.damage;

    this.slowFactor = Number.isFinite(config.slowFactor)
      ? config.slowFactor
      : null;
    this.slowDurationFrames = Number.isFinite(config.slowDurationFrames)
      ? Math.max(0, config.slowDurationFrames)
      : 0;
  }

  createExplosionPayload() {
    return {
      ownerId: this.ownerId,
      ownerTeam: this.ownerTeam,
      x: this.x,
      y: this.y,
      radius: this.explosionRadius,
      force: this.explosionForce,
      damage: this.explosionDamage,
      slowFactor: this.slowFactor,
      slowDurationFrames: this.slowDurationFrames,
    };
  }
}

module.exports = BombProjectile;
