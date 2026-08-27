function normalizeText(value) {
  return (value || "").trim().toLowerCase();
}

async function fetchData() {
  const response = await fetch("/api/map-data");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function createGame(name) {
  const response = await fetch("/api/admin/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function deleteGame(gameId) {
  const response = await fetch(`/api/admin/games/${gameId}`, { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function initAdminHomePage() {
  const grid = document.getElementById("admin-game-grid");
  const searchInput = document.getElementById("admin-game-search");
  const datalist = document.getElementById("admin-game-options");
  const addButton = document.getElementById("admin-add-game-btn");

  let games = [];
  let maps = [];

  function mapsCountByGameId(gameId) {
    return maps.filter((entry) => entry.gameId === gameId).length;
  }

  function render(query = "") {
    const q = normalizeText(query);
    const filtered = games.filter((game) => normalizeText(game.name).includes(q));
    grid.innerHTML = filtered
      .map((game) => {
        const count = mapsCountByGameId(game.id);
        return `
          <article class="game-card">
            <h3>${game.name}</h3>
            <p>Mapy: ${count}</p>
            <div class="card-actions">
              <a class="link-button" href="/admin/game?game=${game.id}">Otworz</a>
              <button type="button" class="admin-danger-btn" data-delete-game-id="${game.id}">Usun gre</button>
            </div>
          </article>
        `;
      })
      .join("");

    grid.querySelectorAll("[data-delete-game-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const gameId = button.dataset.deleteGameId;
        const game = games.find((entry) => entry.id === gameId);
        if (!game) return;
        const confirmed = window.confirm(
          `Usunac gre "${game.name}"? To usunie wszystkie mapy, kategorie i znaczniki tej gry.`
        );
        if (!confirmed) return;
        try {
          await deleteGame(gameId);
          await reload();
        } catch (error) {
          window.alert(`Nie udalo sie usunac gry: ${error.message}`);
        }
      });
    });
  }

  async function reload() {
    const data = await fetchData();
    games = data.games || [];
    maps = data.maps || [];
    datalist.innerHTML = games.map((game) => `<option value="${game.name}"></option>`).join("");
    render(searchInput.value);
  }

  searchInput.addEventListener("input", (event) => render(event.target.value));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const match = games.find((game) => normalizeText(game.name) === normalizeText(searchInput.value));
    if (!match) return;
    window.location.href = `/admin/game?game=${match.id}`;
  });

  addButton.addEventListener("click", async () => {
    const name = window.prompt("Podaj nazwe nowej gry:");
    if (!name || !name.trim()) return;
    try {
      const created = await createGame(name.trim());
      await reload();
      window.location.href = `/admin/game?game=${created.id}`;
    } catch (error) {
      window.alert(`Nie udalo sie dodac gry: ${error.message}`);
    }
  });

  await reload();
}

initAdminHomePage().catch((error) => {
  const grid = document.getElementById("admin-game-grid");
  grid.innerHTML = `<div class="marker-empty">Blad panelu admina: ${error.message}</div>`;
});
