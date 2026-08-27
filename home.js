function normalize(text) {
  return (text || "").trim().toLowerCase();
}

async function initHomePage() {
  const response = await fetch("/api/map-data");
  const data = await response.json();
  const games = data.games || [];
  const maps = data.maps || [];

  const grid = document.getElementById("game-grid");
  const searchInput = document.getElementById("global-game-search");
  const options = document.getElementById("home-game-options");

  function mapsForGame(gameId) {
    return maps.filter((mapEntry) => mapEntry.gameId === gameId);
  }

  function firstMapForGame(gameId) {
    return mapsForGame(gameId)[0];
  }

  function renderCards(query = "") {
    const q = normalize(query);
    const filteredGames = games.filter((game) => normalize(game.name).includes(q));
    grid.innerHTML = filteredGames
      .map((game) => {
        const gameMaps = mapsForGame(game.id);
        const firstMap = firstMapForGame(game.id);
        const targetHref = firstMap ? `/map?game=${game.id}&map=${firstMap.id}` : `/map?game=${game.id}`;
        return `
          <a href="${targetHref}" class="game-card">
            <h3>${game.name}</h3>
            <p>Mapy: ${gameMaps.length}</p>
          </a>
        `;
      })
      .join("");
  }

  options.innerHTML = games.map((game) => `<option value="${game.name}"></option>`).join("");
  renderCards();

  searchInput.addEventListener("input", (event) => {
    renderCards(event.target.value);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const match = games.find((game) => normalize(game.name) === normalize(searchInput.value));
    if (!match) return;
    const firstMap = firstMapForGame(match.id);
    const href = firstMap ? `/map?game=${match.id}&map=${firstMap.id}` : `/map?game=${match.id}`;
    window.location.href = href;
  });
}

initHomePage().catch((error) => {
  const grid = document.getElementById("game-grid");
  grid.innerHTML = `<div class="marker-empty">Blad ladowania listy gier: ${error.message}</div>`;
});
