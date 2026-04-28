const { ROOM_NAME_PATTERN, FRONTEND_ORIGIN, SERVER_ORIGIN, normalizeRoomName } =
  window.LobbyCommon;

const DEFAULT_MODE = "team3v3";

async function loadRoomModes(modeSelect) {
  if (!modeSelect) return [DEFAULT_MODE];

  modeSelect.innerHTML = "";
  let modes = [{ key: DEFAULT_MODE, label: "3v3" }];

  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/multi/room-modes`);
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload.modes) && payload.modes.length > 0) {
        modes = payload.modes.map((mode) => ({
          key: String(mode.key || DEFAULT_MODE),
          label: String(mode.label || mode.key || DEFAULT_MODE),
        }));
      }
    }
  } catch (error) {
    // Keep local fallback mode if API is unavailable.
  }

  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const option = document.createElement("option");
    option.value = mode.key;
    option.textContent = mode.label;
    modeSelect.appendChild(option);
  }

  const savedMode = localStorage.getItem("pendingMultiMode") || DEFAULT_MODE;
  if (modes.some((mode) => mode.key === savedMode)) {
    modeSelect.value = savedMode;
  }

  return modes.map((mode) => mode.key);
}

async function loadRooms(elements) {
  const { roomsList, emptyMessage, maxPlayersLabel } = elements;

  roomsList.innerHTML = "";
  emptyMessage.textContent = "Chargement des rooms...";

  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/multi/rooms`);
    if (!response.ok) {
      throw new Error("Unable to load rooms");
    }

    const payload = await response.json();
    const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
    const maxPlayers = Number(payload.maxPlayers) || 6;

    maxPlayersLabel.textContent = `${maxPlayers} joueurs max par room`;

    if (rooms.length === 0) {
      emptyMessage.textContent = "Aucune room ouverte pour le moment.";
      return;
    }

    emptyMessage.textContent = "";

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const roomValue = normalizeRoomName(room.room);
      if (!roomValue) continue;

      const item = document.createElement("li");
      item.className = "roomItem";
      const players = Number(room.players) || 0;
      const joinable = room.isJoinable !== false;
      const teamCounts = room.teamCounts || { red: 0, blue: 0 };

      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${roomValue} · ${room.modeLabel || "3v3"}`;
      const count = document.createElement("small");
      const startedLabel = room.started ? "En cours" : "Lobby";
      count.textContent = `${startedLabel} · ${players}/${maxPlayers} · T1:${teamCounts.red || 0} T2:${teamCounts.blue || 0}`;
      details.appendChild(title);
      details.appendChild(count);

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.room = roomValue;
      button.dataset.mode = room.mode || "team3v3";
      button.textContent = joinable ? "Rejoindre" : "Complet";
      button.disabled = !joinable;

      item.appendChild(details);
      item.appendChild(button);

      roomsList.appendChild(item);
    }
  } catch (error) {
    emptyMessage.textContent = "Impossible de charger les rooms.";
  }
}

function goToTeamPage(room, mode) {
  localStorage.setItem("pendingMultiRoom", room);
  localStorage.setItem("pendingMultiMode", mode || "team3v3");

  const params = new URLSearchParams({
    room,
    roomMode: mode || "team3v3",
  });

  window.location.href = `${FRONTEND_ORIGIN}/multi/team.html?${params.toString()}`;
}

window.addEventListener("DOMContentLoaded", async () => {
  const elements = {
    roomModeSelect: document.getElementById("roomModeSelect"),
    roomNameInput: document.getElementById("roomNameInput"),
    createRoomButton: document.getElementById("createRoomButton"),
    refreshRoomsButton: document.getElementById("refreshRoomsButton"),
    roomsList: document.getElementById("roomsList"),
    emptyMessage: document.getElementById("roomsEmpty"),
    statusLine: document.getElementById("statusLine"),
    maxPlayersLabel: document.getElementById("maxPlayersLabel"),
  };

  if (!elements.roomsList) {
    return;
  }

  await loadRoomModes(elements.roomModeSelect);

  await loadRooms(elements);

  elements.refreshRoomsButton?.addEventListener("click", () => {
    loadRooms(elements);
  });

  elements.roomsList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const room = target.dataset.room;
    const roomMode = target.dataset.mode || "team3v3";
    if (!room) return;

    goToTeamPage(room, roomMode);
  });

  elements.createRoomButton?.addEventListener("click", async () => {
    const roomCandidate = normalizeRoomName(
      elements.roomNameInput?.value || "",
    );

    if (!ROOM_NAME_PATTERN.test(roomCandidate)) {
      elements.statusLine.textContent =
        "Nom de room invalide (1-24, a-z, 0-9, _ et -).";
      return;
    }

    const selectedMode =
      elements.roomModeSelect?.value ||
      localStorage.getItem("pendingMultiMode") ||
      DEFAULT_MODE;

    elements.statusLine.textContent = "Creation de la room...";

    try {
      const response = await fetch(`${SERVER_ORIGIN}/api/multi/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomCandidate,
          mode: selectedMode,
        }),
      });

      if (!response.ok) {
        elements.statusLine.textContent = "Impossible de creer cette room.";
        return;
      }

      localStorage.setItem("pendingMultiMode", selectedMode);
      goToTeamPage(roomCandidate, selectedMode);
    } catch (error) {
      elements.statusLine.textContent = "Erreur reseau pendant la creation.";
    }
  });
});
