class Mannequin {
  constructor(id, x, y) {
    this.id = id;

    this.x = x;
    this.y = y;

    this.prevX = x;
    this.prevY = y;

    this.vx = 0;
    this.vy = 0;

    this.width = 20;
    this.height = 20;

    this.speed = 1;
    this.direction = 1;

    this.gravity = 0.5;

    this.onGround = false;

    this.alive = true;
  }

  update(players) {
    this.prevX = this.x;
    this.prevY = this.y;

    // gravity (IMPORTANT sinon il ne "tombe pas")
    this.vy += this.gravity;

    this.vx = this.speed * this.direction;

    // random direction change
    if (Math.random() < 0.01) {
      this.direction *= -1;
    }

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
      alive: this.alive,
    };
  }
}

module.exports = Mannequin;
