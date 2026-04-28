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
      shoot: false,
      skill1: false,
      skill2: false,
      reload: false,
      aimX: null,
      aimY: null,
    };

    this.prevInput = { ...this.input };

    // 🔥 FIX IMPORTANT
    this.overrideVX = null;
    this.overrideVY = null;

    this.speed = 3;
    this.speedMultiplier = 1;
    this.jumpPower = 10;
    this.gravity = 0.5;
    this.accelGround = 0.45;
    this.accelAir = 0.22;
    this.frictionGround = 0.72;
    this.frictionAir = 0.9;

    this.maxJumps = 1;
    this.jumpsLeft = 1;

    this.jumpCooldown = 0;

    this.skill1Cooldown = 0;
    this.skill2Cooldown = 0;
    this.skill1CooldownMax = 0;
    this.skill2CooldownMax = 0;

    this.hp = 100;
  }

  setInput(input = {}) {
    this.input = {
      left: !!input.left,
      right: !!input.right,
      jump: !!input.jump,
      dash: !!input.dash,
      shoot: !!input.shoot,
      skill1: !!input.skill1,
      skill2: !!input.skill2,
      reload: !!input.reload,
      aimX: Number.isFinite(input.aimX) ? input.aimX : null,
      aimY: Number.isFinite(input.aimY) ? input.aimY : null,
    };
  }

  useSkill1(context = {}) {}

  useSkill2(context = {}) {}

  reload() {
    if (Number.isFinite(this.ammoMax) && this.ammo < this.ammoMax) {
      this.reloadTimer = this.reloadTimerMax;
      this.ammo = 0;
    }
  }

  updateSkillEffects(context = {}) {}

  update(context = {}) {
    this.prevX = this.x;
    this.prevY = this.y;

    this.wasOnGround = this.onGround;

    if (this.jumpCooldown > 0) this.jumpCooldown--;
    if (this.skill1Cooldown > 0) this.skill1Cooldown--;
    if (this.skill2Cooldown > 0) this.skill2Cooldown--;

    const skill1Pressed = this.input.skill1 && !this.prevInput.skill1;
    const skill2Pressed = this.input.skill2 && !this.prevInput.skill2;
    const reloadPressed = this.input.reload && !this.prevInput.reload;

    if (skill1Pressed && this.skill1Cooldown === 0) {
      this.useSkill1(context);
    }

    if (skill2Pressed && this.skill2Cooldown === 0) {
      this.useSkill2(context);
    }

    if (reloadPressed && this.reloadTimer === 0) {
      this.reload();
    }

    this.updateSkillEffects(context);

    // GRAVITY
    this.vy += this.gravity;

    // HORIZONTAL
    const axis = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const targetVX =
      axis *
      this.speed *
      (Number.isFinite(this.speedMultiplier) ? this.speedMultiplier : 1);
    const accel = this.onGround ? this.accelGround : this.accelAir;

    if (axis !== 0) {
      this.vx += (targetVX - this.vx) * accel;
    } else {
      const friction = this.onGround ? this.frictionGround : this.frictionAir;
      this.vx *= friction;
      if (Math.abs(this.vx) < 0.02) this.vx = 0;
    }

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
      hero: String(this?.constructor?.name || "hero").toLowerCase(),
      nickname: this.nickname || "Player",
      team: this.team || null,
      kills: Number(this.kills) || 0,
      deaths: Number(this.deaths) || 0,
      alive: this.alive !== false,
      dead: !!this.dead,
      respawnTimer: Number(this.respawnTimer) || 0,
      hp: Number(this.hp) || 0,
      maxHp: 100,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      onGround: this.onGround,
      onWall: this.onWall,
      wallSide: this.wallSide,
      justLanded: !!this.justLanded,
      jumpsLeft: this.jumpsLeft,
      skill1Cooldown: this.skill1Cooldown,
      skill2Cooldown: this.skill2Cooldown,
      skill1CooldownMax: this.skill1CooldownMax,
      skill2CooldownMax: this.skill2CooldownMax,
      ammo: Number.isFinite(this.ammo) ? this.ammo : null,
      ammoMax: Number.isFinite(this.ammoMax) ? this.ammoMax : null,
      reloadTimer: Number(this.reloadTimer) || 0,
      reloadTimerMax: Number(this.reloadTimerMax) || 0,
    };
  }
}

module.exports = Hero;
