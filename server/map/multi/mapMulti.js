const Map = require("../map");

class MultiMap extends Map {
  constructor(config = {}) {
    super();

    this.key = config.key || "unknown";
    this.name = config.name || "Unknown";
    this.backgroundUrl = config.backgroundUrl || null;
    this.width = config.width || 2000;
    this.height = config.height || 1000;
    this.teamSpawns = config.teamSpawns || null;
    this.teamZones = Array.isArray(config.teamZones) ? config.teamZones : [];
    this.platforms = Array.isArray(config.platforms) ? config.platforms : [];
    this.enemySpawns = Array.isArray(config.enemySpawns)
      ? config.enemySpawns
      : [];
  }
}

const AVALON_CONFIG = {
  key: "avalon",
  name: "Avalon",
  backgroundUrl: "/multi-map-assets/Avalon/background/Avalon.webp",
  width: 2000,
  height: 1000,
  teamSpawns: {
    red: { x: 165 },
    blue: { x: 1835 },
  },
  teamZones: [
    { team: "red", x: 0, y: 450, w: 380, h: 250 },
    { team: "blue", x: 1620, y: 450, w: 380, h: 250 },
  ],
  platforms: [
    { x: 0, y: 670, w: 2000, h: 50, style: "ruin" },
    { x: 35, y: 610, w: 210, h: 22, style: "ruin" },
    { x: 1755, y: 610, w: 210, h: 22, style: "ruin" },
    { x: 220, y: 560, w: 150, h: 20, style: "ruin" },
    { x: 1630, y: 560, w: 150, h: 20, style: "ruin" },
    { x: 410, y: 515, w: 180, h: 20, style: "pillar" },
    { x: 1410, y: 515, w: 180, h: 20, style: "pillar" },
    { x: 650, y: 455, w: 170, h: 20, style: "ruin" },
    { x: 1180, y: 455, w: 170, h: 20, style: "ruin" },
    { x: 845, y: 400, w: 310, h: 22, style: "altar" },
    { x: 560, y: 335, w: 130, h: 18, style: "pillar" },
    { x: 1310, y: 335, w: 130, h: 18, style: "pillar" },
    { x: 765, y: 275, w: 120, h: 18, style: "pillar" },
    { x: 1115, y: 275, w: 120, h: 18, style: "pillar" },
    { x: 940, y: 235, w: 120, h: 18, style: "altar" },
    { x: 0, y: 360, w: 22, h: 310, style: "wall" },
    { x: 1978, y: 360, w: 22, h: 310, style: "wall" },
  ],
};

const SYBERIA_CONFIG = {
  key: "syberia",
  name: "Syberia",
  backgroundUrl: "/multi-map-assets/Syberia/background/syberia.jpg",
  width: 2000,
  height: 1000,
  teamSpawns: {
    red: { x: 150 },
    blue: { x: 1850 },
  },
  teamZones: [
    { team: "red", x: 0, y: 410, w: 380, h: 290 },
    { team: "blue", x: 1620, y: 410, w: 380, h: 290 },
  ],
  platforms: [
    { x: 0, y: 630, w: 2000, h: 70, style: "ice" },
    { x: 25, y: 585, w: 280, h: 20, style: "ice" },
    { x: 1695, y: 585, w: 280, h: 20, style: "ice" },
    { x: 360, y: 560, w: 230, h: 18, style: "steel" },
    { x: 1410, y: 560, w: 230, h: 18, style: "steel" },
    { x: 640, y: 540, w: 720, h: 24, style: "core" },
    { x: 930, y: 490, w: 140, h: 16, style: "bridge" },
    { x: 760, y: 460, w: 90, h: 14, style: "bridge" },
    { x: 1150, y: 460, w: 90, h: 14, style: "bridge" },
    { x: 0, y: 300, w: 20, h: 330, style: "wall" },
    { x: 1980, y: 300, w: 20, h: 330, style: "wall" },
  ],
};

const MULTI_MAP_CONFIGS = [AVALON_CONFIG, SYBERIA_CONFIG];

function createMultiMap(mapKey) {
  const normalized = String(mapKey || "")
    .trim()
    .toLowerCase();
  const picked =
    MULTI_MAP_CONFIGS.find((entry) => entry.key === normalized) ||
    MULTI_MAP_CONFIGS[Math.floor(Math.random() * MULTI_MAP_CONFIGS.length)];

  return new MultiMap(picked);
}

module.exports = {
  MULTI_MAP_CONFIGS,
  createMultiMap,
};
