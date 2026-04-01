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

    this.touchingWallLeft = false;
    this.touchingWallRight = false;

    // INPUT CLEAN
    this.input = {
      left: false,
      right: false,
      jump: false,
      dash: false,
    };

    // PREV INPUT (IMPORTANT POUR EDGE DETECT)
    this.prevInput = {
      left: false,
      right: false,
      jump: false,
      dash: false,
    };

    this.speed = 3;
    this.jumpPower = 10;
    this.gravity = 0.5;

    this.maxJumps = 1;
    this.jumpsLeft = 1;

    this.jumpCooldown = 0;

    this.wallJumpLock = 0;
    this.wallJumpIgnore = 0;
    this.dashLock = 0;

    this._justSwitched = 0;
  }

  // =====================
  // INPUT SAFE SET
  // =====================
  setInput(input = {}) {
    this.input = {
      left: !!input.left,
      right: !!input.right,
      jump: !!input.jump,
      dash: !!input.dash,
    };
  }

  // =====================
  // UPDATE
  // =====================
  update() {
    // SAVE POSITION
    this.prevX = this.x;
    this.prevY = this.y;

    // TIMERS
    if (this.wallJumpLock > 0) this.wallJumpLock--;
    if (this.wallJumpIgnore > 0) this.wallJumpIgnore--;
    if (this.dashLock > 0) this.dashLock--;
    if (this._justSwitched > 0) this._justSwitched--;

    // =====================
    // MOVEMENT LOCKS
    // =====================
    if (this.wallJumpLock === 0 && this.dashLock === 0) {
      this.vx = 0;

      if (this.input.left) this.vx = -this.speed;
      if (this.input.right) this.vx = this.speed;
    }

    // =====================
    // JUMP (EDGE DETECTION SERVER SIDE)
    // =====================
    if (this.jumpCooldown > 0) this.jumpCooldown--;

    const jumpPressed = this.input.jump && !this.prevInput.jump;

    if (jumpPressed && this.jumpCooldown === 0 && this.jumpsLeft > 0) {
      this.vy = -this.jumpPower;
      this.jumpsLeft--;
      this.jumpCooldown = 5;
    }

    // =====================
    // GRAVITY
    // =====================
    this.vy += this.gravity;

    // =====================
    // MOVE
    // =====================
    this.x += this.vx;
    this.y += this.vy;

    // =====================
    // RESET JUMPS
    // =====================
    if (this.onGround && this._justSwitched === 0) {
      this.jumpsLeft = this.maxJumps;
    }

    // =====================
    // STORE INPUT (IMPORTANT)
    // =====================
    this.prevInput = { ...this.input };
  }

  // =====================
  // STATE
  // =====================
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

  // =====================
  // RESET CLASS SWITCH
  // =====================
  resetForRoleSwitch() {
    this.vx = 0;
    this.vy = 0;

    this.onGround = false;
    this.onWall = false;
    this.wallSide = null;

    this.touchingWallLeft = false;
    this.touchingWallRight = false;

    this.jumpCooldown = 0;
    this.wallJumpLock = 0;
    this.dashLock = 0;

    this.jumpsLeft = this.maxJumps;

    this.input = {
      left: false,
      right: false,
      jump: false,
      dash: false,
    };

    this.prevInput = {
      left: false,
      right: false,
      jump: false,
      dash: false,
    };

    this._justSwitched = 5;
  }
}

module.exports = Hero;
