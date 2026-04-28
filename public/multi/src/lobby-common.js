(function () {
  const FRONTEND_ORIGIN = "http://localhost:8000";
  const SERVER_ORIGIN = "http://localhost:3000";
  const ROOM_NAME_PATTERN = /^[a-z0-9_-]{1,24}$/;

  function normalizeRoomName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
  }

  function toLabel(name) {
    return (
      String(name || "")
        .charAt(0)
        .toUpperCase() + String(name || "").slice(1)
    );
  }

  window.LobbyCommon = {
    FRONTEND_ORIGIN,
    SERVER_ORIGIN,
    ROOM_NAME_PATTERN,
    normalizeRoomName,
    toLabel,
  };
})();
