const Hero = require("../hero");

class Acrobate extends Hero {
  constructor(id) {
    super(id);
    this.speed = 5;

    // dash state
    this.dashCooldown = 0;
    this.dashPower = 2;
  }

  update() {
    super.update();

    // cooldown tick
    if (this.dashCooldown > 0) {
      this.dashCooldown--;
    }

    // ✅ dash uniquement ici
    if (this.input.dash && this.dashCooldown === 0) {
      this.x += this.vx * this.dashPower;
      this.y += this.vy * this.dashPower;

      this.dashCooldown = 20; // ~0.3s à 60fps
    }
  }
}

module.exports = Acrobate;