const { resolvePlatformCollision } = require("./platform");

function updatePhysics(entity, platforms) {
  entity.onGround = false;
  entity.onWall = false;
  entity.wallSide = null;

  resolvePlatformCollision(entity, platforms);

  // RESET JUMP (ok)
  if (entity.onGround && !entity.wasOnGround) {
    entity.jumpsLeft = entity.maxJumps;
  }

  entity.wasOnGround = entity.onGround;
}

module.exports = { updatePhysics };
