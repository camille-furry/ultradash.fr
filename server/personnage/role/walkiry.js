const Hero = require("../hero");

class Valkiry extends Hero {
  constructor(id) {
    super(id);

    this.speed = 5;

    this.glideFactor = 0.35;
    this.maxJumps = 1;
    this.jumpsLeft = 1;
    this.jumpPower = 14;
  }

  update() {
    super.update();

    // =====================
    // GLIDE ONLY WHILE HOLDING JUMP
    // =====================
    const holdingJump = this.input.jump;

    if (!this.onGround && holdingJump && this.vy > 0) {
      this.vy *= this.glideFactor;
    }
  }
}

module.exports = Valkiry;
