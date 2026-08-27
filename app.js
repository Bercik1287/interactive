const bounds = [
  [0, 0],
  [100, 100]
];

function buildOverlayPlaceholder(mapName) {
  const placeholderSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101722"/>
      <stop offset="100%" stop-color="#22354b"/>
    </linearGradient>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#6ca2d640" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="2000" height="2000" fill="url(#g)"/>
  <rect width="2000" height="2000" fill="url(#grid)"/>
  <g fill="#ffffff70" font-family="sans-serif" font-size="70">
    <text x="90" y="160">${mapName.toUpperCase()} - BASE PLACEHOLDER</text>
    <text x="980" y="1900">Set map image in /admin</text>
  </g>
</svg>
`);
  return `data:image/svg+xml;charset=UTF-8,${placeholderSvg}`;
}

async function apiJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function initMapApp() {
  const DEFAULT_MARKER_BASE_SIZE_PX = 128;
  const DEFAULT_MARKER_SCALE_PERCENT = 100;
  const map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 8,
    zoomSnap: 0.1,
    zoomDelta: 0.25,
    wheelPxPerZoomLevel: 80,
    scrollWheelZoom: true,
    zoomControl: true
  });
  map.fitBounds(bounds);
  // Defensive invalidation: map container size can change after layout/hamburger transitions.
  setTimeout(() => map.invalidateSize(), 0);
  setTimeout(() => map.invalidateSize(), 120);

  const filtersContainer = document.getElementById("filters-container");
  const legend = document.getElementById("legend");
  const mapTitle = document.getElementById("map-title");
  const gameTitle = document.getElementById("game-title");
  const mapSelect = document.getElementById("map-select");
  const drawer = document.getElementById("marker-drawer");
  const drawerBackdrop = document.getElementById("drawer-backdrop");
  const menuToggle = document.getElementById("menu-toggle");
  const globalSearch = document.getElementById("global-game-search");
  const gameOptions = document.getElementById("map-game-options");

  let state = { categoryGroups: {}, games: [], maps: [], categories: [], markers: [] };
  let currentMap = null;
  let currentGame = null;
  let overlayLayer = null;
  let layerByType = new Map();
  let markerById = new Map();
  let enabledTypes = new Set();

  const getMapMarkers = (mapId) => state.markers.filter((marker) => marker.mapId === mapId);
  const categoryById = (categoryId) => state.categories.find((category) => category.id === categoryId);
  const gameById = (gameId) => state.games.find((game) => game.id === gameId);
  const getMapCategories = (mapId) => {
    const mapEntry = state.maps.find((item) => item.id === mapId);
    if (!mapEntry) return [];
    return state.categories.filter((category) => category.gameId === mapEntry.gameId);
  };
  const mapsByGame = (gameId) => state.maps.filter((mapEntry) => mapEntry.gameId === gameId);

  function openDrawer() {
    drawer.classList.add("open");
    drawerBackdrop.classList.add("open");
    setTimeout(() => map.invalidateSize(), 180);
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawerBackdrop.classList.remove("open");
    setTimeout(() => map.invalidateSize(), 180);
  }

  function normalizedMarkerScalePercent(value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return DEFAULT_MARKER_SCALE_PERCENT;
    return Math.max(10, Math.min(400, parsed));
  }

  function currentMarkerSizePx() {
    const percent = normalizedMarkerScalePercent(currentMap?.markerScalePercent);
    return Math.round((DEFAULT_MARKER_BASE_SIZE_PX * percent) / 100);
  }

  function makeMarkerIcon(marker, category) {
    const iconSize = currentMarkerSizePx();
    const iconAnchor = Math.round(iconSize / 2);
    if (marker.iconUrl || category?.iconUrl) {
      return L.divIcon({
        className: "",
        html: `<img src="${marker.iconUrl || category.iconUrl}" style="width:${iconSize}px;height:${iconSize}px;object-fit:contain;" />`,
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconAnchor, iconAnchor]
      });
    }
    const dotSize = Math.max(14, Math.round(iconSize * 0.24));
    const dotAnchor = Math.round(dotSize / 2);
    return L.divIcon({
      className: "",
      html: `<div class="marker-dot" style="background:${category?.color || "#ddd"}"></div>`,
      iconSize: [dotSize, dotSize],
      iconAnchor: [dotAnchor, dotAnchor]
    });
  }

  const toLatLng = (point) => [point.y, point.x];

  function createMarkerLayer(marker) {
    const category = categoryById(marker.categoryId);
    return L.marker(toLatLng(marker), { icon: makeMarkerIcon(marker, category) }).bindPopup(
      `<strong>${marker.name || "Untitled"}</strong><br/>
      <small>${category?.name || "Unknown"}</small><br/>
      ${marker.note || ""}<br/>
      <small>X: ${marker.x.toFixed(2)}, Y: ${marker.y.toFixed(2)}</small>`
    );
  }

  function clearPointLayers() {
    for (const layer of layerByType.values()) map.removeLayer(layer);
    layerByType = new Map();
    markerById = new Map();
  }

  function updateLegend(extraText = "") {
    if (!currentMap) return;
    const visibleCount = getMapMarkers(currentMap.id).filter((marker) => {
      const category = categoryById(marker.categoryId);
      return category && enabledTypes.has(category.name);
    }).length;
    legend.innerHTML = `<strong>Mapa:</strong> ${currentMap.name}<br/><strong>Widoczne:</strong> ${visibleCount}/${getMapMarkers(currentMap.id).length}${
      extraText ? `<br/>${extraText}` : ""
    }`;
  }

  function setTypeVisibility(typeName, visible) {
    const layer = layerByType.get(typeName);
    if (!layer) return;
    if (visible) {
      if (!map.hasLayer(layer)) layer.addTo(map);
      enabledTypes.add(typeName);
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      enabledTypes.delete(typeName);
    }
  }

  function colorWithAlpha(color, alpha = 0.2) {
    const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || "").trim());
    if (!match) return `rgba(71, 184, 255, ${safeAlpha})`;
    const hex = match[1];
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    const intVal = Number.parseInt(normalized, 16);
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  function renderFilters() {
    const mapCategories = currentMap ? getMapCategories(currentMap.id) : [];
    const categoriesByGroup = new Map();
    for (const category of mapCategories) {
      const group = category.group || "Other";
      if (!categoriesByGroup.has(group)) categoriesByGroup.set(group, []);
      categoriesByGroup.get(group).push(category);
    }
    const orderedGroups = [
      ...Object.keys(state.categoryGroups || {}),
      ...Array.from(categoriesByGroup.keys()).filter(
        (groupName) => !Object.prototype.hasOwnProperty.call(state.categoryGroups || {}, groupName)
      )
    ].filter((groupName, idx, arr) => arr.indexOf(groupName) === idx && categoriesByGroup.has(groupName));

    const groups = orderedGroups
      .map((groupName) => {
        const rows = (categoriesByGroup.get(groupName) || [])
          .map((category) => {
            const type = category.name;
            const markersForType = getMapMarkers(currentMap.id).filter(
              (marker) => marker.categoryId === category.id
            );
            const count = markersForType.length;
            const iconUrl = category.iconUrl || markersForType.find((marker) => marker.iconUrl)?.iconUrl || "";
            const isEnabled = enabledTypes.has(type);
            const fallbackColor = category?.color || "#9ca3af";
            const activeStyle = isEnabled
              ? ` style="border-color:${fallbackColor};background:${colorWithAlpha(fallbackColor, 0.2)};"`
              : "";
            return `
              <div class="category-channel" data-type="${type}">
                <button type="button" class="type-toggle${isEnabled ? " is-enabled" : ""}" data-type="${type}"${activeStyle}>
                  <span class="type-main">
                    <span class="type-icon">
                      ${
                        iconUrl
                          ? `<img src="${iconUrl}" alt="" loading="lazy" />`
                          : `<span class="type-dot" style="background:${fallbackColor}"></span>`
                      }
                    </span>
                    <span># ${type}</span>
                  </span>
                  <span class="count">${count}</span>
                </button>
              </div>
            `;
          })
          .join("");
        return `<details class="group" open><summary>${groupName}</summary><div class="group__body">${rows}</div></details>`;
      })
      .join("");
    filtersContainer.innerHTML = groups;
    document.querySelectorAll(".type-toggle").forEach((button) => {
      button.addEventListener("click", (event) => {
        const type = event.currentTarget.dataset.type;
        setTypeVisibility(type, !enabledTypes.has(type));
        renderFilters();
        updateLegend();
      });
    });
  }

  function activateMapById(mapId) {
    const selectedMap = state.maps.find((entry) => entry.id === mapId);
    if (!selectedMap) return;
    currentGame = gameById(selectedMap.gameId) || null;
    currentMap = selectedMap;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("game", selectedMap.gameId);
    nextUrl.searchParams.set("map", selectedMap.id);
    window.history.replaceState({}, "", nextUrl);
    mapTitle.textContent = `${selectedMap.name} Map`;
    gameTitle.textContent = currentGame ? currentGame.name : "Unknown game";
    globalSearch.value = currentGame?.name || "";
    renderMapSelectForGame(selectedMap.gameId, selectedMap.id);
    enabledTypes = new Set(getMapCategories(selectedMap.id).map((category) => category.name));
    clearPointLayers();
    if (overlayLayer) map.removeLayer(overlayLayer);
    overlayLayer = L.imageOverlay(
      selectedMap.baseImageUrl || buildOverlayPlaceholder(selectedMap.name),
      bounds
    ).addTo(map);
    for (const category of getMapCategories(selectedMap.id)) {
      layerByType.set(category.name, L.layerGroup().addTo(map));
    }
    for (const marker of getMapMarkers(selectedMap.id)) {
      const category = categoryById(marker.categoryId);
      if (!category) continue;
      if (!layerByType.has(category.name)) layerByType.set(category.name, L.layerGroup().addTo(map));
      const markerLayer = createMarkerLayer(marker);
      markerById.set(marker.id, markerLayer);
      markerLayer.addTo(layerByType.get(category.name));
    }
    renderFilters();
    updateLegend();
  }

  function renderMapSelectForGame(gameId, activeMapId = "") {
    mapSelect.innerHTML = mapsByGame(gameId)
      .map((entry) => `<option value="${entry.id}">${entry.name}</option>`)
      .join("");
    if (activeMapId) {
      mapSelect.value = activeMapId;
    }
  }

  const data = await apiJson("/api/map-data");
  const urlParams = new URLSearchParams(window.location.search);
  const initialGameId = urlParams.get("game");
  const initialMapId = urlParams.get("map");
  state = {
    categoryGroups: data.categoryGroups || {},
    games: data.games || [],
    maps: data.maps || [],
    categories: data.categories || [],
    markers: data.markers || []
  };
  if (state.maps.length === 0) throw new Error("Brak map");
  gameOptions.innerHTML = state.games
    .map((game) => `<option value="${game.name}"></option>`)
    .join("");

  let startMapId = state.maps[0].id;
  const initialMap = initialMapId ? state.maps.find((entry) => entry.id === initialMapId) : null;
  if (initialMap && (!initialGameId || initialMap.gameId === initialGameId)) {
    startMapId = initialMap.id;
  } else if (initialGameId) {
    const firstGameMap = mapsByGame(initialGameId)[0];
    if (firstGameMap) {
      startMapId = firstGameMap.id;
    } else if (initialMap) {
      startMapId = initialMap.id;
    }
  }
  activateMapById(startMapId);

  mapSelect.addEventListener("change", (event) => activateMapById(event.target.value));
  menuToggle.addEventListener("click", () => {
    if (drawer.classList.contains("open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
  drawerBackdrop.addEventListener("click", closeDrawer);

  globalSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const match = state.games.find(
      (game) => game.name.trim().toLowerCase() === globalSearch.value.trim().toLowerCase()
    );
    if (!match) return;
    const firstMap = mapsByGame(match.id)[0];
    if (!firstMap) return;
    activateMapById(firstMap.id);
  });
  document.getElementById("show-all-btn").addEventListener("click", () => {
    for (const type of enabledTypes) setTypeVisibility(type, true);
    renderFilters();
    updateLegend();
  });
  document.getElementById("hide-all-btn").addEventListener("click", () => {
    for (const type of [...enabledTypes]) setTypeVisibility(type, false);
    renderFilters();
    updateLegend();
  });
  document.getElementById("search-input").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    if (!query) {
      document.querySelectorAll(".category-channel").forEach((row) => (row.style.display = ""));
      updateLegend();
      return;
    }
    let hits = 0;
    const mapTypes = getMapCategories(currentMap.id).map((entry) => entry.name);
    for (const type of mapTypes) {
      const row = document.querySelector(`.category-channel[data-type="${type}"]`);
      if (!row) continue;
      const category = getMapCategories(currentMap.id).find((entry) => entry.name === type);
      const markerMatch = category
        ? getMapMarkers(currentMap.id).some(
            (marker) =>
              marker.categoryId === category.id && marker.name.toLowerCase().includes(query)
          )
        : false;
      const visible = type.toLowerCase().includes(query) || markerMatch;
      row.style.display = visible ? "" : "none";
      if (visible) hits += 1;
    }
    updateLegend(`Wyniki wyszukiwania: ${hits}`);
  });

  window.addEventListener("resize", () => {
    map.invalidateSize();
  });

  if (window.innerWidth > 980) {
    openDrawer();
  }
}

initMapApp().catch((error) => {
  const legend = document.getElementById("legend");
  legend.innerHTML = `<span class="danger">Blad ladowania mapy: ${error.message}</span>`;
});
