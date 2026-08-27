#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

if [[ ! -d ".venv" ]]; then
  python -m venv .venv
fi

PYTHON=".venv/bin/python"

"${PYTHON}" -m pip install --upgrade pip
"${PYTHON}" -m pip install -r requirements.txt pyinstaller
"${PYTHON}" -m PyInstaller --noconfirm --clean desktop.spec

if ! command -v appimagetool >/dev/null 2>&1; then
  echo "Brak appimagetool w PATH."
  echo "Zainstaluj appimagetool i uruchom skrypt ponownie."
  echo "Np. pobierz z: https://github.com/AppImage/appimagetool/releases"
  exit 1
fi

APPDIR="${ROOT_DIR}/build/AppDir"
rm -rf "${APPDIR}"
mkdir -p "${APPDIR}/usr/bin"

cp "${ROOT_DIR}/dist/interactive-maps" "${APPDIR}/usr/bin/interactive-maps"
cp "${ROOT_DIR}/assets/icon.svg" "${APPDIR}/interactive-maps.svg"

cat > "${APPDIR}/interactive-maps.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Interactive Maps
Exec=interactive-maps
Icon=interactive-maps
Categories=Game;Utility;
Terminal=false
EOF

cat > "${APPDIR}/AppRun" <<'EOF'
#!/usr/bin/env bash
HERE="$(cd "$(dirname "$0")" && pwd)"
exec "${HERE}/usr/bin/interactive-maps" "$@"
EOF
chmod +x "${APPDIR}/AppRun"
chmod +x "${APPDIR}/usr/bin/interactive-maps"

ARCH="$(uname -m)"
OUTPUT_NAME="interactive-maps-${ARCH}.AppImage"
appimagetool "${APPDIR}" "${ROOT_DIR}/dist/${OUTPUT_NAME}"

echo ""
echo "Build zakonczony."
echo "Plik AppImage: dist/${OUTPUT_NAME}"
