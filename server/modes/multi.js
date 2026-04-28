const Accrobate = require("../personnage/role/accrobate");
const Ninja = require("../personnage/role/ninja");
const Valkiry = require("../personnage/role/walkiry");
const Dasher = require("../personnage/role/dasher");
const Kenji = require("../personnage/hero/kenji");
const Croc = require("../personnage/hero/croc");
const Via = require("../personnage/hero/via");
const { loadHeroClass } = require("../personnage/hero/registry");
const { performance } = require("perf_hooks");
const BombProjectile = require("../combat/projectiles/bombProjectile");
const teamDeathmatch = require("./multi/teamDeathmatch");

const { createMultiMap } = require("../map/multi/mapMulti");
const Mannequin = require("../ennemy/mannequin");

const { updatePhysics } = require("../physics/physicsEngine");

const sessions = {};
const MAX_ROOM_PLAYERS = 6;
const DEFAULT_ROOM_MODE = teamDeathmatch.DEFAULT_ROOM_MODE;
const RESPAWN_DELAY_FRAMES = 10 * 60;
const EMPTY_STARTED_ROOM_GRACE_MS = 15000;

function normalizeRoomName(value) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return cleaned || null;
}

function normalizeRoomMode(value) {
  return teamDeathmatch.normalizeRoomMode(value);
}

function normalizeTeam(value) {
  return teamDeathmatch.normalizeTeam(value);
}

function getTeamCounts(players) {
  return teamDeathmatch.getTeamCounts(players);
}

function pickRandomPlayerId(players) {
  const ids = Object.keys(players || {});
  if (ids.length === 0) return null;
  const index = Math.floor(Math.random() * ids.length);
  return ids[index] || null;
}

function getZoneOverlap(entity, zone) {
  const width = Number(entity.width) || 20;
  const height = Number(entity.height) || 20;

  return (
    entity.x < zone.x + zone.w &&
    entity.x + width > zone.x &&
    entity.y < zone.y + zone.h &&
    entity.y + height > zone.y
  );
}

function isZoneBlockingEntity(entity, zone) {
  const entityTeam = entity?.team || null;
  if (!entityTeam) return true;
  return entityTeam !== zone.team;
}

function pushEntityOutOfZone(entity, zone) {
  const width = Number(entity?.width) || 20;
  const height = Number(entity?.height) || 20;

  const entityLeft = entity.x;
  const entityRight = entity.x + width;
  const entityTop = entity.y;
  const entityBottom = entity.y + height;

  const zoneLeft = zone.x;
  const zoneRight = zone.x + zone.w;
  const zoneTop = zone.y;
  const zoneBottom = zone.y + zone.h;

  const overlapLeft = entityRight - zoneLeft;
  const overlapRight = zoneRight - entityLeft;
  const overlapTop = entityBottom - zoneTop;
  const overlapBottom = zoneBottom - entityTop;

  const overlapX = Math.min(overlapLeft, overlapRight);
  const overlapY = Math.min(overlapTop, overlapBottom);
  const pushMargin = 2;

  if (overlapX <= overlapY) {
    const entityCenterX = entityLeft + width / 2;
    const zoneCenterX = zoneLeft + zone.w / 2;

    if (entityCenterX < zoneCenterX) {
      entity.x -= overlapLeft + pushMargin;
    } else {
      entity.x += overlapRight + pushMargin;
    }
    entity.vx = 0;
    return;
  }

  const entityCenterY = entityTop + height / 2;
  const zoneCenterY = zoneTop + zone.h / 2;
  if (entityCenterY < zoneCenterY) {
    entity.y -= overlapTop + pushMargin;
  } else {
    entity.y += overlapBottom + pushMargin;
  }
  entity.vy = 0;
}

class DevSession {
  constructor(room, io, roomMode = DEFAULT_ROOM_MODE) {
    this.room = room;
    this.io = io;
    this.mode = normalizeRoomMode(roomMode);
    this.rules = teamDeathmatch.getModeRules(this.mode);

    this.started = false;
    this.leaderId = null;
    this.winnerTeam = null;

    this.players = {};
    this.map = createMultiMap();

    this.enemies = {};
    this.enemyCount = 0;

    this.projectiles = {};
    this.projectileCount = 0;

    this.hitscanTraces = {};
    this.hitscanTraceCount = 0;

    this.explosions = {};
    this.explosionCount = 0;

    this.teamSpawns = teamDeathmatch.TEAM_SPAWNS;
    this.emptySince = null;

    this.startLoop();
  }

