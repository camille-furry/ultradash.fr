class Map {
  constructor() {
    this.width = 2000;
    this.height = 1000;
    this.platforms = [];
  }

  getPlatforms() {
    return this.platforms;
  }
}

module.exports = Map;