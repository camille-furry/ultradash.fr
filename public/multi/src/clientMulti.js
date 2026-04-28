// =====================
// ROLE
// =====================
const selectedRole = localStorage.getItem("selectedRole") || "ninja";
const FRONTEND_ORIGIN = "http://localhost:8000";
const SERVER_ORIGIN = "http://localhost:3000";
const urlParams = new URLSearchParams(window.location.search);
function normalizeRoomName(value) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return cleaned || "";
}

const selectedRoom = normalizeRoomName(
  urlParams.get("room") || localStorage.getItem("pendingMultiRoom") || "",
);
const selectedTeam =
  (urlParams.get("team") || localStorage.getItem("pendingMultiTeam") || "red")
    .trim()
    .toLowerCase() === "blue"
    ? "blue"
    : "red";
const selectedRoomMode =
  normalizeRoomName(
    urlParams.get("roomMode") ||
      localStorage.getItem("pendingMultiMode") ||
      "team3v3",
  ) || "team3v3";
const selectedNickname =
  (urlParams.get("nickname") || localStorage.getItem("playerNickname") || "")
    .trim()
    .slice(0, 20) || "Player";

if (!selectedRoom) {
  window.location.href = `${FRONTEND_ORIGIN}/multi/?error=missing-room`;
}

