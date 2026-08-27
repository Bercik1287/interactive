from pathlib import Path
import sys

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from data_store import DATA_DIR, load_data, new_id, save_data, slugify
from map_data import CATEGORY_GROUPS

if getattr(sys, "frozen", False):
    STATIC_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
else:
    STATIC_DIR = Path(__file__).resolve().parent

UPLOADS_DIR = DATA_DIR / "uploads"
app = Flask(__name__)
DEFAULT_MARKER_SCALE_PERCENT = 100


def normalize_marker_scale_percent(value) -> int:
    try:
        percent = int(float(value))
    except (TypeError, ValueError):
        percent = DEFAULT_MARKER_SCALE_PERCENT
    return max(10, min(400, percent))


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "home.html")


@app.get("/map")
def map_page():
    return send_from_directory(STATIC_DIR, "map.html")


@app.get("/admin")
def admin_page():
    return send_from_directory(STATIC_DIR, "admin_home.html")


@app.get("/admin/game")
def admin_game_page():
    return send_from_directory(STATIC_DIR, "admin_game.html")


@app.get("/admin/map")
def admin_map_page():
    return send_from_directory(STATIC_DIR, "admin.html")


@app.get("/api/map-data")
def map_data():
    data = load_data()
    return jsonify(
        {
            "categoryGroups": CATEGORY_GROUPS,
            "adminCategoryGroups": data.get("categoryGroupsByGame", {}),
            "games": data["games"],
            "maps": data["maps"],
            "categories": data["categories"],
            "markers": data["markers"],
        }
    )