  createPlayer(type, id) {
    const normalizedType = String(type || "").toLowerCase();
    let p;

    switch (normalizedType) {
      case "accrobate":
        p = new Accrobate(id);
        break;
      case "dasher":
        p = new Dasher(id);
        break;
      case "valkiry":
        p = new Valkiry(id);
        break;
      case "kenji":
        p = new Kenji(id);
        break;
      case "croc":
        p = new Croc(id);
        break;
      case "via":
        p = new Via(id);
        break;
      default:
        {
          const HeroClass = loadHeroClass(normalizedType);
          p = HeroClass ? new HeroClass(id) : new Ninja(id);
        }
        break;
    }

    return p;
  }

  getPublicTeamZones() {
    const zones = Array.isArray(this.map?.teamZones) ? this.map.teamZones : [];

    return zones.map((zone) => ({
      team: String(zone?.team || "").toLowerCase() === "blue" ? "blue" : "red",
      x: Number(zone?.x) || 0,
      y: Number(zone?.y) || 0,
      w: Math.max(0, Number(zone?.w) || 0),
      h: Math.max(0, Number(zone?.h) || 0),
    }));
  }

  getRoomState() {
    const teamCounts = getTeamCounts(this.players);

    return {
      room: this.room,
      mapName: this.map?.name || "Unknown",
      mapKey: this.map?.key || "unknown",
      mapBackgroundUrl: this.map?.backgroundUrl || null,
      mapWidth: this.map?.width || 2000,
      mapHeight: this.map?.height || 1000,
      teamZones: this.getPublicTeamZones(),
      mode: this.mode,
      modeLabel: this.rules.label,
      started: this.started,
      leaderId: this.leaderId,
      winnerTeam: this.winnerTeam,
      maxPlayers: this.rules.maxPlayers,
      teamSize: this.rules.teamSize,
      targetKills: this.rules.targetKills,
      teamCounts,
      playerCount: Object.keys(this.players).length,
      canStart: !this.started,
    };
  }

  getRoomSummary() {
    const teamCounts = getTeamCounts(this.players);

    return {
      room: this.room,
      mapName: this.map?.name || "Unknown",
      mapKey: this.map?.key || "unknown",
      mapBackgroundUrl: this.map?.backgroundUrl || null,
      mapWidth: this.map?.width || 2000,
      mapHeight: this.map?.height || 1000,
      teamZones: this.getPublicTeamZones(),
      mode: this.mode,
      modeLabel: this.rules.label,
      started: this.started,
      leaderId: this.leaderId,
      winnerTeam: this.winnerTeam,
      maxPlayers: this.rules.maxPlayers,
      teamCounts,
      players: Object.keys(this.players).length,
      isJoinable: Object.keys(this.players).length < this.rules.maxPlayers,
    };
  }

  getRoomLobbySnapshot() {
    const teams = {
      red: [],
      blue: [],
    };

    const playerIds = Object.keys(this.players);
    for (let i = 0; i < playerIds.length; i++) {
      const id = playerIds[i];
      const player = this.players[id];
      const teamKey = player.team === "blue" ? "blue" : "red";
      const heroName =
        String(player?.constructor?.name || "hero").toLowerCase() || "hero";

      teams[teamKey].push({
        id,
        nickname: player.nickname || "Player",
        hero: heroName,
        leader: this.leaderId === id,
      });
    }

    return {
      room: this.room,
      mapName: this.map?.name || "Unknown",
      mapKey: this.map?.key || "unknown",
      mapBackgroundUrl: this.map?.backgroundUrl || null,
      mapWidth: this.map?.width || 2000,
      mapHeight: this.map?.height || 1000,
      teamZones: this.getPublicTeamZones(),
      mode: this.mode,
      modeLabel: this.rules.label,
      started: this.started,
      winnerTeam: this.winnerTeam,
      maxPlayers: this.rules.maxPlayers,
      teamSize: this.rules.teamSize,
      targetKills: this.rules.targetKills,
      teams,
      teamCounts: getTeamCounts(this.players),
      players: playerIds.length,
    };
  }

