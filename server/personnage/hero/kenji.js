const Accrobate = require("../role/accrobate");
const HitscanProjectile = require("../../combat/projectiles/hitscanProjectile");

function getCenter(entity) {
  return {
    x: entity.x + (entity.width || 20) / 2,
    y: entity.y + (entity.height || 20) / 2,
  };
}

function raycastPlatforms(
  originX,
  originY,
  targetX,
  targetY,
  platforms,
  maxRange,
) {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const distance = Math.hypot(dx, dy);

  if (distance < 0.001) return null;

  const cappedDistance = Math.min(distance, maxRange);
  const stepCount = Math.max(1, Math.ceil(cappedDistance / 4));
  const stepX = (dx / distance) * (cappedDistance / stepCount);
  const stepY = (dy / distance) * (cappedDistance / stepCount);

  let x = originX;
  let y = originY;

  for (let i = 0; i <= stepCount; i++) {
    for (const plat of platforms || []) {
      if (
        x >= plat.x &&
        x <= plat.x + plat.w &&
        y >= plat.y &&
        y <= plat.y + plat.h
      ) {
        return { x, y };
      }
    }

    x += stepX;
    y += stepY;
  }

  return null;
}

function getClosestPointOnRect(x, y, rect) {
  return {
    x: Math.max(rect.x, Math.min(x, rect.x + rect.w)),
    y: Math.max(rect.y, Math.min(y, rect.y + rect.h)),
  };
}

function findSnappedAnchor(
  originX,
  originY,
  targetX,
  targetY,
  platforms,
  snapRadius,
) {
  let bestAnchor = null;
  let bestDistance = Infinity;

  for (const plat of platforms || []) {
    const anchor = getClosestPointOnRect(targetX, targetY, plat);
    const distanceToTarget = Math.hypot(anchor.x - targetX, anchor.y - targetY);
    const distanceFromOrigin = Math.hypot(
      anchor.x - originX,
      anchor.y - originY,
    );

    if (distanceToTarget <= snapRadius && distanceFromOrigin <= 520) {
      if (distanceToTarget < bestDistance) {
        bestDistance = distanceToTarget;
        bestAnchor = anchor;
      }
    }
  }

  return bestAnchor;
}

class Kenji extends Accrobate {
  constructor(id) {
    super(id);

    this.speed = 6;

    this.facing = 1;
    this.shootCooldown = 0;
    this.shootCooldownMax = 12;
    this.projectileDamage = 25;
    this.pendingHitscan = null;
    this.ammoMax = 10;
    this.ammo = this.ammoMax;
    this.reloadTimerMax = 90;
    this.reloadTimer = 0;

    this.grapple = null;
    this.grappleDuration = 180;
    this.grappleRange = 520;
    this.grapplePullMaxSpeed = 18;
    this.grappleSnapDistance = 18;
    this.pendingExplosion = null;
    this.explosionRadius = 80;
    this.explosionForce = 18;
    this.explosionDamage = 30;
    this.explosionRecoil = 20;

    this.skill1CooldownMax = this.grappleDuration;
    this.skill2CooldownMax = 200;
  }

  useSkill1(context = {}) {
    if (this.grapple) return;

    const origin = getCenter(this);
    const aimX = Number.isFinite(context.aimX)
      ? context.aimX
      : origin.x + this.facing * 100;
    const aimY = Number.isFinite(context.aimY) ? context.aimY : origin.y;

    let anchor = raycastPlatforms(
      origin.x,
      origin.y,
      aimX,
      aimY,
      context.platforms,
      this.grappleRange,
    );

    if (!anchor) {
      anchor = findSnappedAnchor(
        origin.x,
        origin.y,
        aimX,
        aimY,
        context.platforms,
        20,
      );
    }

    if (!anchor) return;

    this.grapple = {
      x: anchor.x,
      y: anchor.y,
      framesLeft: this.grappleDuration,
    };

    this.skill1Cooldown = this.skill1CooldownMax;
  }

  useSkill2(context = {}) {
    if (this.skill2Cooldown > 0) return;

    const origin = getCenter(this);
    const explosionX = origin.x;
    const explosionY = origin.y;

    let dirX = this.facing;
    let dirY = 0;

    if (Number.isFinite(context.aimX) && Number.isFinite(context.aimY)) {
      const dx = context.aimX - origin.x;
      const dy = context.aimY - origin.y;
      const mag = Math.hypot(dx, dy);

      if (mag > 0.001) {
        dirX = dx / mag;
        dirY = dy / mag;
      }
    }

    // Shotgun recoil: push Kenji opposite to the aim direction.
    this.overrideVX = this.vx - dirX * this.explosionRecoil;
    this.overrideVY = this.vy - dirY * this.explosionRecoil;

    this.pendingExplosion = {
      ownerId: this.id,
      x: explosionX,
      y: explosionY,
      radius: this.explosionRadius,
      force: this.explosionForce,
      damage: this.explosionDamage,
    };

    this.skill2Cooldown = this.skill2CooldownMax;
  }

  updateSkillEffects(context = {}) {
    if (this.grapple) {
      const center = getCenter(this);
      const dx = this.grapple.x - center.x;
      const dy = this.grapple.y - center.y;
      const distance = Math.hypot(dx, dy);
      const framesLeft = Math.max(1, this.grapple.framesLeft);

      if (
        distance <= this.grappleSnapDistance ||
        this.grapple.framesLeft <= 0
      ) {
        this.grapple = null;
      } else {
        const speedScale = Math.min(
          this.grapplePullMaxSpeed,
          Math.max(6, distance * 0.18),
        );
        const safeDistance = Math.max(distance, 0.001);
        this.overrideVX = (dx / safeDistance) * speedScale;
        this.overrideVY = (dy / safeDistance) * speedScale;
        this.grapple.framesLeft--;
      }
    }
  }

  update(context = {}) {
    if (this.input.left) this.facing = -1;
    if (this.input.right) this.facing = 1;

    const skill1Pressed = this.input.skill1 && !this.prevInput.skill1;

    if (skill1Pressed && this.grapple) {
      this.grapple = null;
    }

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
      const centerX = this.x + 10;
      const centerY = this.y + 10;

      let dirX = this.facing;
      let dirY = 0;

      if (this.input.aimX !== null && this.input.aimY !== null) {
        const dx = this.input.aimX - centerX;
        const dy = this.input.aimY - centerY;
        const mag = Math.hypot(dx, dy);

        if (mag > 0.001) {
          dirX = dx / mag;
          dirY = dy / mag;
        }
      }

      this.pendingHitscan = new HitscanProjectile({
        ownerId: this.id,
        ownerTeam: this.team,
        x: centerX,
        y: centerY,
        dirX,
        dirY,
        damage: this.projectileDamage,
      });
      this.ammo = Math.max(0, this.ammo - 1);
      if (this.ammo <= 0) {
        this.reloadTimer = this.reloadTimerMax;
      }
      this.shootCooldown = this.shootCooldownMax;
    }

    super.update(context);
  }

  consumeShot() {
    return null;
  }

  consumeHitscan() {
    const shot = this.pendingHitscan;
    this.pendingHitscan = null;
    return shot;
  }

  consumeExplosion() {
    const explosion = this.pendingExplosion;
    this.pendingExplosion = null;
    return explosion;
  }

  getState() {
    const state = super.getState();

    state.grappling = !!this.grapple;
    state.grappleX = this.grapple ? this.grapple.x : null;
    state.grappleY = this.grapple ? this.grapple.y : null;
    state.grappleFramesLeft = this.grapple ? this.grapple.framesLeft : 0;

    return state;
  }
}

module.exports = Kenji;
