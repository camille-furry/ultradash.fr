const fs = require("fs");
const path = require("path");

const HERO_DIR = __dirname;
const RESERVED_FILES = new Set(["registry.js", "index.js"]);

function getAvailableHeroes() {
  const files = fs
    .readdirSync(HERO_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".js") && !RESERVED_FILES.has(name));

  return files.map((name) => name.replace(/\.js$/, "")).sort();
}

function loadHeroClass(heroName) {
  if (!heroName) return null;

  const normalized = String(heroName).toLowerCase();
  const filePath = path.join(HERO_DIR, normalized + ".js");

  if (!fs.existsSync(filePath)) return null;
  return require(filePath);
}
module.exports = {
  getAvailableHeroes,
  loadHeroClass,
};
