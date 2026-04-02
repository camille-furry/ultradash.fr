const Map = require("../map");

class DevMap extends Map {
  constructor() {
    super();

    this.width = 2000;
    this.height = 1000;

    this.platforms = [
      // ===== SOL PRINCIPAL =====
      { x: 0, y: 600, w: 2000, h: 50 },

      // ===== PLATEFORMES ESCALIER =====
      { x: 200, y: 500, w: 150, h: 20 },
      { x: 400, y: 420, w: 150, h: 20 },
      { x: 600, y: 340, w: 150, h: 20 },

      // ===== PLATEFORME HAUTE =====
      { x: 850, y: 260, w: 200, h: 20 },

      // ===== ZONE DASH =====
      { x: 1100, y: 600, w: 600, h: 50 },

      // ===== MURS =====
      { x: 0, y: 300, w: 20, h: 300 },
      { x: 1200, y: 300, w: 20, h: 300 },

      // ===== PUITS =====
      { x: 1400, y: 600, w: 200, h: 50 },
      { x: 1700, y: 600, w: 300, h: 50 },
      { x: 1500, y: 450, w: 150, h: 20 },

      // ===== COMBO =====
      { x: 300, y: 250, w: 20, h: 200 },
      { x: 320, y: 250, w: 120, h: 20 },
    ];

    // =====================
    // ENEMY SPAWNS 👇
    // =====================
    this.enemySpawns = [
      {
        type: "mannequin",
        x: 500,
        y: 100,
      },
    ];
  }
}

module.exports = DevMap;
