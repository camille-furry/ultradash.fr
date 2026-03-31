class Map {
  constructor() {
    this.width = 2000;
    this.height = 1000;
    this.platforms = [
      { x: 0, y: 550, w: 800, h: 50 },   // sol
      { x: 150, y: 450, w: 200, h: 20 },
      { x: 450, y: 350, w: 200, h: 20 },
    ];
  }

  getPlatforms() {
    return this.platforms;
  }
}

module.exports = Map;