const Hero = require("../hero");

class Ninja extends Hero {
  constructor(id) {
    super(id);

    this.speed = 6;
    this.jumpPower = 10;
    this.wallJumpForce = 14;

    this.wallJumpLock = 0;
    this.wallStickTime = 0;

    this.lastWallSide = null;
    this.wasOnWall = false;
  }

  update(context = {}) {
    if (this.onWall) {
      this.lastWallSide = this.wallSide;
      this.wasOnWall = true;
    }

    // 🔥 CALCULER AVANT super.update() pour éviter que prevInput soit modifié
    const jumpPressed = this.input.jump && !this.prevInput.jump;
    const isWallJump = jumpPressed && this.wasOnWall && this.wallJumpLock === 0;

    if (isWallJump) {
      if (this.lastWallSide === "left") {
        this.overrideVX = this.wallJumpForce;
      } else if (this.lastWallSide === "right") {
        this.overrideVX = -this.wallJumpForce;
      }

      this.overrideVY = -this.jumpPower;
      this.prevInput.jump = true;
      this.wallJumpLock = 10;
      this.wallStickTime = 0;
      this.lastWallSide = null;
      this.wasOnWall = false;
      if (this.jumpsLeft > 0) this.jumpsLeft--;
      this.jumpCooldown = 5;
    }

    super.update(context);

    if (this.wallJumpLock > 0) this.wallJumpLock--;
    if (this.wallStickTime > 0) this.wallStickTime--;
  }
}

module.exports = Ninja;
