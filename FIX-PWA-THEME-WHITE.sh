#!/usr/bin/env bash
# Deixa a barra superior do PWA branca (theme-color)
# Uso (root): bash /development/multgesti-top-home/FIX-PWA-THEME-WHITE.sh
set -euo pipefail

ROOT="/development/multgesti-top-home"
WEB="/var/www/multigesti"

cd "$ROOT"

python3 - << 'PY'
from pathlib import Path

# index.html
html = Path("/development/multgesti-top-home/index.html")
t = html.read_text()
t2 = t.replace('content="#0d6efd"', 'content="#ffffff"')
# iOS: default = status bar clara (branca) com texto escuro
t2 = t2.replace(
    'name="apple-mobile-web-app-status-bar-style" content="black"',
    'name="apple-mobile-web-app-status-bar-style" content="default"',
)
if 'content="#ffffff"' not in t2 or 'theme-color' not in t2:
    raise SystemExit("falha ao atualizar theme-color no index.html")
html.write_text(t2)
print("index.html: theme-color=#ffffff")

# vite.config.ts manifest
vite = Path("/development/multgesti-top-home/vite.config.ts")
v = vite.read_text()
if "theme_color: '#ffffff'" in v:
    print("vite.config.ts: já branco")
else:
    v2 = v.replace("theme_color: '#0d6efd'", "theme_color: '#ffffff'")
    if "theme_color: '#ffffff'" not in v2:
        raise SystemExit("theme_color não encontrado no vite.config.ts")
    vite.write_text(v2)
    print("vite.config.ts: theme_color=#ffffff")
PY

npm run build
rsync -a --delete "$ROOT/dist/" "$WEB/"
chown -R www-data:www-data "$WEB"

# confirma manifest publicado
grep -o '"theme_color":"[^"]*"' "$WEB/manifest.webmanifest" || true
grep -o 'theme-color" content="[^"]*"' "$WEB/index.html" || true

echo
echo "OK — barra do PWA branca."
echo "Hard refresh (Ctrl+Shift+R). Se o app estiver instalado, feche e abra de novo."