localStorage.setItem("playerNickname", selectedNickname);
localStorage.setItem("pendingMultiRoom", selectedRoom);
localStorage.setItem("selectedTeam", selectedTeam);
localStorage.setItem("selectedRoomMode", selectedRoomMode);
localStorage.setItem("pendingMultiTeam", selectedTeam);
localStorage.setItem("pendingMultiMode", selectedRoomMode);
const SETTINGS_KEY = "multiSettings";
const LOCAL_HEROES = ["kenji", "croc", "via"];
const SUBROLE_ORDER = ["ninja", "accrobate", "dasher", "walkiry"];
const HERO_SUBROLES = {
  via: "ninja",
  kenji: "accrobate",
  croc: "dasher",
  valkiry: "walkiry",
};
const ALLOWED_FPS = [60, 90, 120];
const NETWORK_INPUT_HZ = 60;
const RENDER_PREDICTION_MS = 12;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const parsedFps = Number(parsed.fps);
    const fps = ALLOWED_FPS.includes(parsedFps) ? parsedFps : 60;
    return {
      volume: Number.isFinite(parsed.volume)
        ? Math.max(0, Math.min(100, parsed.volume))
        : 70,
      fullscreen: !!parsed.fullscreen,
      fps,
    };
  } catch (error) {
    return { volume: 70, fullscreen: false, fps: 60 };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function toLabel(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function loadAvailableHeroes() {
  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/heroes`);
    if (!response.ok) return LOCAL_HEROES;
    const payload = await response.json();
    if (!Array.isArray(payload?.heroes) || payload.heroes.length === 0) {
      return LOCAL_HEROES;
    }
    return payload.heroes;
  } catch (error) {
    return LOCAL_HEROES;
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

// =====================
// ENEMIES STATE
// =====================
let serverEnemies = {};
let smoothEnemies = {};

let serverProjectiles = {};
let smoothProjectiles = {};
let hitscanVisuals = {};
let impactParticles = [];
let seenExplosionIds = {};
let lastLocalHp = null;
let damageFlash = 0;

let serverExplosions = {};
let skillHudState = {
  skill1Cooldown: 0,
  skill2Cooldown: 0,
  skill1CooldownMax: 1,
  skill2CooldownMax: 1,
  ammo: null,
  ammoMax: null,
  reloadTimer: 0,
  reloadTimerMax: 1,
};

function spawnImpactParticles(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.7 + Math.random() * 2.6;
    impactParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 10 + Math.floor(Math.random() * 10),
      maxLife: 20,
      color,
      size: 1.8 + Math.random() * 2.2,
    });
  }
}

function updateImpactParticles() {
  for (let i = impactParticles.length - 1; i >= 0; i--) {
    const p = impactParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy = p.vy * 0.94 + 0.06;
    p.life -= 1;

    if (p.life <= 0) {
      impactParticles.splice(i, 1);
    }
  }
}

function drawImpactParticles() {
  for (let i = 0; i < impactParticles.length; i++) {
    const p = impactParticles[i];
    const alpha = clamp01(p.life / p.maxLife);
    ctx.fillStyle = `${p.color}${Math.max(0.08, alpha).toFixed(2)})`;
    ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size);
  }
}

function showFatalOverlay(message) {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.inset = "0";
  panel.style.display = "grid";
  panel.style.placeItems = "center";
  panel.style.background = "rgba(3, 9, 16, 0.78)";
  panel.style.zIndex = "99999";
  panel.style.color = "#eaf7ff";
  panel.style.fontFamily = '"Trebuchet MS", "Segoe UI", sans-serif';
  panel.style.padding = "20px";

  const card = document.createElement("div");
  card.style.width = "min(92vw, 520px)";
  card.style.borderRadius = "14px";
  card.style.padding = "16px";
  card.style.background = "#0e2230";
  card.style.border = "1px solid rgba(130, 200, 255, 0.3)";
  card.style.boxShadow = "0 18px 36px rgba(0,0,0,0.35)";
  card.textContent = message;

  panel.appendChild(card);
  document.body.appendChild(panel);
}

// =====================
// SOCKET
// =====================
if (typeof window.io !== "function") {
  showFatalOverlay(
    "Socket.IO introuvable. Verifie que le serveur backend (port 3000) est bien demarre, puis recharge la page.",
  );
  throw new Error("Socket.IO client is not loaded");
}

const socket = window.io("http://localhost:3000", {
  query: {
    mode: "multi",
    role: selectedRole,
    room: selectedRoom,
    nickname: selectedNickname,
    team: selectedTeam,
    roomMode: selectedRoomMode,
  },
});

let hasJoinedRoom = false;
let joinFailureHandled = false;
let leaderboardHeld = false;
let currentRoomState = {
  started: false,
  leaderId: null,
  winnerTeam: null,
  teamCounts: { red: 0, blue: 0 },
  teamZones: [],
  targetKills: 50,
  modeLabel: "3v3",
};
let uiRefs = {};

function showJoinError(message) {
  let panel = document.getElementById("joinErrorPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "joinErrorPanel";
    panel.style.position = "fixed";
    panel.style.inset = "0";
    panel.style.display = "grid";
    panel.style.placeItems = "center";
    panel.style.background = "rgba(3, 9, 16, 0.7)";
    panel.style.zIndex = "9999";

    const card = document.createElement("div");
    card.style.width = "min(92vw, 420px)";
    card.style.padding = "20px";
    card.style.borderRadius = "14px";
    card.style.background = "#0e2230";
    card.style.color = "#eaf7ff";
    card.style.fontFamily = '"Trebuchet MS", "Segoe UI", sans-serif';
    card.style.boxShadow = "0 16px 36px rgba(0,0,0,0.35)";

    const title = document.createElement("h2");
    title.textContent = "Impossible de rejoindre la room";
    title.style.margin = "0 0 8px";
    title.style.fontSize = "22px";

    const details = document.createElement("p");
    details.id = "joinErrorText";
    details.style.margin = "0 0 14px";
    details.style.color = "#b8d3e6";

    const backButton = document.createElement("button");
    backButton.textContent = "Retour au lobby";
    backButton.style.border = "0";
    backButton.style.borderRadius = "10px";
    backButton.style.padding = "10px 12px";
    backButton.style.fontWeight = "700";
    backButton.style.cursor = "pointer";
    backButton.style.background = "#41e3a1";
    backButton.style.color = "#05261c";
    backButton.addEventListener("click", () => {
      window.location.href = `${FRONTEND_ORIGIN}/multi/`;
    });

    card.appendChild(title);
    card.appendChild(details);
    card.appendChild(backButton);
    panel.appendChild(card);
    document.body.appendChild(panel);
  }

  const text = document.getElementById("joinErrorText");
  if (text) text.textContent = message;
}

socket.on("joinedRoom", (payload) => {
  hasJoinedRoom = true;
  if (payload?.roomState) {
    currentRoomState = {
      ...currentRoomState,
      ...payload.roomState,
      teamCounts: payload.roomState.teamCounts || currentRoomState.teamCounts,
      teamZones: Array.isArray(payload.roomState.teamZones)
        ? payload.roomState.teamZones
        : currentRoomState.teamZones,
    };
    updateRoomOverlay(currentRoomState);
    syncMapBackground(currentRoomState);
    showMapIntro(currentRoomState.mapName);
    if (uiRefs.leaderboardOverlay) {
      uiRefs.leaderboardOverlay.classList.add("hidden");
    }
  }
});

socket.on("roomError", (payload) => {
  joinFailureHandled = true;
  const code = payload?.code || "UNKNOWN";
  const message =
    code === "ROOM_FULL"
      ? "La room est complete."
      : code === "INVALID_ROOM"
        ? "Le nom de room est invalide."
        : code === "ROOM_NOT_FOUND"
          ? "Cette room n'existe plus (serveur redemarre). Reviens au lobby pour la recreer."
          : code === "ROOM_MODE_MISMATCH"
            ? "Le mode de la room ne correspond pas. Rejoins la room depuis le lobby."
            : `Erreur room: ${code}`;

  if (code === "ROOM_NOT_FOUND") {
    localStorage.removeItem("pendingMultiRoom");
  }

  showJoinError(message);
});

socket.on("disconnect", (reason) => {
  if (hasJoinedRoom || joinFailureHandled) return;

  showJoinError(`Connexion coupee avant validation de la room (${reason}).`);
});

// =====================
// CANVAS
// =====================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let camera = { x: 0, y: 0 };
let cameraTargetX = 0;
let cameraTargetY = 0;
let cameraInitialized = false;

let serverPlayers = {};
let smoothPlayers = {};
let serverMap = [];

function normalizeMapPayload(mapPayload) {
  return Array.isArray(mapPayload) ? mapPayload : [];
}

let keys = {
  left: false,
  right: false,
  jump: false,
  dash: false,
  shoot: false,
  skill1: false,
  skill2: false,
  reload: false,
};

let mouseWorld = { x: 0, y: 0 };
let isPaused = false;
let isSettingsOpen = false;
const gameSettings = loadSettings();
let inputIntervalId = null;
let renderIntervalMs = 1000 / gameSettings.fps;
let lastRenderTime = 0;
let lastFrameTimestamp = 0;
let heroSwitchVisible = false;
let availableHeroes = [...LOCAL_HEROES];
let selectedHeroName = selectedRole;
let mapIntroTimeoutId = null;
let isReturningToHeroSelect = false;
let mapBackgroundImage = null;
let mapBackgroundUrl = null;

// ======================
// DRAGONBONES SETUP
// ======================
const kenjiDragonBonesData = {
  ready: false,
  skeleton: null,
  textureAtlas: null,
  image: null,
  factory: null,
};
const kenjiArmatures = {};
const KENJI_NATIVE_FACING = 1;

function resolveCompatibleDragonBonesRuntime() {
  if (typeof window === "undefined") {
    return null;
  }

  const db =
    window.dragonBones ||
    (typeof dragonBones !== "undefined" ? dragonBones : null);
  if (!db) return null;
  const requiredConstructors = [
    "TextureData",
    "TextureAtlasData",
    "Slot",
    "BaseFactory",
    "Armature",
  ];

  for (let i = 0; i < requiredConstructors.length; i++) {
    const key = requiredConstructors[i];
    if (typeof db[key] !== "function") {
      return null;
    }
  }

  if (!db.BaseObject || typeof db.BaseObject.borrowObject !== "function") {
    return null;
  }

  return db;
}

const compatibleDragonBonesRuntime = resolveCompatibleDragonBonesRuntime();

const DragonBonesLib = compatibleDragonBonesRuntime || {
  TextureData: class {},
  TextureAtlasData: class {
    _onClear() {}
  },
  Slot: class {},
  BaseFactory: class {},
  Armature: class {
    init() {}
  },
  BaseObject: {
    borrowObject() {
      return {};
    },
  },
};

if (!compatibleDragonBonesRuntime) {
  console.warn(
    "DragonBones runtime unavailable or incompatible. Kenji uses fallback rectangle rendering.",
  );
}

class KenjiCanvasTextureData extends DragonBonesLib.TextureData {
  static toString() {
    return "[class KenjiCanvasTextureData]";
  }

  _onClear() {
    if (super._onClear) {
      super._onClear();
    }
  }
}

class KenjiCanvasTextureAtlasData extends DragonBonesLib.TextureAtlasData {
  constructor() {
    super();
    this.renderTexture = null;
  }

  static toString() {
    return "[class KenjiCanvasTextureAtlasData]";
  }

  createTexture() {
    return DragonBonesLib.BaseObject.borrowObject(KenjiCanvasTextureData);
  }

  _onClear() {
    super._onClear();
    this.renderTexture = null;
  }
}

class KenjiCanvasSlot extends DragonBonesLib.Slot {
  static toString() {
    return "[class KenjiCanvasSlot]";
  }

  _initDisplay(value, isRetain) {
    void value;
    void isRetain;
  }

  _disposeDisplay(value, isRelease) {
    void value;
    void isRelease;
  }

  _onUpdateDisplay() {
    this._renderDisplay = this._display || this._rawDisplay;
  }

  _addDisplay() {}

  _replaceDisplay(value) {
    void value;
  }

  _removeDisplay() {}

  _updateZOrder() {}

  _updateVisible() {}

  _updateBlendMode() {}

  _updateColor() {}

  _updateFrame() {}

  _updateMesh() {}

  _updateTransform() {}

  _identityTransform() {}
}

class KenjiCanvasArmatureDisplay {
  constructor() {
    this.debugDraw = false;
    this._armature = null;
  }

  dbInit(armature) {
    this._armature = armature;
  }

  dbClear() {
    this._armature = null;
  }

  dbUpdate() {}

  dispose(disposeProxy = true) {
    void disposeProxy;
    // DragonBones runtime owns armature disposal. The proxy must only detach.
    this._armature = null;
  }

  destroy() {
    this.dispose(true);
  }

  dispatchDBEvent(type, eventObject) {
    void type;
    void eventObject;
  }

  hasDBEventListener(type) {
    void type;
    return false;
  }

  addDBEventListener(type, listener, scope) {
    void type;
    void listener;
    void scope;
  }

  removeDBEventListener(type, listener, scope) {
    void type;
    void listener;
    void scope;
  }
}

class KenjiCanvasFactory extends DragonBonesLib.BaseFactory {
  _isSupportMesh() {
    return false;
  }

  _buildTextureAtlasData(textureAtlasData, textureAtlas) {
    if (textureAtlasData !== null) {
      textureAtlasData.renderTexture = textureAtlas;
      return textureAtlasData;
    }

    const atlasData = DragonBonesLib.BaseObject.borrowObject(
      KenjiCanvasTextureAtlasData,
    );
    atlasData.renderTexture = textureAtlas;
    return atlasData;
  }

  _buildArmature(dataPackage) {
    const armature = DragonBonesLib.BaseObject.borrowObject(
      DragonBonesLib.Armature,
    );
    armature.init(
      dataPackage.armature,
      new KenjiCanvasArmatureDisplay(),
      new KenjiCanvasArmatureDisplay(),
      this._dragonBones,
    );
    return armature;
  }

  _buildSlot(dataPackage, slotData, armature) {
    void dataPackage;
    const slot = DragonBonesLib.BaseObject.borrowObject(KenjiCanvasSlot);
    slot.init(slotData, armature, { kind: "raw" }, { kind: "mesh" });
    return slot;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function loadKenjiDragonBones() {
  try {
    const [skeletonData, textureData, image] = await Promise.all([
      fetch("/hero-assets/accrobate/kenji/kenji_ske.json").then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
      fetch("/hero-assets/accrobate/kenji/kenji_tex.json").then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
      loadImage("/hero-assets/accrobate/kenji/kenji_tex.png"),
    ]);

    kenjiDragonBonesData.skeleton = skeletonData;
    kenjiDragonBonesData.textureAtlas = textureData;
    kenjiDragonBonesData.image = image;
    initializeKenjiDragonBones();
  } catch (err) {
    console.warn("Failed to load Kenji DragonBones assets:", err);
  }
}

function initializeKenjiDragonBones() {
  try {
    const factory = new KenjiCanvasFactory();
    factory.parseDragonBonesData(kenjiDragonBonesData.skeleton, "kenji");
    factory.parseTextureAtlasData(
      kenjiDragonBonesData.textureAtlas,
      kenjiDragonBonesData.image,
      "kenji",
    );
    kenjiDragonBonesData.factory = factory;
    kenjiDragonBonesData.ready = true;
  } catch (err) {
    console.warn("Failed to initialize Kenji DragonBones:", err);
    kenjiDragonBonesData.ready = false;
  }
}

function createKenjiArmature(playerId) {
  if (!kenjiDragonBonesData.ready || !kenjiDragonBonesData.factory) return null;

  try {
    const armature = kenjiDragonBonesData.factory.buildArmature(
      "Armature",
      "kenji",
      null,
      "kenji",
    );
    if (armature) {
      armature.animation.play("idle");
      kenjiArmatures[playerId] = {
        armature,
        currentAnimation: "idle",
        facing: 1,
      };
    }
    return armature;
  } catch (err) {
    console.warn("Failed to create Kenji armature:", err);
    return null;
  }
}

function playKenjiAnimation(playerId, animationName) {
  const state = kenjiArmatures[playerId];
  if (!state || !state.armature || !state.armature.animation) return;

  if (state.currentAnimation !== animationName) {
    state.currentAnimation = animationName;
    state.armature.animation.play(animationName);
  }
}

function updateKenjiAnimation(playerId, frameDeltaMs) {
  const state = kenjiArmatures[playerId];
  if (!state || !state.armature) return;

  if (!state.armature._dragonBones) {
    delete kenjiArmatures[playerId];
    return;
  }

  try {
    state.armature.advanceTime(frameDeltaMs / 1000);
  } catch (error) {
    console.warn(
      "Kenji armature update failed, falling back for this player:",
      error,
    );
    delete kenjiArmatures[playerId];
  }
}

function getKenjiRenderScale(armature) {
  const armatureData =
    armature?.armatureData || armature?._armatureData || null;
  const aabb = armatureData?.aabb || null;
  const width = Number(aabb?.width) || 0;
  const height = Number(aabb?.height) || 0;

  if (width > 0 && height > 0) {
    const targetHeightPx = 44;
    const rawScale = targetHeightPx / height;
    return Math.max(0.008, Math.min(0.08, rawScale));
  }

  return 0.02;
}

function drawKenjiSlot(slot, originX, originY, renderScale, facingSign = 1) {
  if (!slot) return false;

  let textureData = null;
  let pivotX = 0;
  let pivotY = 0;
  let useRuntime57Math = false;

  // Legacy path.
  if (typeof slot.getDisplayFrameAt === "function") {
    const displayFrame = slot.getDisplayFrameAt(slot.displayIndex);
    const displayData = displayFrame ? displayFrame.displayData : null;
    textureData = displayFrame ? displayFrame.textureData : null;
    if (displayData && displayData.pivot) {
      pivotX = Number(displayData.pivot.x) || 0;
      pivotY = Number(displayData.pivot.y) || 0;
    }
  }

  // DragonBones 5.7 path.
  if (!textureData && slot._textureData) {
    textureData = slot._textureData;
    pivotX = Number(slot._pivotX) || 0;
    pivotY = Number(slot._pivotY) || 0;
    useRuntime57Math = true;
  }

  if (!textureData || !textureData.parent || !textureData.region) return false;

  const textureAtlasData = textureData.parent;
  const sourceImage =
    textureAtlasData.renderTexture ||
    textureAtlasData.image ||
    textureAtlasData._renderTexture ||
    null;
  if (!sourceImage || !textureData.region) return false;

  const frame = textureData.frame;
  const source = textureData.region;
  const matrix = slot.globalTransformMatrix;
  if (
    !matrix ||
    !Number.isFinite(matrix.a) ||
    !Number.isFinite(matrix.b) ||
    !Number.isFinite(matrix.c) ||
    !Number.isFinite(matrix.d) ||
    !Number.isFinite(matrix.tx) ||
    !Number.isFinite(matrix.ty)
  ) {
    return false;
  }

  ctx.save();
  ctx.transform(
    matrix.a * renderScale * facingSign,
    matrix.b * renderScale * facingSign,
    matrix.c * renderScale * facingSign,
    matrix.d * renderScale,
    originX + matrix.tx * renderScale * facingSign,
    originY + matrix.ty * renderScale,
  );

  const drawX = useRuntime57Math ? -pivotX : frame ? frame.x - pivotX : -pivotX;
  const drawY = useRuntime57Math ? -pivotY : frame ? frame.y - pivotY : -pivotY;
  const drawWidth = useRuntime57Math
    ? source.width
    : frame
      ? frame.width
      : source.width;
  const drawHeight = useRuntime57Math
    ? source.height
    : frame
      ? frame.height
      : source.height;
  if (
    !Number.isFinite(drawWidth) ||
    !Number.isFinite(drawHeight) ||
    drawWidth <= 0.5 ||
    drawHeight <= 0.5
  ) {
    ctx.restore();
    return false;
  }

  ctx.drawImage(
    sourceImage,
    source.x,
    source.y,
    source.width,
    source.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  );

  ctx.restore();
  return true;
}

function drawKenjiWithDragonBones(
  player,
  playerId,
  smoothX,
  smoothY,
  frameDeltaMs,
) {
  if (!kenjiArmatures[playerId]) {
    createKenjiArmature(playerId);
    if (!kenjiArmatures[playerId]) return false;
  }

  const state = kenjiArmatures[playerId];
  const armature = state.armature;
  const isRunning = Math.abs(Number(player?.vx) || 0) > 0.4;
  const isJumping = !player?.onGround;

  const vx = Number(player?.vx) || 0;
  if (vx > 0.06) state.facing = 1;
  else if (vx < -0.06) state.facing = -1;
  else {
    const lastX = Number.isFinite(state.lastX) ? state.lastX : smoothX;
    const dx = smoothX - lastX;
    if (dx > 0.08) state.facing = 1;
    else if (dx < -0.08) state.facing = -1;
  }
  state.lastX = smoothX;

  let nextAnimation = "idle";
  if (isJumping) {
    nextAnimation = "jump";
  } else if (isRunning) {
    nextAnimation = "run";
  }

  playKenjiAnimation(playerId, nextAnimation);

  const shouldFlip = state.facing !== KENJI_NATIVE_FACING;
  armature.flipX = shouldFlip;

  updateKenjiAnimation(playerId, frameDeltaMs);

  try {
    const renderScale = getKenjiRenderScale(armature);
    const originX = smoothX - camera.x + 10;
    const originY = smoothY - camera.y + 16;
    const slots = armature.getSlots ? armature.getSlots() : [];
    const facingSign = state.facing === KENJI_NATIVE_FACING ? 1 : -1;
    let drawn = 0;

    for (let i = 0; i < slots.length; i++) {
      if (drawKenjiSlot(slots[i], originX, originY, renderScale, facingSign)) {
        drawn++;
      }
    }

    return drawn > 0;
  } catch (err) {
    console.warn("Failed to draw Kenji armature:", err);
    return false;
  }
}

function drawPlayerBody(
  player,
  playerId,
  smoothX,
  smoothY,
  isLocal,
  frameDeltaMs,
) {
  const heroName = String(player?.hero || "").toLowerCase();

  if (heroName === "kenji") {
    const drawn = drawKenjiWithDragonBones(
      player,
      playerId,
      smoothX,
      smoothY,
      frameDeltaMs,
    );

    if (drawn) return;
  }

  ctx.fillStyle = getTeamColor(player.team, isLocal);
  ctx.fillRect(smoothX - camera.x, smoothY - camera.y, 20, 20);
}

// Initialize DragonBones for Kenji
loadKenjiDragonBones();

function setMapBackdrop(url) {
  const backdrop = document.getElementById("mapBackdrop");
  if (!backdrop) return;

  if (url) {
    backdrop.style.backgroundImage = `url("${url}")`;
  } else {
    backdrop.style.backgroundImage = "none";
  }
}

function renderHeroSwitchCards() {
  const heroCategoriesEl = document.getElementById("heroCategories");
  if (!heroCategoriesEl) return;

  heroCategoriesEl.innerHTML = "";
  const grouped = buildHeroCategoryMap(availableHeroes);

  for (let i = 0; i < grouped.length; i++) {
    const bucket = grouped[i];
    const section = document.createElement("section");
    section.className = "heroCategory";

    const title = document.createElement("h4");
    title.textContent = toLabel(bucket.category);
    section.appendChild(title);

    const row = document.createElement("div");
    row.className = "heroCards";

    for (let j = 0; j < bucket.heroes.length; j++) {
      const hero = bucket.heroes[j];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "heroCard";
      if (hero === selectedHeroName) button.classList.add("active");
      button.textContent = toLabel(hero);
      button.addEventListener("click", () => {
        selectedHeroName = hero;
        localStorage.setItem("selectedRole", selectedHeroName);
        renderHeroSwitchCards();
      });
      row.appendChild(button);
    }

    section.appendChild(row);
    heroCategoriesEl.appendChild(section);
  }
}

function showMapIntro(mapName) {
  const overlay = document.getElementById("mapIntroOverlay");
  const label = document.getElementById("mapIntroName");
  if (!overlay || !label || !mapName) return;

  label.textContent = String(mapName);
  overlay.classList.remove("hidden", "is-visible");
  void overlay.offsetWidth;
  overlay.classList.add("is-visible");

  if (mapIntroTimeoutId) {
    clearTimeout(mapIntroTimeoutId);
  }

  mapIntroTimeoutId = setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.classList.remove("is-visible");
    mapIntroTimeoutId = null;
  }, 3000);
}

function getMapPlatformStyle(room = currentRoomState) {
  const mapKey = String(room?.mapKey || "").toLowerCase();
  if (mapKey === "syberia") {
    return {
      default: "#b3d8ff",
      ice: "#d4eeff",
      steel: "#97b7d7",
      core: "#66c7ff",
      bridge: "#bdd9ea",
      wall: "#6f90b6",
    };
  }

  return {
    default: "#7ad8b2",
    ruin: "#95e5bf",
    altar: "#4edca0",
    pillar: "#6bc79a",
    wall: "#4fa985",
  };
}

function getMapTheme(room = currentRoomState) {
  const mapKey = String(room?.mapKey || "").toLowerCase();
  if (mapKey === "syberia") {
    return {
      base: "#d4ecff",
      glow: "rgba(224, 244, 255, 0.22)",
      haze: "rgba(136, 186, 223, 0.2)",
    };
  }

  return {
    base: "#f0db95",
    glow: "rgba(255, 227, 151, 0.24)",
    haze: "rgba(176, 124, 70, 0.18)",
  };
}

function syncMapBackground(room = currentRoomState) {
  const url = room?.mapBackgroundUrl || null;

  if (!url) {
    mapBackgroundUrl = null;
    mapBackgroundImage = null;
    setMapBackdrop(null);
    return;
  }

  if (url === mapBackgroundUrl && mapBackgroundImage) return;

  mapBackgroundUrl = url;
  mapBackgroundImage = new Image();
  mapBackgroundImage.src = url;
  setMapBackdrop(url);
}

function getCurrentInputPayload() {
  return {
    ...keys,
    aimX: mouseWorld.x,
    aimY: mouseWorld.y,
  };
}

function sendInputNow() {
  socket.emit("input", getCurrentInputPayload());
}

function applyFps(fpsValue) {
  const nextFps = ALLOWED_FPS.includes(Number(fpsValue))
    ? Number(fpsValue)
    : 60;
  gameSettings.fps = nextFps;

  renderIntervalMs = 1000 / nextFps;
  lastRenderTime = 0;
  lastFrameTimestamp = 0;
  saveSettings(gameSettings);
}

function startInputLoop() {
  if (inputIntervalId) {
    clearInterval(inputIntervalId);
  }

  inputIntervalId = setInterval(
    sendInputNow,
    Math.round(1000 / NETWORK_INPUT_HZ),
  );
}

function getLerpAlpha(ratePerSecond, deltaMs) {
  const dt = Math.max(0, deltaMs) / 1000;
  return 1 - Math.exp(-ratePerSecond * dt);
}

function getPredictedTarget(entity) {
  const leadSeconds = RENDER_PREDICTION_MS / 1000;
  const vx = Number.isFinite(entity.vx) ? entity.vx : 0;
  const vy = entity.onGround ? 0 : Number.isFinite(entity.vy) ? entity.vy : 0;

  return {
    x: entity.x + vx * leadSeconds,
    y: entity.y + vy * leadSeconds,
  };
}

function formatCooldownFrames(frames) {
  const seconds = Math.ceil(Math.max(0, frames) / 60);
  return seconds <= 0 ? "Prêt" : `${seconds}s`;
}

function updateSkillHudFromState(playerState) {
  const ammoText = document.getElementById("ammoText");
  const ammoFill = document.getElementById("ammoFill");
  const skill1Timer = document.getElementById("skill1Timer");
  const skill2Timer = document.getElementById("skill2Timer");
  const skill1Fill = document.getElementById("skill1Fill");
  const skill2Fill = document.getElementById("skill2Fill");
  const selfHpText = document.getElementById("selfHpText");
  const selfHpFill = document.getElementById("selfHpFill");
  const respawnOverlay = document.getElementById("respawnOverlay");
  const respawnText = document.getElementById("respawnText");
  const respawnSwitchHint = document.getElementById("respawnSwitchHint");

  skillHudState.skill1Cooldown = Number(playerState?.skill1Cooldown) || 0;
  skillHudState.skill2Cooldown = Number(playerState?.skill2Cooldown) || 0;
  skillHudState.skill1CooldownMax =
    Number(playerState?.skill1CooldownMax) || skillHudState.skill1CooldownMax;
  skillHudState.skill2CooldownMax =
    Number(playerState?.skill2CooldownMax) || skillHudState.skill2CooldownMax;
  skillHudState.ammo = Number.isFinite(playerState?.ammo)
    ? Math.max(0, Number(playerState.ammo))
    : null;
  skillHudState.ammoMax = Number.isFinite(playerState?.ammoMax)
    ? Math.max(1, Number(playerState.ammoMax))
    : null;
  skillHudState.reloadTimer = Math.max(
    0,
    Number(playerState?.reloadTimer) || 0,
  );
  skillHudState.reloadTimerMax = Math.max(
    1,
    Number(playerState?.reloadTimerMax) || 1,
  );

  if (ammoText) {
    if (skillHudState.ammo === null || skillHudState.ammoMax === null) {
      ammoText.textContent = "--";
    } else if (skillHudState.reloadTimer > 0) {
      const reloadSeconds = Math.ceil(skillHudState.reloadTimer / 60);
      ammoText.textContent = `${Math.round(skillHudState.ammo)} / ${Math.round(skillHudState.ammoMax)} · R ${reloadSeconds}s`;
    } else {
      ammoText.textContent = `${Math.round(skillHudState.ammo)} / ${Math.round(skillHudState.ammoMax)}`;
    }
  }

  if (ammoFill) {
    const ratio =
      skillHudState.ammo !== null && skillHudState.ammoMax !== null
        ? skillHudState.ammo / skillHudState.ammoMax
        : 1;
    ammoFill.style.transform = `scaleX(${clamp01(ratio)})`;
  }

  if (skill1Timer) {
    skill1Timer.textContent = formatCooldownFrames(
      skillHudState.skill1Cooldown,
    );
  }

  if (skill2Timer) {
    skill2Timer.textContent = formatCooldownFrames(
      skillHudState.skill2Cooldown,
    );
  }

  if (skill1Fill) {
    const ratio =
      skillHudState.skill1CooldownMax > 0
        ? skillHudState.skill1Cooldown / skillHudState.skill1CooldownMax
        : 0;
    skill1Fill.style.transform = `scaleX(${clamp01(ratio)})`;
  }

  if (skill2Fill) {
    const ratio =
      skillHudState.skill2CooldownMax > 0
        ? skillHudState.skill2Cooldown / skillHudState.skill2CooldownMax
        : 0;
    skill2Fill.style.transform = `scaleX(${clamp01(ratio)})`;
  }

  const hp = Math.max(0, Number(playerState?.hp) || 0);
  const maxHp = Math.max(1, Number(playerState?.maxHp) || 100);
  if (selfHpText) {
    selfHpText.textContent = `${Math.round(hp)} / ${Math.round(maxHp)}`;
  }
  if (selfHpFill) {
    selfHpFill.style.transform = `scaleX(${clamp01(hp / maxHp)})`;
  }

  const isDead = !!playerState?.dead;
  const timerFrames = Math.max(0, Number(playerState?.respawnTimer) || 0);
  const timerSeconds = Math.ceil(timerFrames / 60);
  if (respawnOverlay) {
    respawnOverlay.classList.toggle("hidden", !isDead);
  }
  if (respawnText) {
    respawnText.textContent = isDead
      ? `Reapparition dans ${timerSeconds}s`
      : "";
  }
  if (respawnSwitchHint) {
    respawnSwitchHint.classList.toggle("hidden", !isDead);
  }
}

function getTeamColor(team, isLocal) {
  if (team === "red") return isLocal ? "#ff9595" : "#e95a5a";
  if (team === "blue") return isLocal ? "#8ac7ff" : "#4b8fd7";
  return isLocal ? "#b7d2e9" : "#7d9ab3";
}

function drawWorldBar(x, y, width, hp, maxHp, fillColor) {
  const ratio = clamp01((Number(hp) || 0) / Math.max(1, Number(maxHp) || 100));
  const barHeight = 4;

  ctx.fillStyle = "rgba(6, 14, 22, 0.75)";
  ctx.fillRect(x - camera.x, y - camera.y, width, barHeight);

  ctx.fillStyle = fillColor;
  ctx.fillRect(x - camera.x, y - camera.y, width * ratio, barHeight);
}

function drawPlayerTag(player, smoothX, smoothY, isLocal) {
  const label = player.nickname || "Player";
  const textX = smoothX + 10 - camera.x;
  const textY = smoothY - 10 - camera.y;

  ctx.textAlign = "center";
  ctx.font = "12px Trebuchet MS";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(2, 8, 14, 0.8)";
  ctx.strokeText(label, textX, textY);
  ctx.fillStyle = getTeamColor(player.team, isLocal);
  ctx.fillText(label, textX, textY);

  drawWorldBar(
    smoothX,
    smoothY - 4,
    20,
    player.hp,
    player.maxHp || 100,
    "#77ff9a",
  );
}

function drawEnemyTag(enemy, smoothX, smoothY) {
  drawWorldBar(smoothX, smoothY - 8, 20, enemy.hp, 100, "#ff7f7f");
}

function drawSpawnZoneBoundaries(room = currentRoomState) {
  const zones = Array.isArray(room?.teamZones) ? room.teamZones : [];
  if (zones.length === 0) return;

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    const team = String(zone?.team || "").toLowerCase();
    const x = Number(zone?.x) || 0;
    const y = Number(zone?.y) || 0;
    const w = Math.max(0, Number(zone?.w) || 0);
    const h = Math.max(0, Number(zone?.h) || 0);

    if (w <= 0 || h <= 0) continue;

    const fillColor =
      team === "blue"
        ? "rgba(90, 170, 255, 0.12)"
        : "rgba(255, 110, 110, 0.12)";
    const strokeColor =
      team === "blue"
        ? "rgba(135, 205, 255, 0.78)"
        : "rgba(255, 165, 165, 0.78)";

    const drawX = x - camera.x;
    const drawY = y - camera.y;

    ctx.fillStyle = fillColor;
    ctx.fillRect(drawX, drawY, w, h);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(drawX, drawY, w, h);
    ctx.setLineDash([]);
  }
}

function getLeaderboardPlayers(players = {}) {
  return Object.values(players)
    .map((player) => ({
      id: player.id,
      nickname: player.nickname || player.id,
      team: player.team || "red",
      kills: Number(player.kills) || 0,
      deaths: Number(player.deaths) || 0,
      alive: player.alive !== false && !player.dead,
    }))
    .sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (a.deaths !== b.deaths) return a.deaths - b.deaths;
      return a.nickname.localeCompare(b.nickname);
    });
}

function updateTopScoreHud(players = {}, room = currentRoomState) {
  const redEl = uiRefs.redTeamScore;
  const blueEl = uiRefs.blueTeamScore;
  const targetEl = uiRefs.teamScoreTarget;
  if (!redEl || !blueEl) return;

  let redScore = 0;
  let blueScore = 0;
  const list = Object.values(players || {});

  for (let i = 0; i < list.length; i++) {
    const player = list[i];
    const kills = Number(player?.kills) || 0;
    if (player?.team === "blue") {
      blueScore += kills;
    } else {
      redScore += kills;
    }
  }

  redEl.textContent = String(redScore);
  blueEl.textContent = String(blueScore);
  if (targetEl) {
    targetEl.textContent = `/ ${Number(room?.targetKills) || 50}`;
  }
}

function renderLeaderboard(players = {}, room = currentRoomState) {
  const container = uiRefs.leaderboardContent;
  if (!container) return;

  const grouped = {
    red: [],
    blue: [],
  };

  for (const player of getLeaderboardPlayers(players)) {
    grouped[player.team === "blue" ? "blue" : "red"].push(player);
  }

  const teamLabels = {
    red: "Equipe rouge",
    blue: "Equipe bleue",
  };

  container.innerHTML = "";
  for (const team of ["red", "blue"]) {
    const teamCard = document.createElement("section");
    teamCard.className = "leaderboardTeam";

    const header = document.createElement("div");
    header.className = "leaderboardTeamHeader";
    const title = document.createElement("strong");
    title.textContent = teamLabels[team];
    const count = document.createElement("small");
    count.textContent = `${grouped[team].length}/${room.teamSize || 3}`;
    header.appendChild(title);
    header.appendChild(count);
    teamCard.appendChild(header);

    for (const player of grouped[team]) {
      const row = document.createElement("div");
      row.className = "leaderboardPlayer";

      const left = document.createElement("strong");
      left.textContent = `${player.nickname}${player.alive ? "" : " (KO)"}`;

      const right = document.createElement("small");
      right.textContent = `K ${player.kills} · M ${player.deaths}`;

      row.appendChild(left);
      row.appendChild(right);
      teamCard.appendChild(row);
    }

    if (grouped[team].length === 0) {
      const empty = document.createElement("small");
      empty.textContent = "Aucun joueur.";
      teamCard.appendChild(empty);
    }

    container.appendChild(teamCard);
  }
}

function setRoomOverlayVisible(visible) {
  const overlay = uiRefs.roomOverlay;
  if (!overlay) return;
  overlay.classList.toggle("hidden", !visible);
}

function updateRoomOverlay(room = currentRoomState) {
  const status = uiRefs.roomPanelStatus;
  const title = uiRefs.roomPanelTitle;
  const startButton = uiRefs.startRoomBtn;

  if (title) {
    title.textContent = room.started ? "Partie en cours" : "Salle d'attente";
  }
  if (status) {
    const teamCounts = room.teamCounts || { red: 0, blue: 0 };
    const leaderState =
      room.leaderId === socket.id
        ? "Tu es le chef de room."
        : "En attente du chef de room.";
    const winnerState = room.winnerTeam
      ? `Victoire de l'equipe ${room.winnerTeam}.`
      : "";
    status.textContent =
      `${room.modeLabel || "3v3"} · Rouge ${teamCounts.red || 0}/${room.teamSize || 3} · Bleu ${teamCounts.blue || 0}/${room.teamSize || 3} · ${leaderState} ${winnerState}`.trim();
  }

  if (startButton) {
    startButton.classList.toggle(
      "hidden",
      room.leaderId !== socket.id || room.started,
    );
  }

  const showWaitingRoom = !room.started && !room.winnerTeam;
  setRoomOverlayVisible(showWaitingRoom);
}