  spawnAtTeam(player, team) {
    teamDeathmatch.spawnAtTeam(player, team, this.map);
  }

  assignTeam(requestedTeam) {
    return teamDeathmatch.assignTeam(
      this.players,
      requestedTeam,
      this.rules.teamSize,
    );
  }

  startRoom(socketId) {
    if (socketId && this.leaderId && socketId !== this.leaderId) {
      return { ok: false, code: "NOT_LEADER" };
    }

    this.map = createMultiMap();
    this.started = true;
    this.winnerTeam = null;
    this.emptySince = null;

    this.projectiles = {};
    this.hitscanTraces = {};
    this.explosions = {};

    for (const player of Object.values(this.players)) {
      teamDeathmatch.resetPlayerForRound(player);
      this.spawnAtTeam(player, player.team);
    }

    return { ok: true };
  }

  registerKill(killerId, victimId) {
    const winnerTeam = teamDeathmatch.applyKillAndCheckWinner(
      this.players,
      killerId,
      victimId,
      this.rules.targetKills,
    );

    if (winnerTeam) {
      this.winnerTeam = winnerTeam;
      this.started = false;
    }
  }

  killPlayer(victimId, killerId = null) {
    const victim = this.players[victimId];
    if (!victim || victim.dead) return;

    victim.dead = true;
    victim.alive = false;
    victim.hp = 0;
    victim.vx = 0;
    victim.vy = 0;
    victim.respawnTimer = RESPAWN_DELAY_FRAMES;

    this.registerKill(killerId, victimId);
  }

  respawnPlayer(player) {
    player.dead = false;
    player.alive = true;
    player.respawnTimer = 0;
    player.slowTimer = 0;
    player.slowFactor = 1;
    player.speedMultiplier = 1;
    player.hp = 100;
    this.spawnAtTeam(player, player.team);
  }

  isPlayerOutOfBounds(player) {
    const margin = 80;
    const width = Number(this.map?.width) || 2000;
    const height = Number(this.map?.height) || 1000;
    const entityWidth = Number(player?.width) || 20;
    const entityHeight = Number(player?.height) || 20;

    if (player.x + entityWidth < -margin) return true;
    if (player.x > width + margin) return true;
    if (player.y + entityHeight < -220) return true;
    if (player.y > height + margin) return true;
    return false;
  }

  resolveTeamZones(entity) {
    const zones = Array.isArray(this.map?.teamZones) ? this.map.teamZones : [];
    if (zones.length === 0) return;

    for (const zone of zones) {
      if (!isZoneBlockingEntity(entity, zone)) continue;
      if (!getZoneOverlap(entity, zone)) continue;

      pushEntityOutOfZone(entity, zone);
    }
  }

  collidesWithBlockingZonesForTeam(entity, ownerTeam) {
    const zones = Array.isArray(this.map?.teamZones) ? this.map.teamZones : [];
    for (const zone of zones) {
      if (!ownerTeam || ownerTeam !== zone.team) {
        if (getZoneOverlap(entity, zone)) {
          return true;
        }
      }
    }

    return false;
  }

  loadEnemiesFromMap() {
    for (let spawn of this.map.getEnemySpawns()) {
      this.spawnEnemy(spawn.type, spawn.x, spawn.y);
    }
  }

  createEnemy(type, id, x, y) {
    switch (type) {
      default:
        return new Mannequin(id, x, y);
    }
  }

  spawnEnemy(type, x, y) {
    const id = "enemy_" + this.enemyCount++;
    this.enemies[id] = this.createEnemy(type, id, x, y);
  }

  spawnProjectile(config) {
    if (!config) return null;

    const id = "projectile_" + this.projectileCount++;
    let projectile = config;

    if (typeof projectile.setId === "function") {
      projectile = projectile.setId(id);
    } else {
      const kind = String(config.kind || "bomb").toLowerCase();
      if (kind === "bomb") {
        projectile = new BombProjectile(id, config);
      } else {
        return null;
      }
    }

    this.projectiles[projectile.id] = projectile;
    return projectile;
  }

