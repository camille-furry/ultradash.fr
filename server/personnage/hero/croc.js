const Dasher = require("../role/dasher");
const BombProjectile = require("../../combat/projectiles/bombProjectile");

class Croc extends Dasher {
  constructor(id) {
    super(id);

    this.speed = 5.2;
    this.facing = 1;

    this.shootCooldown = 0;
    this.shootCooldownMax = 16;
    this.pendingShots = [];
    this.ammoMax = 6;
    this.ammo = this.ammoMax;
    this.reloadTimerMax = 120;
    this.reloadTimer = 0;

    this.skill1CooldownMax = 130;
    this.skill2CooldownMax = 180;

    this.grab = null;
    this.grappleShot = null;
    this.grabRange = 280;
    this.grabDurationFrames = 40;
    this.grabPullSpeed = 10;
    this.grappleSpeed = 16;
    this.grappleTravelFrames = 24;

    this.slowBombRange = 210;
    this.slowBombRadius = 110;
    this.slowBombDamage = 10;
    this.slowBombForce = 7;
    this.slowFactor = 0.45;
    this.slowDurationFrames = 4 * 60;

    this.bombSpeed = 8.2;
    this.bombArcLift = 5.6;
    this.bombExplosionRadius = 80;
    this.bombExplosionDamage = 28;
    this.bombExplosionForce = 12;
  }

  getCenter() {
    return {
      x: this.x + (this.width || 20) / 2,
      y: this.y + (this.height || 20) / 2,
    };
  }

  useSkill1(context = {}) {
    const center = this.getCenter();
    let dirX = this.facing;
    let dirY = 0;

    if (Number.isFinite(context.aimX) && Number.isFinite(context.aimY)) {
      const dx = context.aimX - center.x;
      const dy = context.aimY - center.y;
      const mag = Math.hypot(dx, dy);

      if (mag > 0.001) {
        dirX = dx / mag;
        dirY = dy / mag;
      }
    }

    this.grappleShot = {
      x: center.x,
      y: center.y,
      vx: dirX * this.grappleSpeed,
      vy: dirY * this.grappleSpeed,
      framesLeft: this.grappleTravelFrames,
    };

    this.grab = null;
    this.skill1Cooldown = this.skill1CooldownMax;
  }

  useSkill2(context = {}) {
    const center = this.getCenter();
    let dirX = this.facing;
    let dirY = -0.2;

    if (Number.isFinite(context.aimX) && Number.isFinite(context.aimY)) {
      const dx = context.aimX - center.x;
      const dy = context.aimY - center.y;
      const mag = Math.hypot(dx, dy);

      if (mag > 0.001) {
        dirX = dx / mag;
        dirY = dy / mag;
      }
    }

    this.pendingShots.push(
      new BombProjectile(null, {
        ownerId: this.id,
        ownerTeam: this.team,
        x: center.x,
        y: center.y,
        vx: dirX * (this.bombSpeed * 0.9),
        vy: dirY * (this.bombSpeed * 0.9) - this.bombArcLift * 0.8,
        radius: 7,
        ttl: 100,
        gravity: 0.34,
        damage: this.slowBombDamage,
        explosionRadius: this.slowBombRadius,
        explosionDamage: this.slowBombDamage,
        explosionForce: this.slowBombForce,
        slowFactor: this.slowFactor,
        slowDurationFrames: this.slowDurationFrames,
      }),
    );

    this.skill2Cooldown = this.skill2CooldownMax;
  }

  static pointInPlatform(x, y, platforms = []) {
    for (const plat of platforms) {
      if (
        x >= plat.x &&
        x <= plat.x + plat.w &&
        y >= plat.y &&
        y <= plat.y + plat.h
      ) {
        return true;
      }
    }

    return false;
  }

  findGrappleTarget(players = {}) {
    if (!this.grappleShot) return null;

    const hookX = this.grappleShot.x;
    const hookY = this.grappleShot.y;

    for (const id in players) {
      if (id === this.id) continue;

      const target = players[id];
      if (!target || target.dead || !target.alive) continue;
      if (this.team && target.team && this.team === target.team) continue;

      const w = target.width || 20;
      const h = target.height || 20;
      if (
        hookX >= target.x &&
        hookX <= target.x + w &&
        hookY >= target.y &&
        hookY <= target.y + h
      ) {
        return id;
      }
    }

    return null;
  }

