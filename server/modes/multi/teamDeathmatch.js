const DEFAULT_ROOM_MODE = "team3v3";

const ROOM_MODES = {
  team3v3: {
    key: "team3v3",
    label: "3v3",
    maxPlayers: 6,
    teamSize: 3,
    targetKills: 50,
  },
};

const TEAM_SPAWNS = {
  red: { x: 110, y: 100 },
  blue: { x: 460, y: 100 },
};

function normalizeRoomMode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ROOM_MODES[normalized] ? normalized : DEFAULT_ROOM_MODE;
}

function normalizeTeam(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "blue" || normalized === "red" ? normalized : null;
}

function getModeRules(modeKey) {
  return (
    ROOM_MODES[normalizeRoomMode(modeKey)] || ROOM_MODES[DEFAULT_ROOM_MODE]
  );
}

function listModes() {
  return Object.values(ROOM_MODES).map((mode) => ({
    key: mode.key,
    label: mode.label,
    maxPlayers: mode.maxPlayers,
    teamSize: mode.teamSize,
    targetKills: mode.targetKills,
  }));
}

function getTeamCounts(players) {
  const counts = { red: 0, blue: 0 };

  for (const player of Object.values(players || {})) {
    if (player.team === "red") counts.red++;
    if (player.team === "blue") counts.blue++;
  }

  return counts;
}

function assignTeam(players, requestedTeam, teamSize) {
  const counts = getTeamCounts(players);

  if (requestedTeam && counts[requestedTeam] < teamSize) {
    return requestedTeam;
  }

  if (counts.red < teamSize && counts.red <= counts.blue) return "red";
  if (counts.blue < teamSize) return "blue";
  if (counts.red < teamSize) return "red";

  return null;
}

function getSpawnForTeam(team) {
  return TEAM_SPAWNS[team] || TEAM_SPAWNS.red;
}

function getSpawnGroundY(map, spawnX, fallbackY, playerHeight) {
  if (!map || typeof map.getPlatforms !== "function") {
    return Number.isFinite(fallbackY) ? fallbackY : 100;
  }

  const platforms = map.getPlatforms();
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return Number.isFinite(fallbackY) ? fallbackY : 100;
  }

  let bestPlatformY = null;
  for (let i = 0; i < platforms.length; i++) {
    const plat = platforms[i];
    if (spawnX < plat.x || spawnX > plat.x + plat.w) continue;

    if (bestPlatformY === null || plat.y > bestPlatformY) {
      bestPlatformY = plat.y;
    }
  }

  if (bestPlatformY === null) {
    return Number.isFinite(fallbackY) ? fallbackY : 100;
  }

  return bestPlatformY - playerHeight;
}

function spawnAtTeam(player, team, map = null) {
  const baseSpawn = getSpawnForTeam(team);
  const mapSpawn = map?.teamSpawns?.[team] || map?.teamSpawns?.red || {};
  const spawnX = Number.isFinite(mapSpawn.x) ? mapSpawn.x : baseSpawn.x;
  const spawnY = Number.isFinite(mapSpawn.y) ? mapSpawn.y : baseSpawn.y;
  const playerHeight = Number(player.height) || 20;

  player.x = spawnX;
  player.y = getSpawnGroundY(map, spawnX, spawnY, playerHeight);
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.onWall = false;
  player.wallSide = null;
}

function resetPlayerForRound(player) {
  player.dead = false;
  player.alive = true;
  player.respawnTimer = 0;
  player.slowTimer = 0;
  player.slowFactor = 1;
  player.speedMultiplier = 1;
  player.hp = 100;
}

function applyKillAndCheckWinner(players, killerId, victimId, targetKills) {
  const killer = players[killerId];
  const victim = players[victimId];

  if (killer && killerId !== victimId) {
    killer.kills = (killer.kills || 0) + 1;
  }

  if (victim) {
    victim.deaths = (victim.deaths || 0) + 1;
  }

  if (killer && killer.kills >= targetKills) {
    return killer.team || null;
  }

  return null;
}

module.exports = {
  DEFAULT_ROOM_MODE,
  ROOM_MODES,
  TEAM_SPAWNS,
  normalizeRoomMode,
  normalizeTeam,
  getModeRules,
  listModes,
  getTeamCounts,
  assignTeam,
  getSpawnForTeam,
  spawnAtTeam,
  resetPlayerForRound,
  applyKillAndCheckWinner,
};