function applyVolume() {
  const volume = gameSettings.volume / 100;
  const mediaElements = document.querySelectorAll("audio, video");
  for (const media of mediaElements) {
    media.volume = volume;
  }
}

function setPauseMainButtonsVisible(visible) {
  const ids = ["continueBtn", "settingsBtn", "restartBtn", "backMenuBtn"];

  for (const id of ids) {
    const element = document.getElementById(id);
    if (!element) continue;
    element.classList.toggle("hidden", !visible);
  }
}

function setSettingsOpen(nextValue) {
  isSettingsOpen = nextValue;
  const section = document.getElementById("settingsSection");
  if (section) {
    section.classList.toggle("hidden", !isSettingsOpen);
  }

  setPauseMainButtonsVisible(!isSettingsOpen);
}

function setPaused(nextValue) {
  isPaused = nextValue;
  const overlay = document.getElementById("pauseOverlay");
  if (overlay) {
    overlay.classList.toggle("hidden", !isPaused);
  }

  if (isPaused) {
    keys.left = false;
    keys.right = false;
    keys.jump = false;
    keys.dash = false;
    keys.shoot = false;
    keys.skill1 = false;
    keys.skill2 = false;
  } else {
    setSettingsOpen(false);
  }
}

// =====================
// RESIZE
// =====================
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// =====================
// INPUT
// =====================
document.addEventListener("keydown", (e) => {
  if (e.key === "h" || e.key === "H") {
    if (heroSwitchVisible) {
      setHeroSwitchVisible(false);
    } else if (canChangeHeroNow()) {
      setHeroSwitchVisible(true);
    }
    e.preventDefault();
    return;
  }

  if (e.key === "Tab") {
    leaderboardHeld = true;
    if (uiRefs.leaderboardOverlay) {
      uiRefs.leaderboardOverlay.classList.remove("hidden");
    }
    e.preventDefault();
    return;
  }

  if (e.key === "Escape") {
    if (heroSwitchVisible) {
      setHeroSwitchVisible(false);
      return;
    }

    setPaused(!isPaused);
    return;
  }

  if (isPaused) return;

  if (e.key === "q") keys.left = true;
  if (e.key === "d") keys.right = true;
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === "ArrowUp") keys.jump = true;
  if (e.key === "Shift") keys.dash = true;
  if (e.key === "f") keys.shoot = true;
  if (e.key === "a") keys.skill1 = true;
  if (e.key === "e") keys.skill2 = true;
  if (e.key === "r") keys.reload = true;
  if (e.key === " ") keys.jump = true;

  if (e.code === "Space" || e.key.startsWith("Arrow")) {
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Tab") {
    leaderboardHeld = false;
    if (uiRefs.leaderboardOverlay) {
      uiRefs.leaderboardOverlay.classList.add("hidden");
    }
    e.preventDefault();
    return;
  }

  if (isPaused) return;

  if (e.key === "q") keys.left = false;
  if (e.key === "d") keys.right = false;
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
  if (e.key === "ArrowUp") keys.jump = false;
  if (e.key === "Shift") keys.dash = false;
  if (e.key === "f") keys.shoot = false;
  if (e.key === "a") keys.skill1 = false;
  if (e.key === "e") keys.skill2 = false;
  if (e.key === "r") keys.reload = false;
  if (e.key === " ") keys.jump = false;
});

