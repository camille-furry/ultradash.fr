const Hero = require("../hero");

class Ninja extends Hero {
  constructor(id) {
    super(id);

    this.speed = 6;
    this.wallJumpForce = 10; // ✅ valeur réaliste
    this.jumpPower = 10;

    this.maxJumps = 1;
    this.jumpsLeft = 1;
  }

  update() {
    super.update();

    // =====================
    // WALL SLIDE
    // =====================
    if (this.onWall && !this.onGround) {
      this.vy = Math.min(this.vy, 1);
    }

    // =====================
    // WALL JUMP
    // =====================
    if (
      this.onWall &&
      !this.onGround &&
      this.input.jump &&
      this.jumpCooldown === 0
    ) {
      this.vy = -this.jumpPower;

      // ✅ push correct (NE PAS inverser)
      if (this.wallSide === "left") this.vx = this.wallJumpForce;
      if (this.wallSide === "right") this.vx = -this.wallJumpForce;

      // ✅ bloque input → vrai décollage
      this.wallJumpLock = 10;
      this.wallJumpIgnore = 10;

      this.jumpCooldown = 5;
    }
  }
}

module.exports = Ninja;
