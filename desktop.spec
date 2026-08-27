# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules

pyside_datas = collect_data_files("PySide6")
pyside_binaries = collect_dynamic_libs("PySide6")
pyside_hiddenimports = collect_submodules("PySide6")

a = Analysis(
    ["desktop.py"],
    pathex=[],
    binaries=pyside_binaries,
    datas=[
        ("home.html", "."),
        ("map.html", "."),
        ("admin.html", "."),
        ("admin_home.html", "."),
        ("admin_game.html", "."),
        ("index.html", "."),
        ("styles.css", "."),
        ("app.js", "."),
        ("home.js", "."),
        ("admin.js", "."),
        ("admin_home.js", "."),
        ("admin_game.js", "."),
    ]
    + pyside_datas,
    hiddenimports=pyside_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="interactive-maps",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