canvas.addEventListener("mousemove", (e) => {
  mouseWorld.x = e.clientX + camera.x;
  mouseWorld.y = e.clientY + camera.y;
});

canvas.addEventListener("mousedown", (e) => {
  if (isPaused) return;
  if (e.button === 0) keys.shoot = true;
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) keys.shoot = false;
});

// =====================
// SEND INPUT
// =====================
applyFps(gameSettings.fps);
startInputLoop();

// =====================
// STATE
// =====================
socket.on("state", (state) => {
  const wasStarted = !!currentRoomState.started;
  const previousWinner = currentRoomState.winnerTeam;

  if (state.room) {
    currentRoomState = {
      ...currentRoomState,
      ...state.room,
      teamCounts: state.room.teamCounts || currentRoomState.teamCounts,
      teamZones: Array.isArray(state.room.teamZones)
        ? state.room.teamZones
        : currentRoomState.teamZones,
    };
    updateRoomOverlay(currentRoomState);
    syncMapBackground(currentRoomState);
    renderLeaderboard(state.players || {}, currentRoomState);
    updateTopScoreHud(state.players || {}, currentRoomState);

    if (!wasStarted && !!currentRoomState.started) {
      showMapIntro(currentRoomState.mapName);
    }

    const hasEndedNow =
      !!wasStarted &&
      !currentRoomState.started &&
      !!currentRoomState.winnerTeam &&
      currentRoomState.winnerTeam !== previousWinner;

    if (hasEndedNow) {
      const myTeam = state.players?.[socket.id]?.team || selectedTeam;
      returnToHeroSelect(myTeam);
      return;
    }
  }

  serverPlayers = state.players;
  serverEnemies = state.enemies || {};
  serverProjectiles = state.projectiles || {};
  const incomingHitscanTraces = state.hitscanTraces || {};
  const now = performance.now();

  const hitscanIds = Object.keys(incomingHitscanTraces);
  for (let i = 0; i < hitscanIds.length; i++) {
    const id = hitscanIds[i];
    const trace = incomingHitscanTraces[id];
    if (!hitscanVisuals[id]) {
      hitscanVisuals[id] = {
        x1: trace.x1,
        y1: trace.y1,
        x2: trace.x2,
        y2: trace.y2,
        startedAt: now,
        durationMs: 110,
      };

      const hitColor =
        trace.hitType === "enemy"
          ? "rgba(255, 120, 120, "
          : "rgba(255, 228, 150, ";
      spawnImpactParticles(
        trace.x2,
        trace.y2,
        hitColor,
        trace.hitType === "enemy" ? 14 : 9,
      );
    }
  }

  serverExplosions = state.explosions || {};
  serverMap = normalizeMapPayload(state.map);

  const explosionIds = Object.keys(serverExplosions);
  for (let i = 0; i < explosionIds.length; i++) {
    const id = explosionIds[i];
    if (!seenExplosionIds[id]) {
      seenExplosionIds[id] = true;
      const exp = serverExplosions[id];
      spawnImpactParticles(exp.x, exp.y, "rgba(255, 180, 90, ", 16);
    }
  }

  const seenIds = Object.keys(seenExplosionIds);
  for (let i = 0; i < seenIds.length; i++) {
    const id = seenIds[i];
    if (!serverExplosions[id]) delete seenExplosionIds[id];
  }

  updateSkillHudFromState(serverPlayers[socket.id]);

  const myState = serverPlayers[socket.id];
  if (heroSwitchVisible && !canChangeHeroNow()) {
    setHeroSwitchVisible(false);
  }
  const hpNow = Math.max(0, Number(myState?.hp) || 0);
  if (lastLocalHp !== null && hpNow < lastLocalHp) {
    damageFlash = Math.max(damageFlash, 18);
  }
  lastLocalHp = hpNow;

  const playerIds = Object.keys(serverPlayers);
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[i];
    if (!smoothPlayers[id]) {
      smoothPlayers[id] = {
        x: serverPlayers[id].x,
        y: serverPlayers[id].y,
        onGround: !!serverPlayers[id].onGround,
      };
    }
  }
  const smoothPlayerIds = Object.keys(smoothPlayers);
  for (let i = 0; i < smoothPlayerIds.length; i++) {
    const id = smoothPlayerIds[i];
    if (!serverPlayers[id]) {
      delete smoothPlayers[id];
      delete kenjiArmatures[id];
    }
  }

  const enemyIds = Object.keys(serverEnemies);
  for (let i = 0; i < enemyIds.length; i++) {
    const id = enemyIds[i];
    if (!smoothEnemies[id]) {
      smoothEnemies[id] = { x: serverEnemies[id].x, y: serverEnemies[id].y };
    }
  }
  const smoothEnemyIds = Object.keys(smoothEnemies);
  for (let i = 0; i < smoothEnemyIds.length; i++) {
    const id = smoothEnemyIds[i];
    if (!serverEnemies[id]) delete smoothEnemies[id];
  }

  const projIds = Object.keys(serverProjectiles);
  for (let i = 0; i < projIds.length; i++) {
    const id = projIds[i];
    if (!smoothProjectiles[id]) {
      smoothProjectiles[id] = {
        x: serverProjectiles[id].x,
        y: serverProjectiles[id].y,
      };
    }
  }
  const smoothProjIds = Object.keys(smoothProjectiles);
  for (let i = 0; i < smoothProjIds.length; i++) {
    const id = smoothProjIds[i];
    if (!serverProjectiles[id]) delete smoothProjectiles[id];
  }
});

