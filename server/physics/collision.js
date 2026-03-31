function resolvePlatformCollision(p, platforms) {
  const playerWidth = 20;
  const playerHeight = 20;

  for (let plat of platforms) {

    const isOverlappingX =
      p.x < plat.x + plat.w &&
      p.x + playerWidth > plat.x;

    const isFalling = p.vy >= 0;

    const prevY = p.y - p.vy;

    const wasAbove = prevY + playerHeight <= plat.y;
    const isBelow = p.y + playerHeight >= plat.y;

    // SOL COLLISION (only landing)
    if (isOverlappingX && isFalling && wasAbove && isBelow) {
      p.y = plat.y - playerHeight;
      p.vy = 0;
      p.onGround = true;
    }
  }
}

module.exports = {
  resolvePlatformCollision
};