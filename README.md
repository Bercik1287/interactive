# Aplikacja Map Interaktywnych (Python MVP)

Prototyp aplikacji do tworzenia i przegladania interaktywnych map gier.
Frontend dziala w przegladarce, a aplikacja jest uruchamiana na backendzie Python (Flask).

## Funkcje

- zoom + pan mapy
- wiele map i regionow w ramach wielu gier
- markery z popupami
- pelny podzial na kategorie i grupy znacznikow
- filtrowanie punktow (checkboxy)
- Show All / Hide All
- wyszukiwarka punktow i typow
- Distance Tool (pomiar odleglosci)
- Sniping Radius Tool (koncentryczne promienie)
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