// =====================
// LERP
// =====================
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// =====================
// MY PLAYER
// =====================
function getMyPlayer() {
  return serverPlayers[socket.id];
}

function getSelectedHeroName() {
  const normalized = String(
    selectedHeroName || localStorage.getItem("selectedRole") || "",
  )
    .trim()
    .toLowerCase();
  return availableHeroes.includes(normalized)
    ? normalized
    : availableHeroes[0] || LOCAL_HEROES[0];
}

function canChangeHeroNow() {
  const me = getMyPlayer();
  if (!me) return false;
  return !!currentRoomState.started && !!me.dead;
}

function requestHeroChange() {
  if (!canChangeHeroNow()) return;

  const hero = getSelectedHeroName();
  localStorage.setItem("selectedRole", hero);
  socket.emit("changeClass", hero);
}

function setHeroSwitchVisible(visible) {
  const panel = document.getElementById("ui");
  if (!panel) return;
  heroSwitchVisible = !!visible;
  panel.classList.toggle("hidden", !heroSwitchVisible);
}

function returnToHeroSelect(teamOverride) {
  if (isReturningToHeroSelect) return;
  isReturningToHeroSelect = true;

  const safeTeam =
    String(teamOverride || selectedTeam).toLowerCase() === "blue"
      ? "blue"
      : "red";

  localStorage.setItem("pendingMultiRoom", selectedRoom);
  localStorage.setItem("pendingMultiTeam", safeTeam);
  localStorage.setItem("pendingMultiMode", selectedRoomMode);
  localStorage.setItem("selectedTeam", safeTeam);
  localStorage.setItem("selectedRoomMode", selectedRoomMode);
  localStorage.setItem("playerNickname", selectedNickname);

  const query = new URLSearchParams({
    room: selectedRoom,
    team: safeTeam,
    nickname: selectedNickname,
    roomMode: selectedRoomMode,
  });

  socket.disconnect();
  window.location.href = `${FRONTEND_ORIGIN}/multi/hero-select.html?${query.toString()}`;
}

