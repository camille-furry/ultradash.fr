const { FRONTEND_ORIGIN, SERVER_ORIGIN, normalizeRoomName, toLabel } =
  window.LobbyCommon;
const SUBROLE_ORDER = ["ninja", "accrobate", "dasher", "walkiry"];
const HERO_SUBROLES = {
  via: "ninja",
  kenji: "accrobate",
  croc: "dasher",
  valkiry: "walkiry",
};

function getParams() {
  const p = new URLSearchParams(window.location.search);
  const room = normalizeRoomName(
    p.get("room") || localStorage.getItem("pendingDevRoom") || "",
  );
  const team =
    (
      p.get("team") ||
      localStorage.getItem("pendingDevTeam") ||
      "red"
    ).toLowerCase() === "blue"
      ? "blue"
      : "red";
  const nickname =
    String(
      p.get("nickname") || localStorage.getItem("playerNickname") || "Player",
    )
      .trim()
      .slice(0, 20) || "Player";
  const roomMode =
    normalizeRoomName(
      p.get("roomMode") || localStorage.getItem("pendingDevMode") || "team3v3",
    ) || "team3v3";
  return { room, team, nickname, roomMode };
}

async function loadHeroes() {
  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/heroes`);
    if (!response.ok) return ["kenji", "croc", "via"];
    const payload = await response.json();
    if (!Array.isArray(payload.heroes) || payload.heroes.length === 0) {
      return ["kenji", "croc", "via"];
    }
    return payload.heroes;
  } catch (error) {
    return ["kenji", "croc", "via"];
  }
}

function buildHeroCategoryMap(heroes) {
  const grouped = {
    ninja: [],
    accrobate: [],
    dasher: [],
    walkiry: [],
  };
  const remaining = [];

  for (let i = 0; i < heroes.length; i++) {
    const hero = heroes[i];
    const subrole = HERO_SUBROLES[hero] || null;
    if (subrole && grouped[subrole]) {
      grouped[subrole].push(hero);
    } else {
      remaining.push(hero);
    }
  }

  const result = [];
  for (let i = 0; i < SUBROLE_ORDER.length; i++) {
    const category = SUBROLE_ORDER[i];
    if (grouped[category].length > 0) {
      result.push({ category, heroes: grouped[category] });
    }
  }

  if (remaining.length > 0) {
    result.push({ category: "autres", heroes: remaining });
  }

  return result;
}

function goToGame(params) {
  const query = new URLSearchParams({
    room: params.room,
    team: params.team,
    nickname: params.nickname,
    roomMode: params.roomMode,
  });
  window.location.href = `${FRONTEND_ORIGIN}/dev/game.html?${query.toString()}`;
}

window.addEventListener("DOMContentLoaded", async () => {
  const params = getParams();
  if (!params.room) {
    window.location.href = `${FRONTEND_ORIGIN}/?error=missing-room`;
    return;
  }

  const heroRoomLabel = document.getElementById("heroRoomLabel");
  const heroTeamLabel = document.getElementById("heroTeamLabel");
  const heroCategoriesEl = document.getElementById("heroCategories");
  const confirmHeroBtn = document.getElementById("confirmHeroBtn");
  const startGameBtn = document.getElementById("startGameBtn");
  const backTeamBtn = document.getElementById("backTeamBtn");
  const statusLine = document.getElementById("statusLine");

  heroRoomLabel.textContent = `Room: ${params.room}`;
  heroTeamLabel.textContent = `Equipe: ${params.team === "blue" ? "Team 2 (Bleu)" : "Team 1 (Rouge)"}`;

  const heroes = await loadHeroes();
  const grouped = buildHeroCategoryMap(heroes);

  let selectedHero =
    localStorage.getItem("selectedRole") || heroes[0] || "kenji";
  if (!heroes.includes(selectedHero)) {
    selectedHero = heroes[0] || "kenji";
  }

  const renderHeroCards = () => {
    heroCategoriesEl.innerHTML = "";

    for (let i = 0; i < grouped.length; i++) {
      const bucket = grouped[i];
      const section = document.createElement("section");
      section.className = "heroCategory";

      const title = document.createElement("h3");
      title.textContent = toLabel(bucket.category);
      section.appendChild(title);

      const row = document.createElement("div");
      row.className = "heroCards";

      for (let j = 0; j < bucket.heroes.length; j++) {
        const hero = bucket.heroes[j];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "heroCard";
        if (hero === selectedHero) button.classList.add("active");
        button.textContent = toLabel(hero);
        button.addEventListener("click", () => {
          selectedHero = hero;
          localStorage.setItem("selectedRole", hero);
          socket.emit("changeClass", hero);
          renderHeroCards();
          statusLine.textContent = `${toLabel(hero)} selectionne.`;
        });
        row.appendChild(button);
      }

      section.appendChild(row);
      heroCategoriesEl.appendChild(section);
    }
  };

  const socket = io("http://localhost:3000", {
    query: {
      mode: "dev",
      role: selectedHero,
      room: params.room,
      nickname: params.nickname,
      team: params.team,
      roomMode: params.roomMode,
    },
  });

  let roomStarted = false;
  let heroConfirmed = false;
  let isOwner = false;

  const syncOwnerControls = (roomState = {}) => {
    roomStarted = !!roomState.started;
    isOwner = roomState.leaderId === socket.id;

    if (startGameBtn) {
      startGameBtn.classList.toggle("hidden", !isOwner);
      startGameBtn.disabled = !isOwner || roomStarted;
    }
  };

  socket.on("joinedRoom", (payload) => {
    syncOwnerControls(payload?.roomState || {});

    if (payload?.team) {
      params.team = payload.team;
      heroTeamLabel.textContent = `Equipe: ${params.team === "blue" ? "Team 2 (Bleu)" : "Team 1 (Rouge)"}`;
      localStorage.setItem("pendingDevTeam", params.team);
    }

    renderHeroCards();
    statusLine.textContent = isOwner
      ? "Choisis un hero. Tu peux lancer la partie quand tout le monde est pret."
      : "Choisis un hero puis valide.";
  });

  socket.on("state", (state) => {
    syncOwnerControls(state?.room || {});

    if (!heroConfirmed) {
      statusLine.textContent = roomStarted
        ? "Partie en cours. Valide ton hero pour entrer."
        : isOwner
          ? "Tu es chef de room. Lance la partie quand vous etes prets."
          : "En attente du lancement de la partie...";
      return;
    }

    if (roomStarted) {
      socket.disconnect();
      goToGame(params);
    } else {
      statusLine.textContent = "Hero valide. En attente du lancement...";
    }
  });

  socket.on("roomError", (payload) => {
    statusLine.textContent = `Erreur room: ${payload?.code || "UNKNOWN"}`;
  });

  if (startGameBtn) {
    startGameBtn.addEventListener("click", () => {
      if (!isOwner || roomStarted) return;
      socket.emit("startRoom");
      statusLine.textContent = "Demande de lancement envoyee...";
    });
  }

  socket.on("disconnect", () => {
    if (!heroConfirmed) {
      statusLine.textContent = "Connexion interrompue.";
    }
  });

  confirmHeroBtn.addEventListener("click", () => {
    heroConfirmed = true;
    localStorage.setItem("selectedRole", selectedHero);
    localStorage.setItem("playerNickname", params.nickname);
    localStorage.setItem("pendingDevRoom", params.room);
    localStorage.setItem("pendingDevTeam", params.team);
    localStorage.setItem("pendingDevMode", params.roomMode);

    if (roomStarted) {
      socket.disconnect();
      goToGame(params);
      return;
    }

    statusLine.textContent = "Hero valide. En attente du lancement...";
  });

  backTeamBtn.addEventListener("click", () => {
    socket.disconnect();
    const q = new URLSearchParams({ room: params.room });
    window.location.href = `${FRONTEND_ORIGIN}/dev/team.html?${q.toString()}`;
  });
});
