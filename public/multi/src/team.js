const { ROOM_NAME_PATTERN, FRONTEND_ORIGIN, SERVER_ORIGIN, normalizeRoomName } =
  window.LobbyCommon;

function parseRoom() {
  const params = new URLSearchParams(window.location.search);
  return normalizeRoomName(
    params.get("room") || localStorage.getItem("pendingMultiRoom") || "",
  );
}

async function fetchRoomSnapshot(room) {
  const response = await fetch(
    `${SERVER_ORIGIN}/api/multi/rooms/${encodeURIComponent(room)}`,
  );
  if (!response.ok) {
    throw new Error("ROOM_FETCH_FAILED");
  }
  return response.json();
}

function renderTeamList(listEl, players) {
  listEl.innerHTML = "";
  if (!players || players.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Aucun joueur";
    listEl.appendChild(empty);
    return;
  }

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const row = document.createElement("li");
    row.textContent = `${player.nickname}${player.leader ? " (chef)" : ""}`;
    listEl.appendChild(row);
  }
}

function goToHeroSelect(room, team, nickname, mode) {
  localStorage.setItem("pendingMultiRoom", room);
  localStorage.setItem("pendingMultiTeam", team);
  localStorage.setItem("pendingMultiMode", mode || "team3v3");
  localStorage.setItem("playerNickname", nickname);

  const params = new URLSearchParams({
    room,
    team,
    roomMode: mode || "team3v3",
    nickname,
  });
  window.location.href = `${FRONTEND_ORIGIN}/multi/hero-select.html?${params.toString()}`;
}

window.addEventListener("DOMContentLoaded", async () => {
  const room = parseRoom();
  const nicknameInput = document.getElementById("nicknameInput");
  const teamRoomLabel = document.getElementById("teamRoomLabel");
  const redList = document.getElementById("teamRedList");
  const blueList = document.getElementById("teamBlueList");
  const redCount = document.getElementById("teamRedCount");
  const blueCount = document.getElementById("teamBlueCount");
  const joinRedBtn = document.getElementById("joinRedBtn");
  const joinBlueBtn = document.getElementById("joinBlueBtn");
  const statusLine = document.getElementById("statusLine");
  const backLobbyBtn = document.getElementById("backLobbyBtn");

  if (!room || !ROOM_NAME_PATTERN.test(room)) {
    window.location.href = `${FRONTEND_ORIGIN}/multi/?error=missing-room`;
    return;
  }

  teamRoomLabel.textContent = `Room: ${room}`;
  nicknameInput.value = (localStorage.getItem("playerNickname") || "").slice(
    0,
    20,
  );

  let latestSnapshot = null;

  const refresh = async () => {
    try {
      latestSnapshot = await fetchRoomSnapshot(room);
      const teamSize = Number(latestSnapshot.teamSize) || 3;
      const redPlayers = latestSnapshot.teams?.red || [];
      const bluePlayers = latestSnapshot.teams?.blue || [];

      renderTeamList(redList, redPlayers);
      renderTeamList(blueList, bluePlayers);

      redCount.textContent = `${redPlayers.length}/${teamSize}`;
      blueCount.textContent = `${bluePlayers.length}/${teamSize}`;

      joinRedBtn.disabled = redPlayers.length >= teamSize;
      joinBlueBtn.disabled = bluePlayers.length >= teamSize;

      if (latestSnapshot.started) {
        statusLine.textContent =
          "Partie deja en cours: tu peux quand meme rejoindre.";
      } else {
        statusLine.textContent = "Choisis ton equipe pour continuer.";
      }
    } catch (error) {
      statusLine.textContent = "Impossible de charger la room.";
    }
  };

  const handleJoinTeam = (team) => {
    const nickname = String(nicknameInput.value || "")
      .trim()
      .slice(0, 20);
    if (!nickname) {
      statusLine.textContent = "Entre un pseudo avant de choisir une equipe.";
      return;
    }

    if (!latestSnapshot) {
      statusLine.textContent = "Room non chargee. Reessaie.";
      return;
    }

    const teamPlayers = latestSnapshot.teams?.[team] || [];
    const teamSize = Number(latestSnapshot.teamSize) || 3;
    if (teamPlayers.length >= teamSize) {
      statusLine.textContent = "Cette equipe est complete.";
      return;
    }

    goToHeroSelect(room, team, nickname, latestSnapshot.mode || "team3v3");
  };

  joinRedBtn.addEventListener("click", () => handleJoinTeam("red"));
  joinBlueBtn.addEventListener("click", () => handleJoinTeam("blue"));

  backLobbyBtn.addEventListener("click", () => {
    window.location.href = `${FRONTEND_ORIGIN}/multi/`;
  });

  await refresh();
  setInterval(refresh, 1500);
});