  spawnHitscanTrace(config) {
    const id = "hitscan_" + this.hitscanTraceCount++;
    this.hitscanTraces[id] = {
      id,
      x1: config.x1,
      y1: config.y1,
      x2: config.x2,
      y2: config.y2,
      hitType: config.hitType || "wall",
      ttl: 6,
    };
  }

  updateHitscanTraces() {
    for (let id in this.hitscanTraces) {
      this.hitscanTraces[id].ttl--;
      if (this.hitscanTraces[id].ttl <= 0) {
        delete this.hitscanTraces[id];
      }
    }
  }

  rayVsAabb(originX, originY, dirX, dirY, boxX, boxY, boxW, boxH) {
    const invDx = dirX !== 0 ? 1 / dirX : Number.POSITIVE_INFINITY;
    const invDy = dirY !== 0 ? 1 / dirY : Number.POSITIVE_INFINITY;

    const t1 = (boxX - originX) * invDx;
    const t2 = (boxX + boxW - originX) * invDx;
    const t3 = (boxY - originY) * invDy;
    const t4 = (boxY + boxH - originY) * invDy;

    const tMin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
    const tMax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

    if (tMax < 0 || tMin > tMax) return null;
    return tMin >= 0 ? tMin : tMax;
  }

  getBoundaryDistance(originX, originY, dirX, dirY) {
    const candidates = [];
    const width = this.map.width || 2000;
    const height = this.map.height || 1000;

    if (dirX > 0) candidates.push((width - originX) / dirX);
    if (dirX < 0) candidates.push((0 - originX) / dirX);
    if (dirY > 0) candidates.push((height - originY) / dirY);
    if (dirY < 0) candidates.push((0 - originY) / dirY);

    const positive = candidates.filter((v) => Number.isFinite(v) && v > 0);
    if (positive.length === 0) return 0;

    return Math.min(...positive);
  }

  applyHitscan(shot, platforms) {
    const originX = shot.x;
    const originY = shot.y;
    const dirX = shot.dirX;
    const dirY = shot.dirY;
    const maxDistance = this.getBoundaryDistance(originX, originY, dirX, dirY);
    const ownerTeam = this.players[shot.ownerId]?.team || null;

    let nearestWallT = maxDistance;
    for (const plat of platforms) {
      const t = this.rayVsAabb(
        originX,
        originY,
        dirX,
        dirY,
        plat.x,
        plat.y,
        plat.w,
        plat.h,
      );
      if (t !== null && t >= 0 && t < nearestWallT) {
        nearestWallT = t;
      }
    }

    const zones = Array.isArray(this.map?.teamZones) ? this.map.teamZones : [];
    for (const zone of zones) {
      if (ownerTeam && ownerTeam === zone.team) continue;

      const t = this.rayVsAabb(
        originX,
        originY,
        dirX,
        dirY,
        zone.x,
        zone.y,
        zone.w,
        zone.h,
      );
      if (t !== null && t >= 0 && t < nearestWallT) {
        nearestWallT = t;
      }
    }

    let nearestPlayerId = null;
    let nearestPlayerT = Infinity;

    for (const id in this.players) {
      if (id === shot.ownerId) continue;

      const player = this.players[id];
      if (!player.alive || player.dead) continue;
      if (ownerTeam && player.team && ownerTeam === player.team) continue;

      const w = player.width || 20;
      const h = player.height || 20;

      const t = this.rayVsAabb(
        originX,
        originY,
        dirX,
        dirY,
        player.x,
        player.y,
        w,
        h,
      );

      if (t !== null && t >= 0 && t < nearestPlayerT) {
        nearestPlayerT = t;
        nearestPlayerId = id;
      }
    }

    let hitT = nearestWallT;
    let hitType = "wall";
    if (nearestPlayerId && nearestPlayerT <= nearestWallT) {
      hitT = nearestPlayerT;
      hitType = "enemy";
      const victim = this.players[nearestPlayerId];
      victim.hp = Math.max(0, (victim.hp || 100) - shot.damage);
      if (victim.hp <= 0) {
        this.killPlayer(nearestPlayerId, shot.ownerId);
      }
    }

    this.spawnHitscanTrace({
      x1: originX,
      y1: originY,
      x2: originX + dirX * hitT,
      y2: originY + dirY * hitT,
      hitType,
    });
  }

