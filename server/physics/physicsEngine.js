const { resolvePlatformCollision } = require("./platform");

function updatePhysics(entity, platforms) {
  entity.onGround = false;
  entity.onWall = false;
  entity.wallSide = null;

  resolvePlatformCollision(entity, platforms);

  if (entity.justLanded) {
    entity.jumpsLeft = entity.maxJumps;
  }

  entity.wasOnGround = entity.onGround;
}

module.exports = { updatePhysics };