@app.post("/api/admin/games")
def add_game():
    payload = request.get_json(force=True)
    name = (payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Game name is required"}), 400

    data = load_data()
    game = {
        "id": new_id("game"),
        "name": name,
        "slug": slugify(payload.get("slug") or name),
    }
    data["games"].append(game)
    data.setdefault("categoryGroupsByGame", {})
    data["categoryGroupsByGame"][game["id"]] = []
    save_data(data)
    return jsonify(game), 201


@app.post("/api/admin/maps")
def add_map():
    payload = request.get_json(force=True)
    game_id = payload.get("gameId")
    name = (payload.get("name") or "").strip()
    if not game_id or not name:
        return jsonify({"error": "gameId and name are required"}), 400

    data = load_data()
    if not any(game["id"] == game_id for game in data["games"]):
        return jsonify({"error": "gameId does not exist"}), 404

    map_entry = {
        "id": new_id("map"),
        "gameId": game_id,
        "name": name,
        "slug": slugify(payload.get("slug") or name),
        "baseImageUrl": payload.get("baseImageUrl", "").strip(),
        "markerScalePercent": normalize_marker_scale_percent(
            payload.get("markerScalePercent", DEFAULT_MARKER_SCALE_PERCENT)
        ),
    }
    data["maps"].append(map_entry)
    save_data(data)
    return jsonify(map_entry), 201


@app.patch("/api/admin/maps/<map_id>")
def patch_map(map_id: str):
    payload = request.get_json(force=True)
    data = load_data()
    map_entry = next((item for item in data["maps"] if item["id"] == map_id), None)
    if not map_entry:
        return jsonify({"error": "Map not found"}), 404

    if "name" in payload:
        map_entry["name"] = payload["name"].strip()
    if "slug" in payload:
        map_entry["slug"] = slugify(payload["slug"])
    if "baseImageUrl" in payload:
        map_entry["baseImageUrl"] = payload["baseImageUrl"].strip()
    if "markerScalePercent" in payload:
        map_entry["markerScalePercent"] = normalize_marker_scale_percent(payload["markerScalePercent"])
    save_data(data)
    return jsonify(map_entry)


@app.delete("/api/admin/maps/<map_id>")
def delete_map(map_id: str):
    data = load_data()
    map_entry = next((item for item in data["maps"] if item["id"] == map_id), None)
    if not map_entry:
        return jsonify({"error": "Map not found"}), 404

    data["maps"] = [item for item in data["maps"] if item["id"] != map_id]
    data["markers"] = [item for item in data["markers"] if item["mapId"] != map_id]
    save_data(data)
    return jsonify({"deleted": map_id})


@app.post("/api/admin/categories")
def add_category():
    payload = request.get_json(force=True)
    game_id = payload.get("gameId")
    name = (payload.get("name") or "").strip()
    if not game_id or not name:
        return jsonify({"error": "gameId and name are required"}), 400

    data = load_data()
    if not any(game["id"] == game_id for game in data["games"]):
        return jsonify({"error": "gameId does not exist"}), 404

    category = {
        "id": new_id("cat"),
        "gameId": game_id,
        "name": name,
        "group": (payload.get("group") or "Other").strip() or "Other",
        "color": (payload.get("color") or "#9ca3af").strip(),
        "iconUrl": (payload.get("iconUrl") or "").strip(),
    }
    data["categories"].append(category)
    data.setdefault("categoryGroupsByGame", {})
    groups = data["categoryGroupsByGame"].setdefault(game_id, [])
    if category["group"] not in groups:
        groups.append(category["group"])
    save_data(data)
    return jsonify(category), 201


@app.post("/api/admin/category-groups")
def add_category_group():
    payload = request.get_json(force=True)
    game_id = payload.get("gameId")
    name = (payload.get("name") or "").strip()
    if not game_id or not name:
        return jsonify({"error": "gameId and name are required"}), 400

    data = load_data()
    if not any(game["id"] == game_id for game in data["games"]):
        return jsonify({"error": "gameId does not exist"}), 404
    data.setdefault("categoryGroupsByGame", {})
    groups = data["categoryGroupsByGame"].setdefault(game_id, [])
    if name not in groups:
        groups.append(name)
    save_data(data)
    return jsonify({"gameId": game_id, "name": name}), 201


@app.patch("/api/admin/categories/<category_id>")
def patch_category(category_id: str):
    payload = request.get_json(force=True)
    data = load_data()
    category = next((item for item in data["categories"] if item["id"] == category_id), None)
    if not category:
        return jsonify({"error": "Category not found"}), 404

    for key in ("name", "group", "color", "iconUrl"):
        if key in payload:
            category[key] = (payload[key] or "").strip()
    save_data(data)
    return jsonify(category)


@app.delete("/api/admin/categories/<category_id>")
def delete_category(category_id: str):
    data = load_data()
    category = next((item for item in data["categories"] if item["id"] == category_id), None)
    if not category:
        return jsonify({"error": "Category not found"}), 404

    data["categories"] = [item for item in data["categories"] if item["id"] != category_id]
    data["markers"] = [item for item in data["markers"] if item["categoryId"] != category_id]

    game_id = category["gameId"]
    group_name = category["group"]
    still_has_group = any(
        item["gameId"] == game_id and item["group"] == group_name for item in data["categories"]
    )
    if not still_has_group:
        data.setdefault("categoryGroupsByGame", {})
        groups = data["categoryGroupsByGame"].get(game_id, [])
        data["categoryGroupsByGame"][game_id] = [name for name in groups if name != group_name]

    save_data(data)
    return jsonify({"deleted": category_id})


@app.post("/api/admin/markers")
def add_marker():
    payload = request.get_json(force=True)
    map_id = payload.get("mapId")
    category_id = payload.get("categoryId")
    name = (payload.get("name") or "").strip()
    if not map_id or not category_id or not name:
        return jsonify({"error": "mapId, categoryId and name are required"}), 400

    data = load_data()
    if not any(item["id"] == map_id for item in data["maps"]):
        return jsonify({"error": "Map not found"}), 404
    if not any(item["id"] == category_id for item in data["categories"]):
        return jsonify({"error": "Category not found"}), 404

    marker = {
        "id": new_id("marker"),
        "mapId": map_id,
        "categoryId": category_id,
        "name": name,
        "note": (payload.get("note") or "").strip(),
        "x": float(payload.get("x", 50)),
        "y": float(payload.get("y", 50)),
        "iconUrl": (payload.get("iconUrl") or "").strip(),
    }
    data["markers"].append(marker)
    save_data(data)
    return jsonify(marker), 201


@app.post("/api/admin/markers/bulk-replace")
def bulk_replace_markers():
    payload = request.get_json(force=True)
    map_id = payload.get("mapId")
    markers = payload.get("markers")
    if not map_id or not isinstance(markers, list):
        return jsonify({"error": "mapId and markers are required"}), 400

    data = load_data()
    if not any(item["id"] == map_id for item in data["maps"]):
        return jsonify({"error": "Map not found"}), 404

    existing_categories = {item["id"] for item in data["categories"]}
    normalized_markers = []
    for marker in markers:
        marker_id = (marker.get("id") or new_id("marker")).strip()
        category_id = (marker.get("categoryId") or "").strip()
        if not category_id or category_id not in existing_categories:
            return jsonify({"error": f"Invalid categoryId: {category_id}"}), 400
        normalized_markers.append(
            {
                "id": marker_id,
                "mapId": map_id,
                "categoryId": category_id,
                "name": (marker.get("name") or "Untitled").strip(),
                "note": (marker.get("note") or "").strip(),
                "x": float(marker.get("x", 50)),
                "y": float(marker.get("y", 50)),
                "iconUrl": (marker.get("iconUrl") or "").strip(),
            }
        )

    data["markers"] = [item for item in data["markers"] if item["mapId"] != map_id]
    data["markers"].extend(normalized_markers)
    save_data(data)
    return jsonify({"ok": True, "count": len(normalized_markers)})


@app.patch("/api/admin/markers/<marker_id>")
def patch_marker(marker_id: str):
    payload = request.get_json(force=True)
    data = load_data()
    marker = next((item for item in data["markers"] if item["id"] == marker_id), None)
    if not marker:
        return jsonify({"error": "Marker not found"}), 404

    for key in ("name", "note", "iconUrl", "categoryId"):
        if key in payload:
            marker[key] = (payload[key] or "").strip()
    for key in ("x", "y"):
        if key in payload:
            marker[key] = float(payload[key])
    save_data(data)
    return jsonify(marker)


@app.delete("/api/admin/markers/<marker_id>")
def delete_marker(marker_id: str):
    data = load_data()
    marker = next((item for item in data["markers"] if item["id"] == marker_id), None)
    if not marker:
        return jsonify({"error": "Marker not found"}), 404
    data["markers"] = [item for item in data["markers"] if item["id"] != marker_id]
    save_data(data)
    return jsonify({"deleted": marker_id})


@app.delete("/api/admin/games/<game_id>")
def delete_game(game_id: str):
    data = load_data()
    game = next((item for item in data["games"] if item["id"] == game_id), None)
    if not game:
        return jsonify({"error": "Game not found"}), 404

    map_ids = {item["id"] for item in data["maps"] if item["gameId"] == game_id}
    category_ids = {item["id"] for item in data["categories"] if item["gameId"] == game_id}

    data["games"] = [item for item in data["games"] if item["id"] != game_id]
    data["maps"] = [item for item in data["maps"] if item["gameId"] != game_id]
    data["categories"] = [item for item in data["categories"] if item["gameId"] != game_id]
    data["markers"] = [
        item
        for item in data["markers"]
        if item["mapId"] not in map_ids and item["categoryId"] not in category_ids
    ]
    data.setdefault("categoryGroupsByGame", {})
    data["categoryGroupsByGame"].pop(game_id, None)

    save_data(data)
    return jsonify({"deleted": game_id})


@app.post("/api/admin/upload-image")
def upload_image():
    file = request.files.get("file")
    kind = (request.form.get("kind") or "misc").strip().lower()
    if not file:
        return jsonify({"error": "Missing file"}), 400
    if kind not in {"map", "marker", "misc"}:
        kind = "misc"

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = secure_filename(file.filename or "upload.bin")
    target_name = f"{kind}-{new_id('file')}-{safe_name}"
    target_path = UPLOADS_DIR / target_name
    file.save(target_path)
    return jsonify({"url": f"/uploads/{target_name}"})


@app.get("/uploads/<path:filename>")
def uploaded_files(filename: str):
    return send_from_directory(UPLOADS_DIR, filename)


@app.get("/<path:filename>")
def static_files(filename: str):
    return send_from_directory(STATIC_DIR, filename)


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=4173)