  spawnExplosion(config) {
    const id = "explosion_" + this.explosionCount++;
    this.explosions[id] = {
      id,
      x: config.x,
      y: config.y,
      radius: config.radius,
      ttl: 12,
      ownerId: config.ownerId,
      slowFactor: config.slowFactor || null,
      slowDurationFrames: config.slowDurationFrames || 0,
    };
  }

  applyExplosion(effect) {
    const ownerTeam = this.players[effect.ownerId]?.team || null;
    const hasSlow =
      Number.isFinite(effect.slowFactor) &&
      effect.slowFactor > 0 &&
      effect.slowFactor < 1 &&
      Number.isFinite(effect.slowDurationFrames) &&
      effect.slowDurationFrames > 0;

    const applyToEntity = (entity, isShaped) => {
      const width = entity.width || 20;
      const height = entity.height || 20;
      const cx = entity.x + width / 2;
      const cy = entity.y + height / 2;
      const dx = cx - effect.x;
      const dy = cy - effect.y;
      const distSq = dx * dx + dy * dy;
      const radiusSq = effect.radius * effect.radius;

      if (distSq > radiusSq) return false;

      const dist = Math.sqrt(distSq);
      const safeDistance = Math.max(dist, 0.001);
      const forceRatio = 1 - dist / effect.radius;
      const force = effect.force * forceRatio;
      entity.vx += (dx / safeDistance) * force;
      entity.vy += (dy / safeDistance) * force;

      const damage = Math.max(0, Math.round(effect.damage * forceRatio));
      entity.hp = Math.max(0, (entity.hp || 100) - damage);

      if (hasSlow && isShaped) {
        const currentFactor = Number.isFinite(entity.slowFactor)
          ? entity.slowFactor
          : 1;
        entity.slowFactor = Math.min(currentFactor, effect.slowFactor);
        entity.slowTimer = Math.max(
          Number(entity.slowTimer) || 0,
          Math.round(effect.slowDurationFrames),
        );
      }

      return entity.hp <= 0;
    };

    const playerIds = Object.keys(this.players);
    for (let i = 0; i < playerIds.length; i++) {
      const id = playerIds[i];
      const player = this.players[id];
      if (player.dead || !player.alive) continue;
      if (effect.ownerId && effect.ownerId === id) continue;
      if (ownerTeam && player.team && ownerTeam === player.team) continue;

      if (applyToEntity(player, true) && player.hp <= 0) {
        this.killPlayer(id, effect.ownerId);
      }
    }

    const enemyIds = Object.keys(this.enemies);
    for (let i = 0; i < enemyIds.length; i++) {
      const id = enemyIds[i];
      if (applyToEntity(this.enemies[id], false)) {
        delete this.enemies[id];
      }
    }
  }

  updateExplosions() {
    const expIds = Object.keys(this.explosions);
    for (let i = 0; i < expIds.length; i++) {
      const id = expIds[i];
      if (--this.explosions[id].ttl <= 0) {
        delete this.explosions[id];
      }
    }
  }

