import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from map_data import CATEGORY_COLORS, CATEGORY_GROUPS, MAPS

DATA_FILE = Path(__file__).resolve().parent / "data.json"
DEFAULT_MARKER_SCALE_PERCENT = 100


def slugify(text: str) -> str:
    value = text.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "item"


def _seed_from_map_data() -> dict[str, Any]:
    game_id = "game-stellar-blade"
    maps = []
    categories = []
    markers = []

    category_name_to_id = {}
    for group_name, names in CATEGORY_GROUPS.items():
        for category_name in names:
            category_id = f"cat-{slugify(category_name)}"
            if category_name in category_name_to_id:
                continue
            category_name_to_id[category_name] = category_id
            categories.append(
                {
                    "id": category_id,
                    "gameId": game_id,
                    "name": category_name,
                    "group": group_name,
                    "color": CATEGORY_COLORS.get(category_name, "#9ca3af"),
                    "iconUrl": "",
                }
            )

    for map_entry in MAPS:
        map_id = f"map-{map_entry['slug']}"
        maps.append(
            {
                "id": map_id,
                "gameId": game_id,
                "name": map_entry["name"],
                "slug": map_entry["slug"],
                "baseImageUrl": "",
                "markerScalePercent": DEFAULT_MARKER_SCALE_PERCENT,
            }
        )
        for point in map_entry["points"]:
            category_id = category_name_to_id.get(point["type"])
            if not category_id:
                continue
            markers.append(
                {
                    "id": f"marker-{uuid4().hex[:10]}",
                    "mapId": map_id,
                    "categoryId": category_id,
                    "name": point["name"],
                    "note": point["note"],
                    "x": point["x"],
                    "y": point["y"],
                    "iconUrl": "",
                }
            )

    return {
        "games": [{"id": game_id, "name": "Demo Game", "slug": "demo-game"}],
        "maps": maps,
        "categories": categories,
        "markers": markers,
        "categoryGroupsByGame": {game_id: list(CATEGORY_GROUPS.keys())},
    }


def ensure_data_file() -> None:
    if DATA_FILE.exists():
        return
    DATA_FILE.write_text(
        json.dumps(_seed_from_map_data(), ensure_ascii=True, indent=2), encoding="utf-8"
    )


def load_data() -> dict[str, Any]:
    ensure_data_file()
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    if "categoryGroupsByGame" not in data or not isinstance(data["categoryGroupsByGame"], dict):
        data["categoryGroupsByGame"] = {}
    for game in data.get("games", []):
        game_id = game.get("id")
        if not game_id:
            continue
        groups = data["categoryGroupsByGame"].get(game_id)
        if not isinstance(groups, list):
            data["categoryGroupsByGame"][game_id] = []
    for map_entry in data.get("maps", []):
        value = map_entry.get("markerScalePercent", DEFAULT_MARKER_SCALE_PERCENT)
        try:
            percent = int(float(value))
        except (TypeError, ValueError):
            percent = DEFAULT_MARKER_SCALE_PERCENT
        map_entry["markerScalePercent"] = max(10, min(400, percent))
    return data


def save_data(data: dict[str, Any]) -> None:
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"
