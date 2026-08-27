# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ["desktop.py"],
    pathex=[],
    binaries=[],
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
    ],
    hiddenimports=[
        "webview.platforms.gtk",
        "webview.platforms.qt",
        "webview.platforms.edgechromium",
        "webview.platforms.mshtml",
    ],
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
