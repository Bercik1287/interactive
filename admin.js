const bounds = [[0, 0], [100, 100]];

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
    <text x="90" y="160">${mapName.toUpperCase()} - ADMIN VIEW</text>
  </g>
</svg>
`);
  return `data:image/svg+xml;charset=UTF-8,${placeholderSvg}`;
}

async function apiJson(url, method = "GET", payload) {
  const response = await fetch(url, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function uploadImage(file, kind) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  const response = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Upload failed");
  return data.url;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function initAdminPage() {
  const DEFAULT_MARKER_BASE_SIZE_PX = 128;
  const DEFAULT_MARKER_SCALE_PERCENT = 100;
  const queryParams = new URLSearchParams(window.location.search);
  const initialMapIdFromQuery = queryParams.get("map");
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

  let state = { adminCategoryGroups: {}, maps: [], categories: [], markers: [] };
  let currentMap = null;
  let overlayLayer = null;
  let markerLayerById = new Map();
  let placingMarkerId = null;
  let selectedCategoryId = null;
  let selectedMarkerIds = new Set();
  let pendingCategoryDrag = null;
  let activeCategoryDrag = null;
  let markerDragContext = null;
  let selectionState = null;
  const undoStack = [];
  const redoStack = [];

  const statusEl = document.getElementById("admin-status");
  const mapSelect = document.getElementById("admin-map-select");
  const markerSizePercentInput = document.getElementById("admin-marker-size-percent");
  const saveMarkerSizeBtn = document.getElementById("admin-save-marker-size-btn");
  const deleteMapBtn = document.getElementById("admin-delete-map-btn");
  const legend = document.getElementById("legend");
  const channelTree = document.getElementById("admin-channel-tree");
  const categoryModal = document.getElementById("admin-category-modal");
  const categoryModalCloseBtn = document.getElementById("admin-category-modal-close");
  const categoryNameInput = document.getElementById("admin-category-name-input");
  const categoryColorInput = document.getElementById("admin-category-color-input");
  const categoryIconFileInput = document.getElementById("admin-category-icon-file");
  const categorySaveBtn = document.getElementById("admin-category-save-btn");
  const categoryDeleteBtn = document.getElementById("admin-category-delete-btn");
  const categoryMarkerList = document.getElementById("admin-category-marker-list");
  const mapContainer = document.getElementById("map");
  const mapShell = mapContainer.parentElement;
  const trashEl = document.getElementById("admin-trash");
  const collapsedGroups = new Set();

  const dragGhost = document.createElement("div");
  dragGhost.className = "drag-marker-ghost";
  dragGhost.innerHTML = '<div class="drag-marker-ghost__tear"></div>';
  document.body.appendChild(dragGhost);

  const selectionBox = document.createElement("div");
  selectionBox.className = "map-select-box";
  mapShell.appendChild(selectionBox);

  const getMapMarkers = (mapId) => state.markers.filter((marker) => marker.mapId === mapId);
  const getMapCategories = (mapId) => {
    const mapEntry = state.maps.find((entry) => entry.id === mapId);
    if (!mapEntry) return [];
    return state.categories.filter((category) => category.gameId === mapEntry.gameId);
  };
  const categoryById = (categoryId) => state.categories.find((entry) => entry.id === categoryId);
  const categoryMarkersForCurrentMap = (categoryId) =>
    currentMap ? getMapMarkers(currentMap.id).filter((marker) => marker.categoryId === categoryId) : [];

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

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle("danger", isError);
  }

  function closeCategoryEditorModal() {
    categoryModal.classList.add("hidden");
    categoryModal.setAttribute("aria-hidden", "true");
    categoryMarkerList.innerHTML = "";
    categoryIconFileInput.value = "";
  }

  function openCategoryEditorModal(categoryId) {
    selectedCategoryId = categoryId;
    const category = categoryById(selectedCategoryId);
    if (!currentMap || !category) {
      closeCategoryEditorModal();
      return;
    }
    categoryModal.classList.remove("hidden");
    categoryModal.setAttribute("aria-hidden", "false");
    categoryNameInput.value = category.name || "";
    categoryColorInput.value = category.color || "#9ca3af";
    const markers = categoryMarkersForCurrentMap(category.id);
    categoryMarkerList.innerHTML = `
      <details class="group admin-marker-group">
        <summary>Znaczniki typu "${escapeHtml(category.name)}" (${markers.length})</summary>
        <div class="group__body">
          <div class="admin-marker-editor-items">
            ${
              markers.length
                ? markers
                    .map(
                      (marker) => `
              <div class="admin-marker-editor-item" data-marker-id="${marker.id}">
                <input type="text" data-marker-name-id="${marker.id}" value="${escapeHtml(marker.name)}" />
                <button type="button" class="admin-danger-btn" data-delete-marker-id="${marker.id}">Usun</button>
              </div>
            `
                    )
                    .join("")
                : '<div class="marker-empty">Brak znacznikow tego typu na tej mapie.</div>'
            }
          </div>
          ${
            markers.length
              ? '<button type="button" id="admin-save-marker-names-btn">Zapisz nazwy znacznikow</button>'
              : ""
          }
        </div>
      </details>
    `;

    const saveNamesBtn = document.getElementById("admin-save-marker-names-btn");
    if (saveNamesBtn) {
      saveNamesBtn.addEventListener("click", async () => {
        const before = clone(getMapMarkers(currentMap.id));
        const nextNames = new Map();
        categoryMarkerList.querySelectorAll("[data-marker-name-id]").forEach((input) => {
          const markerId = input.dataset.markerNameId;
          nextNames.set(markerId, input.value.trim() || "Untitled");
        });
        const after = before.map((marker) =>
          nextNames.has(marker.id) ? { ...marker, name: nextNames.get(marker.id) } : marker
        );
        try {
          await replaceMapMarkers(currentMap.id, after);
          await refreshData(currentMap.id);
          recordHistory(currentMap.id, before, after, `Zmieniono nazwy znacznikow: ${category.name}`);
          setStatus("Nazwy znacznikow zapisane.");
        } catch (error) {
          setStatus(`Blad zapisu nazw: ${error.message}`, true);
        }
      });
    }

    categoryMarkerList.querySelectorAll("[data-delete-marker-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const markerId = button.dataset.deleteMarkerId;
        const marker = getMapMarkers(currentMap.id).find((entry) => entry.id === markerId);
        if (!marker) return;
        const confirmed = window.confirm(`Usunac znacznik "${marker.name}"?`);
        if (!confirmed) return;
        const before = clone(getMapMarkers(currentMap.id));
        const after = before.filter((entry) => entry.id !== markerId);
        try {
          await replaceMapMarkers(currentMap.id, after);
          await refreshData(currentMap.id);
          recordHistory(currentMap.id, before, after, `Usunieto znacznik ${marker.name}`);
          setStatus(`Usunieto znacznik: ${marker.name}`);
        } catch (error) {
          setStatus(`Blad usuwania znacznika: ${error.message}`, true);
        }
      });
    });
  }

  function setTrashHover(hover) {
    trashEl.classList.toggle("is-hover", hover);
  }

  function setDragGhostPosition(clientX, clientY) {
    dragGhost.style.left = `${clientX}px`;
    dragGhost.style.top = `${clientY}px`;
  }

  function setDragGhostColor(color) {
    dragGhost.querySelector(".drag-marker-ghost__tear").style.background = color || "#9ca3af";
  }

  function isOverTrash(clientX, clientY) {
    const rect = trashEl.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }

  function mapClientFromLatLng(latLng) {
    const point = map.latLngToContainerPoint(latLng);
    const rect = mapContainer.getBoundingClientRect();
    return { x: rect.left + point.x, y: rect.top + point.y };
  }

  function setOverlayForMap(mapEntry) {
    if (overlayLayer) map.removeLayer(overlayLayer);
    overlayLayer = L.imageOverlay(
      mapEntry.baseImageUrl || buildOverlayPlaceholder(mapEntry.name),
      bounds
    ).addTo(map);
  }

  function updateSelectedMarkerVisuals() {
    markerLayerById.forEach((layer, markerId) => {
      if (!layer._icon) return;
      layer._icon.classList.toggle("marker-selected", selectedMarkerIds.has(markerId));
    });
  }

  function recordHistory(mapId, beforeMarkers, afterMarkers, label) {
    if (JSON.stringify(beforeMarkers) === JSON.stringify(afterMarkers)) return;
    undoStack.push({ mapId, before: clone(beforeMarkers), after: clone(afterMarkers), label });
    redoStack.length = 0;
  }

  async function replaceMapMarkers(mapId, markers) {
    await apiJson("/api/admin/markers/bulk-replace", "POST", { mapId, markers });
  }

  async function refreshData(preferredMapId) {
    const data = await apiJson("/api/map-data");
    state = {
      adminCategoryGroups: data.adminCategoryGroups || {},
      maps: data.maps || [],
      categories: data.categories || [],
      markers: data.markers || []
    };
    if (!state.maps.length) throw new Error("Brak map");
    const targetMapId =
      preferredMapId && state.maps.some((item) => item.id === preferredMapId)
        ? preferredMapId
        : state.maps[0].id;
    activateMap(targetMapId);
  }

  async function applySnapshot(entry, direction) {
    const snapshot = direction === "undo" ? entry.before : entry.after;
    await replaceMapMarkers(entry.mapId, snapshot);
    await refreshData(entry.mapId);
  }

  async function undoAction() {
    const entry = undoStack.pop();
    if (!entry) return;
    await applySnapshot(entry, "undo");
    redoStack.push(entry);
    setStatus(`Cofnieto: ${entry.label}`);
  }

  async function redoAction() {
    const entry = redoStack.pop();
    if (!entry) return;
    await applySnapshot(entry, "redo");
    undoStack.push(entry);
    setStatus(`Ponowiono: ${entry.label}`);
  }

  function renderSelectors() {
    mapSelect.innerHTML = state.maps.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
    if (currentMap) mapSelect.value = currentMap.id;

    const categories = currentMap ? getMapCategories(currentMap.id) : [];
    if (!selectedCategoryId || !categories.some((category) => category.id === selectedCategoryId)) {
      selectedCategoryId = categories[0]?.id || null;
    }

    const markers = currentMap ? getMapMarkers(currentMap.id) : [];
    document.getElementById("admin-marker-select").innerHTML = markers
      .map((marker) => `<option value="${marker.id}">${marker.name}</option>`)
      .join("");
  }

  function renderCategoryPicker() {
    if (!currentMap) {
      channelTree.innerHTML = "";
      return;
    }
    const categories = getMapCategories(currentMap.id);
    const groupNamesRaw = state.adminCategoryGroups[currentMap.gameId] || [];
    const autoGroups = [...new Set(categories.map((category) => category.group))];
    const groupNames = [...new Set([...groupNamesRaw, ...autoGroups])];

    if (!selectedCategoryId || !categories.some((category) => category.id === selectedCategoryId)) {
      selectedCategoryId = categories[0]?.id || null;
    }

    const groupsHtml = groupNames
      .map((groupName) => {
        const groupCategories = categories.filter((category) => category.group === groupName);
        const collapsed = collapsedGroups.has(groupName);
        const rows = groupCategories
          .map((category) => {
            const count = getMapMarkers(currentMap.id).filter(
              (marker) => marker.categoryId === category.id
            ).length;
            const selectedClass = category.id === selectedCategoryId ? " is-selected" : "";
            return `<div class="category-channel admin-category-channel${selectedClass}">
              <button type="button" class="admin-category-main-btn" data-category-id="${category.id}">
                <div class="filter-item">
                  <label>
                    <span style="color:${category?.color || "#9ca3af"}">●</span> # ${category.name}
                  </label>
                  <span class="count">${count}</span>
                </div>
              </button>
              <button type="button" class="admin-category-edit-btn" data-edit-category-id="${category.id}" title="Edytuj typ">
                ✎
              </button>
            </div>`;
          })
          .join("");
        return `
          <details class="group admin-group" data-group-name="${groupName}" ${collapsed ? "" : "open"}>
            <summary>
              <div class="admin-group-summary">
                <span>${groupName}</span>
                <button type="button" class="admin-group-add" data-add-type="${groupName}">+</button>
              </div>
            </summary>
            <div class="group__body">${rows || '<div class="marker-empty">Brak typow</div>'}</div>
          </details>
        `;
      })
      .join("");

    channelTree.innerHTML = `<div class="admin-channel-tree">${groupsHtml}</div>`;

    channelTree.querySelectorAll("details.admin-group").forEach((detailsEl) => {
      detailsEl.addEventListener("toggle", () => {
        const group = detailsEl.dataset.groupName;
        if (!group) return;
        if (detailsEl.open) collapsedGroups.delete(group);
        else collapsedGroups.add(group);
      });
    });

    channelTree.querySelectorAll("[data-add-type]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const group = button.dataset.addType;
        const typeName = window.prompt(`Nazwa typu znacznika dla kategorii "${group}":`);
        if (!typeName || !typeName.trim()) return;
        try {
          await apiJson("/api/admin/categories", "POST", {
            gameId: currentMap.gameId,
            name: typeName.trim(),
            group,
            color: "#9ca3af"
          });
          await refreshData(currentMap.id);
          setStatus(`Dodano typ znacznika: ${typeName.trim()}`);
        } catch (error) {
          setStatus(`Blad dodawania typu: ${error.message}`, true);
        }
      });
    });

    channelTree.querySelectorAll("[data-category-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCategoryId = button.dataset.categoryId;
        renderCategoryPicker();
      });
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        pendingCategoryDrag = {
          categoryId: button.dataset.categoryId,
          startX: event.clientX,
          startY: event.clientY
        };
      });
    });

    channelTree.querySelectorAll("[data-edit-category-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedCategoryId = button.dataset.editCategoryId;
        renderCategoryPicker();
        openCategoryEditorModal(selectedCategoryId);
      });
    });
  }

  function clearMarkerLayers() {
    markerLayerById.forEach((layer) => map.removeLayer(layer));
    markerLayerById = new Map();
    setTrashHover(false);
  }

  function beginMarkerGroupDrag(anchorId) {
    if (!currentMap) return;
    const ids =
      selectedMarkerIds.has(anchorId) && selectedMarkerIds.size > 1
        ? [...selectedMarkerIds]
        : [anchorId];
    selectedMarkerIds = new Set(ids);
    updateSelectedMarkerVisuals();
    const startById = new Map();
    for (const id of ids) {
      const layer = markerLayerById.get(id);
      if (layer) startById.set(id, layer.getLatLng());
    }
    markerDragContext = {
      mapId: currentMap.id,
      anchorId,
      anchorStart: startById.get(anchorId),
      ids,
      startById
    };
  }

  function updateMarkerGroupDrag(anchorId) {
    if (!markerDragContext || markerDragContext.anchorId !== anchorId) return;
    const anchorLayer = markerLayerById.get(anchorId);
    if (!anchorLayer) return;
    const current = anchorLayer.getLatLng();
    const deltaLat = current.lat - markerDragContext.anchorStart.lat;
    const deltaLng = current.lng - markerDragContext.anchorStart.lng;

    for (const id of markerDragContext.ids) {
      if (id === anchorId) continue;
      const layer = markerLayerById.get(id);
      const start = markerDragContext.startById.get(id);
      if (!layer || !start) continue;
      layer.setLatLng([start.lat + deltaLat, start.lng + deltaLng]);
    }
    const clientPos = mapClientFromLatLng(current);
    setTrashHover(isOverTrash(clientPos.x, clientPos.y));
  }

  async function finishMarkerGroupDrag(anchorId) {
    if (!markerDragContext || markerDragContext.anchorId !== anchorId) return;
    const ctx = markerDragContext;
    markerDragContext = null;
    const anchorLayer = markerLayerById.get(anchorId);
    if (!anchorLayer) return;

    const before = clone(getMapMarkers(ctx.mapId));
    const anchorClient = mapClientFromLatLng(anchorLayer.getLatLng());
    const shouldDelete = isOverTrash(anchorClient.x, anchorClient.y);
    const idsSet = new Set(ctx.ids);
    let after;
    let label;

    if (shouldDelete) {
      after = before.filter((marker) => !idsSet.has(marker.id));
      label = `Usunieto ${ctx.ids.length} znacznik(i)`;
      selectedMarkerIds.clear();
    } else {
      after = before.map((marker) => {
        if (!idsSet.has(marker.id)) return marker;
        const layer = markerLayerById.get(marker.id);
        if (!layer) return marker;
        const latLng = layer.getLatLng();
        return { ...marker, x: latLng.lng, y: latLng.lat };
      });
      label = `Przesunieto ${ctx.ids.length} znacznik(i)`;
    }

    try {
      await replaceMapMarkers(ctx.mapId, after);
      await refreshData(ctx.mapId);
      recordHistory(ctx.mapId, before, after, label);
      setStatus(label);
    } catch (error) {
      setStatus(`Blad podczas drag&drop: ${error.message}`, true);
      await refreshData(ctx.mapId);
    } finally {
      setTrashHover(false);
    }
  }

  function drawMapMarkers() {
    clearMarkerLayers();
    if (!currentMap) return;

    const markers = getMapMarkers(currentMap.id);
    for (const marker of markers) {
      const category = categoryById(marker.categoryId);
      const layer = L.marker([marker.y, marker.x], { draggable: true, icon: makeMarkerIcon(marker, category) }).bindPopup(
        `<strong>${marker.name}</strong><br/><small>${category?.name || "Unknown"}</small><br/>X: ${marker.x.toFixed(
          2
        )}, Y: ${marker.y.toFixed(2)}`
      );
      layer.markerId = marker.id;
      layer.on("dragstart", () => {
        beginMarkerGroupDrag(marker.id);
      });
      layer.on("drag", () => {
        updateMarkerGroupDrag(marker.id);
      });
      layer.on("dragend", async () => {
        await finishMarkerGroupDrag(marker.id);
      });
      layer.addTo(map);
      markerLayerById.set(marker.id, layer);
    }
    updateSelectedMarkerVisuals();
    legend.innerHTML = `<strong>Mapa:</strong> ${currentMap.name}<br/><strong>Znaczniki:</strong> ${markers.length}`;
  }

  function activateMap(mapId) {
    currentMap = state.maps.find((item) => item.id === mapId) || null;
    selectedMarkerIds.clear();
    markerDragContext = null;
    placingMarkerId = null;
    document.getElementById("admin-place-marker-btn").classList.remove("active");
    closeCategoryEditorModal();
    if (!currentMap) return;
    mapSelect.value = currentMap.id;
    markerSizePercentInput.value = String(normalizedMarkerScalePercent(currentMap.markerScalePercent));
    setOverlayForMap(currentMap);
    drawMapMarkers();
    renderSelectors();
    renderCategoryPicker();
  }

  function startSelectionBox(event) {
    const rect = mapContainer.getBoundingClientRect();
    selectionState = {
      startX: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      startY: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
      rect
    };
    selectionBox.style.display = "block";
    selectionBox.style.left = `${selectionState.startX}px`;
    selectionBox.style.top = `${selectionState.startY}px`;
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
    map.dragging.disable();
  }

  function updateSelectionBox(event) {
    if (!selectionState) return;
    const x = Math.max(0, Math.min(selectionState.rect.width, event.clientX - selectionState.rect.left));
    const y = Math.max(0, Math.min(selectionState.rect.height, event.clientY - selectionState.rect.top));
    const left = Math.min(selectionState.startX, x);
    const top = Math.min(selectionState.startY, y);
    const width = Math.abs(selectionState.startX - x);
    const height = Math.abs(selectionState.startY - y);
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
  }

  function endSelectionBox(event) {
    if (!selectionState) return;
    const x = Math.max(0, Math.min(selectionState.rect.width, event.clientX - selectionState.rect.left));
    const y = Math.max(0, Math.min(selectionState.rect.height, event.clientY - selectionState.rect.top));
    const left = Math.min(selectionState.startX, x);
    const right = Math.max(selectionState.startX, x);
    const top = Math.min(selectionState.startY, y);
    const bottom = Math.max(selectionState.startY, y);

    const northWest = map.containerPointToLatLng(L.point(left, top));
    const southEast = map.containerPointToLatLng(L.point(right, bottom));
    const minLat = Math.min(northWest.lat, southEast.lat);
    const maxLat = Math.max(northWest.lat, southEast.lat);
    const minLng = Math.min(northWest.lng, southEast.lng);
    const maxLng = Math.max(northWest.lng, southEast.lng);

    const selectedIds = [];
    markerLayerById.forEach((layer, markerId) => {
      const latLng = layer.getLatLng();
      if (latLng.lat >= minLat && latLng.lat <= maxLat && latLng.lng >= minLng && latLng.lng <= maxLng) {
        selectedIds.push(markerId);
      }
    });
    selectedMarkerIds = new Set(selectedIds);
    updateSelectedMarkerVisuals();
    selectionBox.style.display = "none";
    selectionState = null;
    map.dragging.enable();
    setStatus(`Zaznaczono ${selectedIds.length} znacznik(i).`);
  }

  async function dropCategoryOnMap(categoryId, clientX, clientY) {
    if (!currentMap) return false;
    const rect = mapContainer.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return false;
    }
    const category = categoryById(categoryId);
    if (!category) return false;

    const before = clone(getMapMarkers(currentMap.id));
    const mapPoint = L.point(clientX - rect.left, clientY - rect.top);
    const latLng = map.containerPointToLatLng(mapPoint);
    const count = before.filter((marker) => marker.categoryId === categoryId).length;

    await apiJson("/api/admin/markers", "POST", {
      mapId: currentMap.id,
      categoryId,
      name: `${category.name} ${count + 1}`,
      note: "Added via drag and drop",
      x: latLng.lng,
      y: latLng.lat
    });
    await refreshData(currentMap.id);
    const after = clone(getMapMarkers(currentMap.id));
    recordHistory(currentMap.id, before, after, `Dodano znacznik ${category.name}`);
    setStatus(`Dodano znacznik: ${category.name}`);
    return true;
  }

  mapSelect.addEventListener("change", (event) => activateMap(event.target.value));
  categoryModalCloseBtn.addEventListener("click", () => {
    closeCategoryEditorModal();
  });
  categoryModal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-category-modal")) {
      closeCategoryEditorModal();
    }
  });

  deleteMapBtn.addEventListener("click", async () => {
    if (!currentMap) return;
    const confirmed = window.confirm(`Usunac mape "${currentMap.name}" i wszystkie jej znaczniki?`);
    if (!confirmed) return;
    try {
      const deletedMapId = currentMap.id;
      const deletedGameId = currentMap.gameId;
      await apiJson(`/api/admin/maps/${deletedMapId}`, "DELETE");
      const fresh = await apiJson("/api/map-data");
      const remainingInGame = (fresh.maps || []).filter((entry) => entry.gameId === deletedGameId);
      if (remainingInGame.length) {
        window.location.href = `/admin/map?map=${remainingInGame[0].id}`;
        return;
      }
      window.location.href = `/admin/game?game=${deletedGameId}`;
    } catch (error) {
      setStatus(`Blad usuwania mapy: ${error.message}`, true);
    }
  });

  saveMarkerSizeBtn.addEventListener("click", async () => {
    try {
      if (!currentMap) throw new Error("Wybierz mape");
      const markerScalePercent = normalizedMarkerScalePercent(markerSizePercentInput.value);
      await apiJson(`/api/admin/maps/${currentMap.id}`, "PATCH", { markerScalePercent });
      await refreshData(currentMap.id);
      setStatus(`Skala znacznika zapisana: ${markerScalePercent}%`);
    } catch (error) {
      setStatus(`Blad zapisu skali: ${error.message}`, true);
    }
  });

  mapContainer.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.ctrlKey) return;
    event.preventDefault();
    startSelectionBox(event);
  });

  document.addEventListener("pointermove", (event) => {
    updateSelectionBox(event);

    if (pendingCategoryDrag && !activeCategoryDrag) {
      const dx = Math.abs(event.clientX - pendingCategoryDrag.startX);
      const dy = Math.abs(event.clientY - pendingCategoryDrag.startY);
      if (dx + dy > 6) {
        const category = categoryById(pendingCategoryDrag.categoryId);
        activeCategoryDrag = { categoryId: pendingCategoryDrag.categoryId };
        setDragGhostColor(category?.color);
        setDragGhostPosition(event.clientX, event.clientY);
        dragGhost.style.display = "block";
        mapContainer.classList.add("map-drop-active");
      }
    }
    if (activeCategoryDrag) {
      setDragGhostPosition(event.clientX, event.clientY);
      setTrashHover(isOverTrash(event.clientX, event.clientY));
    }
  });

  document.addEventListener("pointerup", async (event) => {
    if (selectionState) {
      endSelectionBox(event);
    }

    if (!pendingCategoryDrag && !activeCategoryDrag) return;
    const dragCategoryId = (activeCategoryDrag || pendingCategoryDrag).categoryId;
    pendingCategoryDrag = null;
    if (activeCategoryDrag) {
      try {
        await dropCategoryOnMap(dragCategoryId, event.clientX, event.clientY);
      } catch (error) {
        setStatus(`Blad drag&drop: ${error.message}`, true);
      }
    }
    activeCategoryDrag = null;
    dragGhost.style.display = "none";
    mapContainer.classList.remove("map-drop-active");
    setTrashHover(false);
  });

  document.addEventListener("keydown", async (event) => {
    if (event.key === "Escape" && !categoryModal.classList.contains("hidden")) {
      closeCategoryEditorModal();
      return;
    }
    if (!event.ctrlKey || event.key.toLowerCase() !== "z") return;
    event.preventDefault();
    try {
      if (event.shiftKey) {
        await redoAction();
      } else {
        await undoAction();
      }
    } catch (error) {
      setStatus(`Blad historii: ${error.message}`, true);
    }
  });

  document.getElementById("admin-set-map-image-btn").addEventListener("click", async () => {
    try {
      if (!currentMap) throw new Error("Wybierz mape");
      const file = document.getElementById("admin-map-image-file").files[0];
      if (!file) throw new Error("Wybierz plik");
      const url = await uploadImage(file, "map");
      await apiJson(`/api/admin/maps/${currentMap.id}`, "PATCH", { baseImageUrl: url });
      await refreshData(currentMap.id);
      setStatus("Grafika bazowa mapy ustawiona.");
    } catch (error) {
      setStatus(`Blad: ${error.message}`, true);
    }
  });

  document.getElementById("admin-add-group-btn").addEventListener("click", async () => {
    try {
      if (!currentMap) throw new Error("Wybierz mape");
      const categoryName = window.prompt("Nazwa kategorii:");
      if (!categoryName || !categoryName.trim()) return;
      await apiJson("/api/admin/category-groups", "POST", {
        gameId: currentMap.gameId,
        name: categoryName.trim()
      });
      await refreshData(currentMap.id);
      setStatus(`Dodano kategorie: ${categoryName.trim()}`);
    } catch (error) {
      setStatus(`Blad: ${error.message}`, true);
    }
  });

  categorySaveBtn.addEventListener("click", async () => {
    try {
      if (!currentMap || !selectedCategoryId) throw new Error("Wybierz typ znacznika");
      const category = categoryById(selectedCategoryId);
      if (!category) throw new Error("Nie znaleziono typu znacznika");
      const nextName = categoryNameInput.value.trim();
      if (!nextName) throw new Error("Nazwa typu nie moze byc pusta");
      const nextColor = categoryColorInput.value || "#9ca3af";
      const iconFile = categoryIconFileInput.files[0];
      let uploadedIconUrl = "";

      if (iconFile) {
        uploadedIconUrl = await uploadImage(iconFile, "marker");
      }

      await apiJson(`/api/admin/categories/${category.id}`, "PATCH", {
        name: nextName,
        color: nextColor,
        ...(uploadedIconUrl ? { iconUrl: uploadedIconUrl } : {})
      });

      if (uploadedIconUrl) {
        const before = clone(getMapMarkers(currentMap.id));
        const after = before.map((marker) =>
          marker.categoryId === category.id ? { ...marker, iconUrl: uploadedIconUrl } : marker
        );
        await replaceMapMarkers(currentMap.id, after);
        recordHistory(currentMap.id, before, after, `Zmieniono ikony typu ${nextName}`);
        categoryIconFileInput.value = "";
      }

      await refreshData(currentMap.id);
      setStatus(`Zapisano typ znacznika: ${nextName}`);
    } catch (error) {
      setStatus(`Blad edycji typu: ${error.message}`, true);
    }
  });

  categoryDeleteBtn.addEventListener("click", async () => {
    try {
      if (!currentMap || !selectedCategoryId) throw new Error("Wybierz typ znacznika");
      const category = categoryById(selectedCategoryId);
      if (!category) throw new Error("Nie znaleziono typu znacznika");
      const confirmed = window.confirm(
        `Usunac typ "${category.name}"? To usunie wszystkie przypisane znaczniki na wszystkich mapach tej gry.`
      );
      if (!confirmed) return;
      await apiJson(`/api/admin/categories/${category.id}`, "DELETE");
      selectedCategoryId = null;
      await refreshData(currentMap.id);
      setStatus(`Usunieto typ znacznika: ${category.name}`);
      closeCategoryEditorModal();
    } catch (error) {
      setStatus(`Blad usuwania typu: ${error.message}`, true);
    }
  });

  document.getElementById("admin-set-marker-image-btn").addEventListener("click", async () => {
    try {
      const markerId = document.getElementById("admin-marker-select").value;
      const file = document.getElementById("admin-marker-image-file").files[0];
      if (!markerId || !file) throw new Error("Wybierz znacznik i plik");
      await apiJson(`/api/admin/markers/${markerId}`, "PATCH", { iconUrl: await uploadImage(file, "marker") });
      await refreshData(currentMap.id);
      setStatus("Grafika znacznika ustawiona.");
    } catch (error) {
      setStatus(`Blad: ${error.message}`, true);
    }
  });

  document.getElementById("admin-place-marker-btn").addEventListener("click", () => {
    const markerId = document.getElementById("admin-marker-select").value;
    if (!markerId) {
      setStatus("Wybierz znacznik.", true);
      return;
    }
    placingMarkerId = markerId;
    document.getElementById("admin-place-marker-btn").classList.add("active");
    setStatus("Kliknij na mapie aby ustawic pozycje znacznika.");
  });

  map.on("click", async (event) => {
    if (!placingMarkerId || !currentMap) return;
    const before = clone(getMapMarkers(currentMap.id));
    try {
      await apiJson(`/api/admin/markers/${placingMarkerId}`, "PATCH", {
        x: event.latlng.lng,
        y: event.latlng.lat
      });
      await refreshData(currentMap.id);
      const after = clone(getMapMarkers(currentMap.id));
      recordHistory(currentMap.id, before, after, "Przeniesiono znacznik kliknieciem");
      setStatus("Pozycja znacznika zapisana.");
    } catch (error) {
      setStatus(`Blad: ${error.message}`, true);
    } finally {
      placingMarkerId = null;
      document.getElementById("admin-place-marker-btn").classList.remove("active");
    }
  });

  await refreshData(initialMapIdFromQuery);
}

initAdminPage().catch((error) => {
  const statusEl = document.getElementById("admin-status");
  statusEl.textContent = `Blad ladowania panelu: ${error.message}`;
  statusEl.classList.add("danger");
});
