const Hero = require("../hero");

class Accrobate extends Hero {
  constructor(id) {
    super(id);

    this.speed = 5;

    this.maxJumps = 2;
    this.jumpsLeft = 2;

    this.jumpPower = 12;
  }
}

module.exports = Accrobate;
