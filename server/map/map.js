class Map {
  constructor() {
    this.width = 2000;
    this.height = 1000;

    this.platforms = [];

    // 👇 NOUVEAU
    this.enemySpawns = [];
  }

  getPlatforms() {
    return this.platforms;
  }

  // 👇 NOUVEAU
  getEnemySpawns() {
    return this.enemySpawns;
  }
}

module.exports = Map;
