class Projectile {
  constructor(id, config) {
    this.id = id;
    this.ownerId = config.ownerId;

    this.x = config.x;
    this.y = config.y;

    this.dir = config.dir || 1;
    this.speed = config.speed || 12;
    this.damage = config.damage || 20;

    this.radius = 4;
    this.ttl = 45;
    this.alive = true;

    this.vx = Number.isFinite(config.vx) ? config.vx : this.dir * this.speed;
    this.vy = Number.isFinite(config.vy) ? config.vy : 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    this.ttl--;
    if (this.ttl <= 0) this.alive = false;
  }

  collidesWithPlatform(platforms) {
    for (let plat of platforms) {
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
      x: this.x,
      y: this.y,
      radius: this.radius,
    };
  }
}

module.exports = Projectile;