function syncMouseWithPlayerIfNeeded() {
  const me = getMyPlayer();
  if (!me) return;

  if (mouseWorld.x === 0 && mouseWorld.y === 0) {
    mouseWorld.x = me.x + 40;
    mouseWorld.y = me.y;
  }
}

// =====================
// CAMERA
// =====================
function updateCamera(frameDeltaMs) {
  const me = getMyPlayer();
  if (!me) return;

  syncMouseWithPlayerIfNeeded();

  if (!cameraInitialized) {
    camera.x = me.x;
    camera.y = me.y;
    cameraTargetX = me.x;
    cameraTargetY = me.y;
    cameraInitialized = true;
  }

  const left = canvas.width * 0.35;
  const right = canvas.width * 0.65;
  const top = canvas.height * 0.4;
  const bottom = canvas.height * 0.6;

  const px = me.x - cameraTargetX;
  const py = me.y - cameraTargetY;

  if (px < left) cameraTargetX = me.x - left;
  else if (px > right) cameraTargetX = me.x - right;

  if (py < top) cameraTargetY = me.y - top;
  else if (py > bottom) cameraTargetY = me.y - bottom;

  const cameraAlpha = getLerpAlpha(12, frameDeltaMs);
  camera.x = lerp(camera.x, cameraTargetX, cameraAlpha);
  camera.y = lerp(camera.y, cameraTargetY, cameraAlpha);
}

