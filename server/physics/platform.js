function resolvePlatformCollision(p, platforms) {
  const w = p.width || 20;
  const h = p.height || 20;

  // 🔥 STORE PREVIOUS WALL STATE (IMPORTANT FIX)
  const wasOnWall = p.onWall;

  p.onWall = false;
  p.wallSide = null;
  p.justLanded = false;

  for (let plat of platforms) {
    const overlapX = p.x < plat.x + plat.w && p.x + w > plat.x;
    const overlapY = p.y < plat.y + plat.h && p.y + h > plat.y;

    if (!overlapX || !overlapY) continue;

    const prevBottom = p.prevY + h;
    const prevTop = p.prevY;
    const prevRight = p.prevX + w;
    const prevLeft = p.prevX;

    const platTop = plat.y;
    const platBottom = plat.y + plat.h;
    const platLeft = plat.x;
    const platRight = plat.x + plat.w;

    // ======================
    // SOL
    // ======================
    if (prevBottom <= platTop && p.vy >= 0) {
      p.y = platTop - h;
      p.vy = 0;
      p.onGround = true;
      p.justLanded = true;
      continue;
    }

    // ======================
    // PLAFOND
    // ======================
    if (prevTop >= platBottom && p.vy <= 0) {
      p.y = platBottom;
      p.vy = 0;
      continue;
    }

    // ======================
    // MURS
    // ======================
    const movingRight = p.vx > 0;
    const movingLeft = p.vx < 0;

    if (prevRight <= platLeft && movingRight) {
      p.x = platLeft - w;
      p.vx = 0;
      p.onWall = true;
      p.wallSide = "right";
      continue;
    }

    if (prevLeft >= platRight && movingLeft) {
      p.x = platRight;
      p.vx = 0;
      p.onWall = true;
      p.wallSide = "left";
      continue;
    }
  }

  // 🔥 BONUS SAFE FLAG (utile debug + stabilité)
  p.onWallJustTouched = !wasOnWall && p.onWall;
}

module.exports = {
  resolvePlatformCollision,
};