  updateSkillEffects(context = {}) {
    if (this.grappleShot && !this.grab) {
      this.grappleShot.x += this.grappleShot.vx;
      this.grappleShot.y += this.grappleShot.vy;
      this.grappleShot.framesLeft--;

      const travelled = Math.hypot(
        this.grappleShot.x - this.getCenter().x,
        this.grappleShot.y - this.getCenter().y,
      );
      const reachedLimit = travelled >= this.grabRange;
      const touchedWall = Croc.pointInPlatform(
        this.grappleShot.x,
        this.grappleShot.y,
        context.platforms,
      );

      const targetId = this.findGrappleTarget(context.players);
      if (targetId) {
        this.grab = {
          targetId,
          framesLeft: this.grabDurationFrames,
        };
        this.grappleShot = null;
      } else if (
        this.grappleShot.framesLeft <= 0 ||
        reachedLimit ||
        touchedWall
      ) {
        this.grappleShot = null;
      }
    }

    if (!this.grab) return;

    const target = context.players?.[this.grab.targetId];
    if (!target || target.dead || !target.alive || this.grab.framesLeft <= 0) {
      this.grab = null;
      return;
    }

    const center = this.getCenter();
    const targetCenterX = target.x + (target.width || 20) / 2;
    const targetCenterY = target.y + (target.height || 20) / 2;
    const dx = center.x - targetCenterX;
    const dy = center.y - targetCenterY;
    const distance = Math.hypot(dx, dy);

    if (distance < 12) {
      this.grab = null;
      return;
    }

    const safeDistance = Math.max(0.001, distance);
    target.overrideVX = (dx / safeDistance) * this.grabPullSpeed;
    target.overrideVY =
      (dy / safeDistance) * Math.max(4, this.grabPullSpeed * 0.8);

    this.grab.framesLeft--;
  }

  update(context = {}) {
    if (this.input.left) this.facing = -1;
    if (this.input.right) this.facing = 1;

    if (this.shootCooldown > 0) this.shootCooldown--;

    if (this.reloadTimer > 0) {
      this.reloadTimer--;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        this.ammo = this.ammoMax;
      }
    }

    const shootPressed = this.input.shoot && !this.prevInput.shoot;
    if (
      shootPressed &&
      this.shootCooldown === 0 &&
      this.reloadTimer === 0 &&
      this.ammo > 0
    ) {
      const center = this.getCenter();

      let dirX = this.facing;
      let dirY = -0.25;

      if (this.input.aimX !== null && this.input.aimY !== null) {
        const dx = this.input.aimX - center.x;
        const dy = this.input.aimY - center.y;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.001) {
          dirX = dx / mag;
          dirY = dy / mag;
        }
      }

      this.pendingShots.push(
        new BombProjectile(null, {
          ownerId: this.id,
          ownerTeam: this.team,
          x: center.x,
          y: center.y,
          vx: dirX * this.bombSpeed,
          vy: dirY * this.bombSpeed - this.bombArcLift,
          radius: 6,
          ttl: 95,
          gravity: 0.35,
          damage: this.bombExplosionDamage,
          explosionRadius: this.bombExplosionRadius,
          explosionDamage: this.bombExplosionDamage,
          explosionForce: this.bombExplosionForce,
        }),
      );

      this.ammo = Math.max(0, this.ammo - 1);
      if (this.ammo <= 0) {
        this.reloadTimer = this.reloadTimerMax;
      }

      this.shootCooldown = this.shootCooldownMax;
    }

    super.update(context);
  }

  consumeShot() {
    return this.pendingShots.shift() || null;
  }

  consumeExplosion() {
    return null;
  }

  getState() {
    const state = super.getState();
    state.grabbing = !!this.grab;
    state.grabTargetId = this.grab?.targetId || null;
    state.grappling = !!this.grappleShot;
    state.grappleX = this.grappleShot?.x || null;
    state.grappleY = this.grappleShot?.y || null;
    return state;
  }
}

module.exports = Croc;
