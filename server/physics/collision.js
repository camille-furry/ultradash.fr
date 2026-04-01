function resolvePlatformCollision(p, platforms) {
  const w = 20;
  const h = 20;

  p.touchingWallLeft = false;
  p.touchingWallRight = false;
  p.onGround = false;

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

    // =====================
    // SOL
    // =====================
    if (prevBottom <= platTop && p.vy >= 0) {
      p.y = platTop - h;
      p.vy = 0;
      p.onGround = true;
      continue;
    }

    // =====================
    // PLAFOND
    // =====================
    if (prevTop >= platBottom && p.vy <= 0) {
      p.y = platBottom;
      p.vy = 0;
      continue;
    }

    // =====================
    // MUR DROIT (joueur vient de gauche)
    // =====================
    if (prevRight <= platLeft) {
      if (p.wallJumpIgnore === 0) {
        p.x = platLeft - w;
        p.vx = 0;
        p.touchingWallRight = true;
      }
    }

    // =====================
    // MUR GAUCHE (joueur vient de droite)
    // =====================
    if (prevLeft >= platRight) {
      if (p.wallJumpIgnore === 0) {
        p.x = platRight;
        p.vx = 0;
        p.touchingWallLeft = true;
      }
    }
  }

  // =====================
  // WALL STATE
  // =====================
  p.onWall = p.touchingWallLeft || p.touchingWallRight;

  p.wallSide = p.touchingWallLeft
    ? "left"
    : p.touchingWallRight
      ? "right"
      : null;

  // =====================
  // RESET JUMPS ON GROUND
  // =====================
  if (p.onGround) {
    p.jumpsLeft = p.maxJumps;
  }
}

module.exports = {
  resolvePlatformCollision,
};