  updateProjectiles(platforms) {
    const projIds = Object.keys(this.projectiles);
    for (let i = 0; i < projIds.length; i++) {
      const id = projIds[i];
      const projectile = this.projectiles[id];
      projectile.update();

      if (projectile.kind === "bomb") {
        const ownerTeam = this.players[projectile.ownerId]?.team || null;
        let shouldExplode =
          !projectile.alive || projectile.collidesWithPlatform(platforms);

        if (
          !shouldExplode &&
          this.collidesWithBlockingZonesForTeam(projectile, ownerTeam)
        ) {
          shouldExplode = true;
        }

        if (!shouldExplode) {
          const playerIds = Object.keys(this.players);
          for (let j = 0; j < playerIds.length; j++) {
            const playerId = playerIds[j];
            if (playerId === projectile.ownerId) continue;

            const player = this.players[playerId];
            if (!player || player.dead || !player.alive) continue;
            if (ownerTeam && player.team && ownerTeam === player.team) continue;

            if (projectile.hitsEntity(player)) {
              shouldExplode = true;
              break;
            }
          }
        }

        if (!shouldExplode) {
          const enemyIds = Object.keys(this.enemies);
          for (let j = 0; j < enemyIds.length; j++) {
            const enemy = this.enemies[enemyIds[j]];
            if (!enemy.alive) continue;
            if (projectile.hitsEntity(enemy)) {
              shouldExplode = true;
              break;
            }
          }
        }

        if (shouldExplode) {
          const effect = projectile.createExplosionPayload();
          this.applyExplosion(effect);
          this.spawnExplosion(effect);
          delete this.projectiles[id];
        }
        continue;
      }

      const ownerTeam = this.players[projectile.ownerId]?.team || null;

      if (
        !projectile.alive ||
        projectile.collidesWithPlatform(platforms) ||
        this.collidesWithBlockingZonesForTeam(projectile, ownerTeam)
      ) {
        this.spawnExplosion({
          x: projectile.x,
          y: projectile.y,
          radius: 18,
          ownerId: projectile.ownerId,
        });
        delete this.projectiles[id];
        continue;
      }

      let directHit = false;
      const playerIds = Object.keys(this.players);
      for (let j = 0; j < playerIds.length; j++) {
        const playerId = playerIds[j];
        if (playerId === projectile.ownerId) continue;

        const player = this.players[playerId];
        if (!player || player.dead || !player.alive) continue;
        if (ownerTeam && player.team && ownerTeam === player.team) continue;

        if (projectile.hitsEntity(player)) {
          player.hp = Math.max(
            0,
            (player.hp || 100) - (projectile.damage || 0),
          );
          if (player.hp <= 0) {
            this.killPlayer(playerId, projectile.ownerId);
          }
          this.spawnExplosion({
            x: projectile.x,
            y: projectile.y,
            radius: 16,
            ownerId: projectile.ownerId,
          });
          directHit = true;
          break;
        }
      }

      if (directHit) {
        delete this.projectiles[id];
        continue;
      }

      const enemyIds = Object.keys(this.enemies);
      for (let j = 0; j < enemyIds.length; j++) {
        const enemyId = enemyIds[j];
        const enemy = this.enemies[enemyId];
        if (!enemy || !enemy.alive) continue;

        if (projectile.hitsEntity(enemy)) {
          enemy.hp = Math.max(0, (enemy.hp || 100) - (projectile.damage || 0));
          if (enemy.hp <= 0) {
            delete this.enemies[enemyId];
          }
          this.spawnExplosion({
            x: projectile.x,
            y: projectile.y,
            radius: 16,
            ownerId: projectile.ownerId,
          });
          delete this.projectiles[id];
          break;
        }
      }
    }
  }

