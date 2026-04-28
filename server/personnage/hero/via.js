const Ninja = require("../role/ninja");
const HitscanProjectile = require("../../combat/projectiles/hitscanProjectile");
const BaseProjectile = require("../../combat/projectiles/baseProjectile");

function getCenter(entity) {
  return {
    x: entity.x + (entity.width || 20) / 2,
    y: entity.y + (entity.height || 20) / 2,
  };
}

class Via extends Ninja {
  constructor(id) {
    super(id);

    this.speed = 6.5;

    this.shootCooldown = 0;
    this.shootCooldownMax = 8;
    this.ammoMax = 15;
    this.ammo = this.ammoMax;
    this.reloadTimerMax = 90;
    this.reloadTimer = 0;
    this.pendingHitscan = null;

    this.skill1CooldownMax = 100;
    this.skill2CooldownMax = 140;

    this.swordRange = 70;
    this.swordDamage = 20;
    this.stunDurationFrames = 180;
    this.slashTravelSpeed = 5.2;

    this.coneProjectileDamage = 10;
    this.coneProjectileSpeed = 10;
    this.pendingConeShots = [];
    this.slashVfx = null;
  }

  useSkill1(context = {}) {
    const center = getCenter(this);
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

    const sweepX = center.x + dirX * this.swordRange;
    const sweepY = center.y + dirY * this.swordRange;

    this.slashVfx = {
      x: center.x + dirX * 34,
      y: center.y + dirY * 34,
      dirX,
      dirY,
      vx: dirX * this.slashTravelSpeed,
      vy: dirY * this.slashTravelSpeed,
      ttl: 10,
    };

    const hitIds = [];
    const playerIds = Object.keys(context.players || {});
    for (let i = 0; i < playerIds.length; i++) {
      const pId = playerIds[i];
      if (pId === this.id) continue;

      const target = context.players[pId];
      if (!target || target.dead || !target.alive) continue;
      if (this.team && target.team && this.team === target.team) continue;

      const tCenter = getCenter(target);
      const dist = Math.hypot(sweepX - tCenter.x, sweepY - tCenter.y);

      if (dist <= 40) {
        hitIds.push(pId);
        target.hp = Math.max(0, target.hp - this.swordDamage);
        target.lastAttackerId = this.id;
        target.slowFactor = 0.1;
        target.slowTimer = this.stunDurationFrames;
        target.speedMultiplier = 0.1;

        if (target.hp <= 0) {
          target.alive = false;
        }
      }
    }

    this.skill1Cooldown = this.skill1CooldownMax;
  }

  useSkill2(context = {}) {
    const center = getCenter(this);
    let baseX = Number.isFinite(context.aimX)
      ? context.aimX
      : center.x + this.facing * 100;
    let baseY = Number.isFinite(context.aimY) ? context.aimY : center.y;

    const dx = baseX - center.x;
    const dy = baseY - center.y;
    let baseDir = Math.atan2(dy, dx);

    const angles = [-15, 0, 15];
    const angleRad = Math.PI / 180;

    for (const angle of angles) {
      const rad = baseDir + angle * angleRad;
      const dirX = Math.cos(rad);
      const dirY = Math.sin(rad);

      this.pendingConeShots.push(
        new BaseProjectile(null, {
          ownerId: this.id,
          ownerTeam: this.team,
          kind: "projectile",
          x: center.x,
          y: center.y,
          vx: dirX * this.coneProjectileSpeed,
          vy: dirY * this.coneProjectileSpeed,
          radius: 4,
          ttl: 65,
          gravity: 0,
          damage: this.coneProjectileDamage,
        }),
      );
    }

    this.skill2Cooldown = this.skill2CooldownMax;
  }

  update(context = {}) {
    if (this.input.left) this.facing = -1;
    if (this.input.right) this.facing = 1;

    if (this.shootCooldown > 0) this.shootCooldown--;

    if (this.slashVfx) {
      this.slashVfx.x += Number(this.slashVfx.vx) || 0;
      this.slashVfx.y += Number(this.slashVfx.vy) || 0;
      this.slashVfx.ttl = Math.max(0, (this.slashVfx.ttl || 0) - 1);
      if (this.slashVfx.ttl <= 0) this.slashVfx = null;
    }

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
        damage: 12,
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
    return this.pendingConeShots.shift() || null;
  }

  consumeHitscan() {
    const shot = this.pendingHitscan;
    this.pendingHitscan = null;
    return shot;
  }

  consumeExplosion() {
    return null;
  }

  getState() {
    const state = super.getState();
    state.viaSlashX = this.slashVfx?.x ?? null;
    state.viaSlashY = this.slashVfx?.y ?? null;
    state.viaSlashDirX = this.slashVfx?.dirX ?? 0;
    state.viaSlashDirY = this.slashVfx?.dirY ?? 0;
    state.viaSlashTTL = this.slashVfx?.ttl ?? 0;
    return state;
  }
}

module.exports = Via;
