class Hero {
  constructor(id) {
    this.id = id;

    this.x = 100;
    this.y = 100;

    this.vx = 0;
    this.vy = 0;

    this.prevX = this.x;
    this.prevY = this.y;

    this.onGround = false;
    this.onWall = false;
    this.wallSide = null;

    this.wasOnGround = false;

    this.input = {
      left: false,
      right: false,
      jump: false,
      dash: false,
    };

    this.prevInput = { ...this.input };

    // 🔥 FIX IMPORTANT
    this.overrideVX = null;
    this.overrideVY = null;

    this.speed = 3;
    this.jumpPower = 10;
    this.gravity = 0.5;

    this.maxJumps = 1;
    this.jumpsLeft = 1;

    this.jumpCooldown = 0;
  }

  setInput(input = {}) {
    this.input = {
      left: !!input.left,
      right: !!input.right,
      jump: !!input.jump,
      dash: !!input.dash,
    };
  }

  update() {
    this.prevX = this.x;
    this.prevY = this.y;

    this.wasOnGround = this.onGround;

    if (this.jumpCooldown > 0) this.jumpCooldown--;

    // GRAVITY
    this.vy += this.gravity;

    // HORIZONTAL
    this.vx = 0;
    if (this.input.left) this.vx = -this.speed;
    if (this.input.right) this.vx = this.speed;

    const jumpPressed = this.input.jump && !this.prevInput.jump;

    if (jumpPressed && this.jumpCooldown === 0 && this.jumpsLeft > 0) {
      this.vy = -this.jumpPower;
      this.jumpsLeft--;
      this.jumpCooldown = 5;
    }

    // APPLY OVERRIDE (SAFE)
    if (this.overrideVX !== null) this.vx = this.overrideVX;
    if (this.overrideVY !== null) this.vy = this.overrideVY;

    this.overrideVX = null;
    this.overrideVY = null;

    this.x += this.vx;
    this.y += this.vy;

    // 🔥 IMPORTANT: prevInput doit être AVANT collision system awareness
    this.prevInput = { ...this.input };
  }

  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      onGround: this.onGround,
      onWall: this.onWall,
      wallSide: this.wallSide,
      jumpsLeft: this.jumpsLeft,
    };
  }
}

module.exports = Hero;
