class BaseProjectile {
  constructor(id, config = {}) {
    this.id = id || null;
    this.kind = config.kind || "projectile";

    this.ownerId = config.ownerId || null;
    this.ownerTeam = config.ownerTeam || null;

    this.x = Number(config.x) || 0;
    this.y = Number(config.y) || 0;

    this.vx = Number.isFinite(config.vx) ? config.vx : 0;
    this.vy = Number.isFinite(config.vy) ? config.vy : 0;
    this.gravity = Number.isFinite(config.gravity) ? config.gravity : 0;

    this.radius = Number.isFinite(config.radius) ? config.radius : 4;
    this.damage = Number.isFinite(config.damage) ? config.damage : 20;
    this.ttl = Number.isFinite(config.ttl) ? config.ttl : 60;

    this.alive = true;
  }

  setId(id) {
    this.id = id;
    return this;
  }

  update() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;

    this.ttl--;
    if (this.ttl <= 0) this.alive = false;
  }

  collidesWithPlatform(platforms = []) {
    for (const plat of platforms) {
      const overlapX =
        this.x + this.radius > plat.x && this.x - this.radius < plat.x + plat.w;
      const overlapY =
        this.y + this.radius > plat.y && this.y - this.radius < plat.y + plat.h;

      if (overlapX && overlapY) return true;
    }

    return false;
  }

  hitsEntity(entity) {
    const w = entity.width || 20;
    const h = entity.height || 20;

    const nearestX = Math.max(entity.x, Math.min(this.x, entity.x + w));
    const nearestY = Math.max(entity.y, Math.min(this.y, entity.y + h));

    const dx = this.x - nearestX;
    const dy = this.y - nearestY;

    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  getState() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
    };
  }
}

module.exports = BaseProjectile;
