class Hero {
  constructor(id) {
    this.id = id;

    this.x = 100;
    this.y = 100;

    this.vx = 0;
    this.vy = 0;

    this.speed = 3;

    this.gravity = 0.5;
    this.onGround = false;

    this.input = {};

    this.jumpBuffer = 0;
  }

  setInput(input = {}) {
    this.input = input;

    // buffer jump (impulsion)
    if (input.jump) {
      this.jumpBuffer = 6; // ~100ms
    }
  }

  applyInput() {
    this.vx = 0;

    if (this.input.left) this.vx = -this.speed;
    if (this.input.right) this.vx = this.speed;
  }

  applyGravity() {
    if (!this.onGround) {
      this.vy += this.gravity;
    }
  }

  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y
    };
  }
}

module.exports = Hero;