  addPlayer(socket, options = {}) {
    const role = socket.data.role || "ninja";
    const nickname = socket.data.nickname || "Player";
    const requestedTeam = normalizeTeam(options.team || socket.data.team);

    const team = this.assignTeam(requestedTeam);
    if (!team) {
      return { ok: false, code: "TEAM_FULL" };
    }

    const player = this.createPlayer(role, socket.id);
    player.nickname = nickname;
    player.team = team;
    player.kills = Number(player.kills) || 0;
    player.deaths = Number(player.deaths) || 0;
    player.dead = false;
    player.alive = true;
    player.respawnTimer = 0;
    player.slowTimer = 0;
    player.slowFactor = 1;
    player.speedMultiplier = 1;
    player.hp = 100;

    this.players[socket.id] = player;
    this.emptySince = null;
    this.spawnAtTeam(player, team);

    if (!this.leaderId) {
      this.leaderId = socket.id;
    }

    socket.on("input", (input) => {
      const p = this.players[socket.id];
      if (p) p.setInput(input);
    });

    socket.on("changeClass", (type, ack) => {
      const old = this.players[socket.id];
      if (!old) {
        if (typeof ack === "function") ack({ ok: false, code: "NO_PLAYER" });
        return;
      }

      // During an active match, hero switch is allowed only while dead.
      if (this.started && !old.dead) {
        if (typeof ack === "function") {
          ack({ ok: false, code: "CHANGE_CLASS_FORBIDDEN" });
        }
        return;
      }

      const next = this.createPlayer(type, socket.id);
      next.x = old.x;
      next.y = old.y;
      next.nickname = old.nickname || nickname;
      next.team = old.team;
      next.kills = old.kills || 0;
      next.deaths = old.deaths || 0;
      next.dead = old.dead;
      next.alive = old.alive;
      next.respawnTimer = old.respawnTimer || 0;
      next.slowTimer = old.slowTimer || 0;
      next.slowFactor = Number.isFinite(old.slowFactor) ? old.slowFactor : 1;
      next.speedMultiplier = Number.isFinite(old.speedMultiplier)
        ? old.speedMultiplier
        : 1;
      next.hp = old.hp || 100;

      this.players[socket.id] = next;

      if (typeof ack === "function") {
        ack({ ok: true });
      }
    });

    socket.on("startRoom", (ack) => {
      if (socket.id !== this.leaderId) {
        if (typeof ack === "function") {
          ack({ ok: false, code: "NOT_LEADER" });
        }
        return;
      }

      const result = this.startRoom(socket.id);
      if (typeof ack === "function") {
        ack(result || { ok: true });
      }
    });

    socket.on("disconnect", () => {
      const leftPlayer = this.players[socket.id];
      delete this.players[socket.id];

      if (this.leaderId === socket.id) {
        const nextLeader = pickRandomPlayerId(this.players);
        this.leaderId = nextLeader;
      }

      if (Object.keys(this.players).length === 0) {
        if (this.started) {
          this.emptySince = Date.now();
        } else {
          delete sessions[this.room];
        }
      }
    });

    return {
      ok: true,
      team,
      leaderId: this.leaderId,
      roomState: this.getRoomState(),
    };
  }

  startLoop() {
    const stepMs = 1000 / 60;

    const tick = () => {
      if (Object.keys(this.players).length === 0) {
        if (!this.emptySince) {
          this.emptySince = Date.now();
        }

        if (Date.now() - this.emptySince >= EMPTY_STARTED_ROOM_GRACE_MS) {
          this.started = false;
          this.winnerTeam = null;
          delete sessions[this.room];
          return;
        }

        setTimeout(tick, stepMs);
        return;
      }

      const startedAt = performance.now();

      const state = {};
      const projectileState = {};
      const hitscanTraceState = {};
      const explosionState = {};
      const pendingExplosions = [];
      const platforms = this.map.getPlatforms();

      if (this.started) {
        const playerIds = Object.keys(this.players);
        for (let i = 0; i < playerIds.length; i++) {
          const id = playerIds[i];
          const p = this.players[id];

          if (p.dead) {
            p.respawnTimer = Math.max(0, (p.respawnTimer || 0) - 1);
            if (p.respawnTimer === 0) {
              this.respawnPlayer(p);
            }
            state[id] = p.getState();
            continue;
          }

          if ((p.slowTimer || 0) > 0) {
            p.slowTimer = Math.max(0, p.slowTimer - 1);
            p.speedMultiplier = Number.isFinite(p.slowFactor)
              ? Math.max(0.1, Math.min(1, p.slowFactor))
              : 1;

            if (p.slowTimer === 0) {
              p.slowFactor = 1;
              p.speedMultiplier = 1;
            }
          } else {
            p.slowFactor = 1;
            p.speedMultiplier = 1;
          }

          p.update({
            platforms,
            players: this.players,
            enemies: this.enemies,
            aimX: p.input.aimX,
            aimY: p.input.aimY,
          });
          updatePhysics(p, platforms);
          this.resolveTeamZones(p);

          if (this.isPlayerOutOfBounds(p)) {
            this.killPlayer(id, null);
            state[id] = p.getState();
            continue;
          }

          if (typeof p.consumeShot === "function") {
            const shot = p.consumeShot();
            if (shot) this.spawnProjectile(shot);
          }

          if (typeof p.consumeHitscan === "function") {
            const shot = p.consumeHitscan();
            if (shot) {
              const payload =
                typeof shot.toShot === "function" ? shot.toShot() : shot;
              this.applyHitscan(payload, platforms);
            }
          }

          if (typeof p.consumeExplosion === "function") {
            const explosion = p.consumeExplosion();
            if (explosion) pendingExplosions.push(explosion);
          }

          if (p.hp <= 0) {
            this.killPlayer(id, p.lastAttackerId || null);
          }

          state[id] = p.getState();
        }
      } else {
        const playerIds = Object.keys(this.players);
        for (let i = 0; i < playerIds.length; i++) {
          const id = playerIds[i];
          state[id] = this.players[id].getState();
        }
      }

      for (let effect of pendingExplosions) {
        this.applyExplosion(effect);
        this.spawnExplosion(effect);
      }

      this.updateProjectiles(platforms);
      this.updateHitscanTraces();
      this.updateExplosions();

      const projIds = Object.keys(this.projectiles);
      for (let i = 0; i < projIds.length; i++) {
        const id = projIds[i];
        projectileState[id] = this.projectiles[id].getState();
      }

      const expIds = Object.keys(this.explosions);
      for (let i = 0; i < expIds.length; i++) {
        const id = expIds[i];
        explosionState[id] = this.explosions[id];
      }

      const hitscanIds = Object.keys(this.hitscanTraces);
      for (let i = 0; i < hitscanIds.length; i++) {
        const id = hitscanIds[i];
        hitscanTraceState[id] = this.hitscanTraces[id];
      }

      this.io.to(this.room).emit("state", {
        players: state,
        room: this.getRoomState(),
        enemies: {},
        projectiles: projectileState,
        hitscanTraces: hitscanTraceState,
        explosions: explosionState,
        map: platforms,
      });

      const elapsed = performance.now() - startedAt;
      setTimeout(tick, Math.max(0, stepMs - elapsed));
    };

    tick();
  }
}

