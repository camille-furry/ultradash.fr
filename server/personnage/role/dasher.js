const Hero = require("../hero");

class Dasher extends Hero {
  constructor(id) {
    super(id);

    this.speed = 5;

    this.dashPower = 15;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.lastDir = 1;

    this.jumpPower = 10;

    this.maxJumps = 1;
    this.jumpsLeft = 1;
  }

  update() {
    // =====================
    // COOLDOWNS
    // =====================
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.dashTime > 0) this.dashTime--;

    // =====================
    // TRACK DIR
    // =====================
    if (this.input.left) this.lastDir = -1;
    if (this.input.right) this.lastDir = 1;

    // =====================
    // START DASH
    // =====================
    if (this.input.dash && this.dashCooldown === 0 && this.dashTime === 0) {
      const dir = this.input.left ? -1 : this.input.right ? 1 : this.lastDir;

      this.vx = dir * this.dashPower;
      this.vy = 0;

      this.dashTime = 6; // durée du dash
      this.dashCooldown = 20; // anti spam
    }

    if (this.dashTime > 0) {
      this.overrideVX = this.lastDir * this.dashPower;
      this.overrideVY = 0;
    }

    super.update();
  }
}

module.exports = Dasher;
