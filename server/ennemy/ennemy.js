class Enemy {
  constructor(id, x = 0, y = 0) {
    this.id = id;

    this.x = x;
    this.y = y;

    this.prevX = x;
    this.prevY = y;

    this.vx = 0;
    this.vy = 0;

    this.width = 20;
    this.height = 20;

    this.speed = 1.5;

    this.gravity = 0.5;

    this.onGround = false;

    this.alive = true;
  }

  update(players) {
    // SAVE PREV POS (IMPORTANT FOR COLLISION ENGINE)
    this.prevX = this.x;
    this.prevY = this.y;

    // GRAVITY (comme player)
    this.vy += this.gravity;

    // SIMPLE AI (follow nearest player)
    let target = null;
    let minDist = Infinity;

    for (let id in players) {
      const p = players[id];
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const d = dx * dx + dy * dy;

      if (d < minDist) {
        minDist = d;
        target = p;
      }
    }

    if (target) {
      const dir = target.x > this.x ? 1 : -1;
      this.vx = dir * this.speed;
    } else {
      this.vx = 0;
    }

    // APPLY MOVEMENT
    this.x += this.vx;
    this.y += this.vy;
  }

  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      hp: this.hp,
      alive: this.alive,
    };
  }
}

module.exports = Enemy;
