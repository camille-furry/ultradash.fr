// =====================
// MENU LOGIC
// =====================
window.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("roleSelect");
  const playButton = document.getElementById("playButton");

  if (!select || !playButton) return;

  playButton.addEventListener("click", (e) => {
    e.preventDefault(); // empêche le submit classique

    const role = select.value;

    // 💾 Sauvegarde
    localStorage.setItem("selectedRole", role);

    // 🚀 Redirection vers le jeu
    window.location.href = "game.html";
  });
});
