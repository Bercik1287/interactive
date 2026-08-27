# Aplikacja Map Interaktywnych (Python MVP)

Prototyp aplikacji do tworzenia i przegladania interaktywnych map gier.
Frontend dziala jako aplikacja webowa oraz desktopowa offline, a backend opiera sie o Python (Flask).

## Funkcje

- zoom + pan mapy
- wiele map i regionow w ramach wielu gier
- markery z popupami
- pelny podzial na kategorie i grupy znacznikow
- filtrowanie punktow (przyciski typow)
- Show All / Hide All
- wyszukiwarka punktow i typow
- tryb administracyjny:
  - dodaj gre
  - dodaj mape
  - ustaw grafike bazowa mapy
  - dodaj nowa kategorie
  - dodaj nowy znacznik
  - ustaw grafike znacznika
  - ustaw pozycje znacznika kliknieciem na mapie

## Uruchomienie lokalne

### Najpewniejsza metoda (bez aktywacji venv)

W katalogu projektu:

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

### Aktywacja venv (opcjonalnie)

- `bash` / `zsh`:
  ```bash
  source .venv/bin/activate
  ```
- `fish`:
  ```fish
  source .venv/bin/activate.fish
  ```

Potem otworz:

- strona glowna: `http://127.0.0.1:4173`
- strona mapy: `http://127.0.0.1:4173/map`
- panel administracyjny (gry): `http://127.0.0.1:4173/admin`
- panel administracyjny (mapy gry): `http://127.0.0.1:4173/admin/game?game=<gameId>`
- panel administracyjny (edycja mapy): `http://127.0.0.1:4173/admin/map?map=<mapId>`

## Tryb desktop (offline)

Po instalacji zaleznosci uruchom:

```bash
.venv/bin/python desktop.py
```

Aplikacja uruchomi lokalny serwer Flask w tle i otworzy natywne okno desktopowe (Qt WebEngine, bez przegladarki).
Wszystkie dane (`data.json`, `uploads/`) sa zapisywane lokalnie.

### Build dla Windows (`.exe`)

Uruchom na Windows (PowerShell):

```powershell
.\build-windows.ps1
```

Wynik:

- `dist\interactive-maps.exe`

### Build dla Linux (`.AppImage`)

Uruchom na Linux:

```bash
./build-linux-appimage.sh
```

Wymagane narzedzie:

- `appimagetool` w `PATH` (skrypt wypisze instrukcje, jesli go brak)

Wynik:

- `dist/interactive-maps-<arch>.AppImage`

### Ważne ograniczenie

Buildy musza byc wykonywane na docelowym systemie:

- `.exe` buduj na Windows
- `.AppImage` buduj na Linux

Cross-build z jednego systemu na drugi nie jest tutaj wspierany.

## Struktura danych

- `map_data.py` - dane seed (startowy zestaw map/kategorii/markerow)
- `data_store.py` - trwale przechowywanie danych (`data.json`)
- `app.py` - endpointy Flask (publiczne + administracyjne + upload obrazow)
- `home.html` + `home.js` - strona glowna z lista gier
- `map.html` + `app.js` - strona mapy z wysuwanym menu znacznikow
- `admin_home.html` + `admin_home.js` - admin strona gier (+ dodawanie gry)
- `admin_game.html` + `admin_game.js` - admin strona map gry (+ dodawanie mapy)
- `admin.js` - frontend panelu administracyjnego
- `admin.html` - admin edycja mapy (jak obecnie)

## Uwagi

- Aktualnie tlo mapy to placeholder SVG, latwo je podmienic na docelowe obrazy map.
- Markery sa automatycznie wygenerowane na podstawie liczebnosci kategorii dla kazdej mapy.
- Domyslny seed danych to przykladowy zestaw, ktory mozna dowolnie edytowac w panelu admina.
- Uploadowane grafiki sa zapisywane w katalogu `uploads/`.
- W wersjach spakowanych (`exe`/`AppImage`) dane sa zapisywane w katalogu `~/.interactive-maps`.