// =====================
// DRAW
// =====================
function draw(timestamp) {
  if (!lastFrameTimestamp) {
    lastFrameTimestamp = timestamp;
  }

  const frameDeltaMs = timestamp - lastFrameTimestamp;
  lastFrameTimestamp = timestamp;

  if (!lastRenderTime) {
    lastRenderTime = timestamp;
  }

  if (timestamp - lastRenderTime < renderIntervalMs) {
    requestAnimationFrame(draw);
    return;
  }

  lastRenderTime = timestamp;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateCamera(frameDeltaMs);

  const viewLeft = camera.x - 100;
  const viewRight = camera.x + canvas.width + 100;
  const viewTop = camera.y - 100;
  const viewBottom = camera.y + canvas.height + 100;

  const playerAlpha = getLerpAlpha(16, frameDeltaMs);
  const enemyAlpha = getLerpAlpha(16, frameDeltaMs);
  const projectileAlpha = getLerpAlpha(26, frameDeltaMs);

  const theme = getMapTheme(currentRoomState);

  ctx.fillStyle = theme.glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (
    !mapBackgroundImage ||
    !mapBackgroundImage.complete ||
    mapBackgroundImage.naturalWidth <= 0
  ) {
    const fallbackGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    fallbackGradient.addColorStop(0, theme.haze);
    fallbackGradient.addColorStop(1, "rgba(0, 0, 0, 0.08)");
    ctx.fillStyle = fallbackGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawSpawnZoneBoundaries(currentRoomState);

  // MAP
  const palette = getMapPlatformStyle(currentRoomState);
  for (let p of normalizeMapPayload(serverMap)) {
    const platformKind = String(p.style || "default").toLowerCase();
    ctx.fillStyle = palette[platformKind] || palette.default;
    ctx.fillRect(p.x - camera.x, p.y - camera.y, p.w, p.h);
  }

  // PLAYERS
  const playerIds = Object.keys(serverPlayers);
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[i];
    const t = serverPlayers[id];
    const s = smoothPlayers[id];
    if (!s || t.dead || t.alive === false) continue;
    if (s.x < viewLeft || s.x > viewRight || s.y < viewTop || s.y > viewBottom)
      continue;

    const wasGrounded = !!s.onGround;
    const justTouchedGround = !!t.onGround && !wasGrounded;

    const predicted = getPredictedTarget(t);
    const isLocal = id === socket.id;
    const localRate = t.onGround ? 42 : 28;
    const remoteRate = t.onGround ? 30 : 22;
    const alpha = getLerpAlpha(isLocal ? localRate : remoteRate, frameDeltaMs);

    s.x = lerp(s.x, predicted.x, alpha);
    s.y = lerp(s.y, predicted.y, alpha);

    if (justTouchedGround) {
      const landingRate = isLocal ? 78 : 62;
      const landingAlpha = getLerpAlpha(landingRate, frameDeltaMs);
      s.y = lerp(s.y, t.y, landingAlpha);
    }

    if (t.onGround && Math.abs(t.y - s.y) < 1.2) {
      s.y = t.y;
    }
    if (Math.abs(t.x - s.x) < 0.1) s.x = t.x;

    s.onGround = !!t.onGround;

    drawPlayerBody(t, id, s.x, s.y, isLocal, frameDeltaMs);

    if (Number(t.viaSlashTTL) > 0 && Number.isFinite(t.viaSlashX)) {
      const slashAlpha = clamp01(Number(t.viaSlashTTL) / 10);
      const dirX = Number(t.viaSlashDirX) || 1;
      const dirY = Number(t.viaSlashDirY) || 0;
      const px = t.viaSlashX - camera.x;
      const py = t.viaSlashY - camera.y;
      const perpX = -dirY;
      const perpY = dirX;

      ctx.strokeStyle = `rgba(120, 245, 255, ${0.85 * slashAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px - perpX * 16 - dirX * 8, py - perpY * 16 - dirY * 8);
      ctx.lineTo(px + perpX * 16 + dirX * 8, py + perpY * 16 + dirY * 8);
      ctx.stroke();

      ctx.strokeStyle = `rgba(200, 255, 255, ${0.65 * slashAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - perpX * 10 - dirX * 5, py - perpY * 10 - dirY * 5);
      ctx.lineTo(px + perpX * 10 + dirX * 5, py + perpY * 10 + dirY * 5);
      ctx.stroke();
    }

    drawPlayerTag(t, s.x, s.y, isLocal);
  }

  // ENEMIES
  const enemyIds = Object.keys(serverEnemies);
  for (let i = 0; i < enemyIds.length; i++) {
    const id = enemyIds[i];
    const t = serverEnemies[id];
    const s = smoothEnemies[id];
    if (!s) continue;
    if (s.x < viewLeft || s.x > viewRight || s.y < viewTop || s.y > viewBottom)
      continue;

    const predicted = getPredictedTarget(t);
    s.x = lerp(s.x, predicted.x, enemyAlpha);
    s.y = lerp(s.y, predicted.y, enemyAlpha);

    ctx.fillStyle = "red";
    ctx.fillRect(s.x - camera.x, s.y - camera.y, 20, 20);
    drawEnemyTag(t, s.x, s.y);
  }

  // PROJECTILES
  const projIds = Object.keys(serverProjectiles);
  for (let i = 0; i < projIds.length; i++) {
    const id = projIds[i];
    const t = serverProjectiles[id];
    const s = smoothProjectiles[id];
    if (!s) continue;
    if (s.x < viewLeft || s.x > viewRight || s.y < viewTop || s.y > viewBottom)
      continue;

    const predicted = getPredictedTarget(t);
    s.x = lerp(s.x, predicted.x, projectileAlpha);
    s.y = lerp(s.y, predicted.y, projectileAlpha);

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(s.x - camera.x, s.y - camera.y, t.radius || 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // HITSCAN BULLET VISUALS
  const hitscanIds = Object.keys(hitscanVisuals);
  for (let i = 0; i < hitscanIds.length; i++) {
    const id = hitscanIds[i];
    const trace = hitscanVisuals[id];
    const elapsed = timestamp - trace.startedAt;
    const progress = clamp01(elapsed / trace.durationMs);

    if (progress >= 1) {
      delete hitscanVisuals[id];
      continue;
    }

    const dx = trace.x2 - trace.x1;
    const dy = trace.y2 - trace.y1;
    const distSq = dx * dx + dy * dy;
    if (distSq < 0.000001) {
      delete hitscanVisuals[id];
      continue;
    }

    const distance = Math.sqrt(distSq);
    const dirX = dx / distance;
    const dirY = dy / distance;
    const headX = trace.x1 + dx * progress;
    const headY = trace.y1 + dy * progress;

    const trailLength = Math.min(22, distance * 0.35);
    const tailX = headX - dirX * trailLength;
    const tailY = headY - dirY * trailLength;
    const alpha = 1 - progress;

    ctx.strokeStyle = `rgba(0, 0, 0, ${0.75 * alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tailX - camera.x, tailY - camera.y);
    ctx.lineTo(headX - camera.x, headY - camera.y);
    ctx.stroke();

    ctx.fillStyle = `rgba(0, 0, 0, ${0.95 * alpha})`;
    ctx.beginPath();
    ctx.arc(headX - camera.x, headY - camera.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // GRAPPLE LINES
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[i];
    const t = serverPlayers[id];
    if (t.dead || t.alive === false) continue;
    if (!t.grappling || t.grappleX === null || t.grappleY === null) continue;

    const px = t.x + 10 - camera.x;
    const py = t.y + 10 - camera.y;

    ctx.strokeStyle = "rgba(120, 220, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(t.grappleX - camera.x, t.grappleY - camera.y);
    ctx.stroke();

    ctx.fillStyle = "#7ce8ff";
    ctx.beginPath();
    ctx.arc(t.grappleX - camera.x, t.grappleY - camera.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // EXPLOSIONS
  const expIds = Object.keys(serverExplosions);
  for (let i = 0; i < expIds.length; i++) {
    const id = expIds[i];
    const effect = serverExplosions[id];
    const alpha = Math.max(0, effect.ttl / 12);
    const radius = effect.radius * (1 - alpha * 0.15);

    ctx.strokeStyle = `rgba(255, 184, 77, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(effect.x - camera.x, effect.y - camera.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 207, 102, ${alpha * 0.18})`;
    ctx.beginPath();
    ctx.arc(
      effect.x - camera.x,
      effect.y - camera.y,
      radius * 0.65,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  updateImpactParticles();
  drawImpactParticles();

  if (damageFlash > 0) {
    const alpha = clamp01(damageFlash / 22) * 0.45;
    ctx.fillStyle = `rgba(230, 25, 25, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    damageFlash--;
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

// =====================
// CLASS SWITCH
// =====================
window.addEventListener("DOMContentLoaded", async () => {
  const applyBtn = document.getElementById("applyClass");
  const optionsGear = document.getElementById("optionsGear");
  const continueBtn = document.getElementById("continueBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsSection = document.getElementById("settingsSection");
  const settingsBackBtn = document.getElementById("settingsBackBtn");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeValue = document.getElementById("volumeValue");
  const fullscreenToggle = document.getElementById("fullscreenToggle");
  const fpsSelect = document.getElementById("fpsSelect");
  const restartBtn = document.getElementById("restartBtn");
  const backMenuBtn = document.getElementById("backMenuBtn");
  const roomOverlay = document.getElementById("roomOverlay");
  const roomPanelTitle = document.getElementById("roomPanelTitle");
  const roomPanelStatus = document.getElementById("roomPanelStatus");
  const startRoomBtn = document.getElementById("startRoomBtn");
  const leaveRoomBtn = document.getElementById("leaveRoomBtn");
  const leaderboardOverlay = document.getElementById("leaderboardOverlay");
  const leaderboardContent = document.getElementById("leaderboardContent");
  const redTeamScore = document.getElementById("redTeamScore");
  const blueTeamScore = document.getElementById("blueTeamScore");
  const teamScoreTarget = document.getElementById("teamScoreTarget");

  uiRefs = {
    roomOverlay,
    roomPanelTitle,
    roomPanelStatus,
    startRoomBtn,
    leaveRoomBtn,
    leaderboardOverlay,
    leaderboardContent,
    redTeamScore,
    blueTeamScore,
    teamScoreTarget,
  };

  if (!applyBtn) return;

  availableHeroes = await loadAvailableHeroes();
  if (!Array.isArray(availableHeroes) || availableHeroes.length === 0) {
    availableHeroes = [...LOCAL_HEROES];
  }
  selectedHeroName =
    localStorage.getItem("selectedRole") ||
    selectedRole ||
    availableHeroes[0] ||
    LOCAL_HEROES[0];
  if (!availableHeroes.includes(selectedHeroName)) {
    selectedHeroName = availableHeroes[0] || LOCAL_HEROES[0];
  }
  renderHeroSwitchCards();

  applyVolume();

  if (settingsSection) {
    settingsSection.classList.add("hidden");
  }

  if (volumeSlider) {
    volumeSlider.value = String(gameSettings.volume);
  }

  if (volumeValue) {
    volumeValue.textContent = gameSettings.volume + "%";
  }

  if (fullscreenToggle) {
    const isFullscreen = !!document.fullscreenElement;
    fullscreenToggle.checked = isFullscreen || gameSettings.fullscreen;
  }

  if (fpsSelect) {
    fpsSelect.value = String(gameSettings.fps);
  }

  applyBtn.addEventListener("click", () => {
    requestHeroChange();
    setHeroSwitchVisible(false);
  });

  setHeroSwitchVisible(false);

  if (optionsGear) {
    optionsGear.addEventListener("click", () => {
      setPaused(!isPaused);
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      setPaused(false);
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      setSettingsOpen(!isSettingsOpen);
    });
  }

  if (settingsBackBtn) {
    settingsBackBtn.addEventListener("click", () => {
      setSettingsOpen(false);
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      gameSettings.volume = Number(volumeSlider.value);
      if (volumeValue) {
        volumeValue.textContent = gameSettings.volume + "%";
      }
      applyVolume();
      saveSettings(gameSettings);
    });
  }

  if (fullscreenToggle) {
    fullscreenToggle.addEventListener("change", async () => {
      try {
        if (fullscreenToggle.checked && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else if (!fullscreenToggle.checked && document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (error) {
        fullscreenToggle.checked = !!document.fullscreenElement;
      }

      gameSettings.fullscreen = !!document.fullscreenElement;
      saveSettings(gameSettings);
    });
  }

  if (fpsSelect) {
    fpsSelect.addEventListener("change", () => {
      applyFps(Number(fpsSelect.value));
    });
  }

  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = !!document.fullscreenElement;
    if (fullscreenToggle) {
      fullscreenToggle.checked = isFullscreen;
    }
    gameSettings.fullscreen = isFullscreen;
    saveSettings(gameSettings);
  });

  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }

  if (backMenuBtn) {
    backMenuBtn.addEventListener("click", () => {
      window.location.href = `${FRONTEND_ORIGIN}/multi/`;
    });
  }

  if (startRoomBtn) {
    startRoomBtn.addEventListener("click", () => {
      socket.emit("startRoom");
    });
  }

  if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener("click", () => {
      window.location.href = `${FRONTEND_ORIGIN}/multi/`;
    });
  }
});
