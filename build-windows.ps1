Param(
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".venv")) {
  py -m venv .venv
}

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  throw "Nie znaleziono interpretera .venv\Scripts\python.exe"
}

& $python -m pip install --upgrade pip
& $python -m pip install -r requirements.txt pyinstaller

if ($Clean) {
  Remove-Item -Recurse -Force build, dist -ErrorAction SilentlyContinue
}

& $python -m PyInstaller --noconfirm --clean desktop.spec

Write-Host ""
Write-Host "Build zakonczony."
Write-Host "Plik EXE: dist\interactive-maps.exe"