module.exports = {
  MAX_ROOM_PLAYERS,

  normalizeRoomName,

  normalizeRoomMode,

  normalizeTeam,

  listRoomModes() {
    return teamDeathmatch.listModes();
  },

  listOpenRooms() {
    return Object.entries(sessions)
      .map(([roomName, session]) => {
        const summary = session.getRoomSummary();
        return {
          ...summary,
          room: roomName,
        };
      })
      .sort((a, b) => a.room.localeCompare(b.room));
  },

  ensureRoomExists(room, io, roomMode) {
    const normalizedRoom = normalizeRoomName(room);
    if (!normalizedRoom) return null;

    if (!sessions[normalizedRoom]) {
      sessions[normalizedRoom] = new DevSession(normalizedRoom, io, roomMode);
    }

    return normalizedRoom;
  },

  isRoomJoinable(room) {
    const normalizedRoom = normalizeRoomName(room);
    if (!normalizedRoom) return false;

    const session = sessions[normalizedRoom];
    if (!session) return true;

    return Object.keys(session.players).length < session.rules.maxPlayers;
  },

  getRoomSession(room) {
    return sessions[normalizeRoomName(room)] || null;
  },

  getRoomLobby(room) {
    const normalizedRoom = normalizeRoomName(room);
    if (!normalizedRoom) return null;

    const session = sessions[normalizedRoom];
    if (!session) return null;
    return session.getRoomLobbySnapshot();
  },

  onJoin(socket, io, room, options = {}) {
    const normalizedRoom = normalizeRoomName(room);
    if (!normalizedRoom) {
      return { ok: false, code: "INVALID_ROOM" };
    }

    const session = sessions[normalizedRoom];
    if (!session) {
      return { ok: false, code: "ROOM_NOT_FOUND" };
    }

    const requestedMode = normalizeRoomMode(options.roomMode || session.mode);
    if (session.mode !== requestedMode) {
      return { ok: false, code: "ROOM_MODE_MISMATCH" };
    }

    if (Object.keys(session.players).length >= session.rules.maxPlayers) {
      return {
        ok: false,
        code: "ROOM_FULL",
        maxPlayers: session.rules.maxPlayers,
      };
    }

    const joinResult = session.addPlayer(socket, options);
    if (!joinResult.ok) return joinResult;

    return {
      ok: true,
      room: normalizedRoom,
      players: Object.keys(session.players).length,
      maxPlayers: session.rules.maxPlayers,
      roomState: session.getRoomState(),
    };
  },
};
