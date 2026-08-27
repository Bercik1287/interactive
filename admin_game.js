function norm(value) {
  return (value || "").trim().toLowerCase();
}

async function fetchMapData() {
  const response = await fetch("/api/map-data");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function createMap(gameId, name) {
  const response = await fetch("/api/admin/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, name })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function deleteMap(mapId) {
  const response = await fetch(`/api/admin/maps/${mapId}`, { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function initAdminGamePage() {
  const title = document.getElementById("admin-game-title");
  const searchInput = document.getElementById("admin-map-search");
  const addMapBtn = document.getElementById("admin-add-map-btn");
  const grid = document.getElementById("admin-map-grid");
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("game");

  let game = null;
  let maps = [];

  function render(query = "") {
    const q = norm(query);
    const filtered = maps.filter((entry) => norm(entry.name).includes(q));
    grid.innerHTML = filtered
      .map(
        (entry) => `
          <article class="game-card">
            <h3>${entry.name}</h3>
            <p>Edytuj znaczniki i kategorie</p>
            <div class="card-actions">
              <a class="link-button" href="/admin/map?map=${entry.id}">Otworz</a>
              <button type="button" class="admin-danger-btn" data-delete-map-id="${entry.id}">Usun mape</button>
            </div>
          </article>
        `
      )
      .join("");

    grid.querySelectorAll("[data-delete-map-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const mapId = button.dataset.deleteMapId;
        const mapEntry = maps.find((entry) => entry.id === mapId);
        if (!mapEntry) return;
        const confirmed = window.confirm(`Usunac mape "${mapEntry.name}" i wszystkie jej znaczniki?`);
        if (!confirmed) return;
        try {
          await deleteMap(mapId);
          await reload();
        } catch (error) {
          window.alert(`Nie udalo sie usunac mapy: ${error.message}`);
        }
      });
    });
  }

  async function reload() {
    const data = await fetchMapData();
    game = (data.games || []).find((entry) => entry.id === gameId) || null;
    if (!game) {
      window.location.href = "/admin";
      return;
    }
    maps = (data.maps || []).filter((entry) => entry.gameId === gameId);
    title.textContent = `Admin - ${game.name}`;
    render(searchInput.value);
  }

  searchInput.addEventListener("input", (event) => render(event.target.value));
  addMapBtn.addEventListener("click", async () => {
    const name = window.prompt("Podaj nazwe nowej mapy:");
    if (!name || !name.trim()) return;
    try {
      const created = await createMap(gameId, name.trim());
      await reload();
      window.location.href = `/admin/map?map=${created.id}`;
    } catch (error) {
      window.alert(`Nie udalo sie dodac mapy: ${error.message}`);
    }
  });

  await reload();
}

initAdminGamePage().catch((error) => {
  const grid = document.getElementById("admin-map-grid");
  grid.innerHTML = `<div class="marker-empty">Blad strony gry: ${error.message}</div>`;
});
