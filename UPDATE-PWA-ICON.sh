#!/usr/bin/env bash
# Troca ícone PWA pelo Bootstrap Icon grid-1x2-fill e republica
# Uso (root): bash /development/multgesti-top-home/UPDATE-PWA-ICON.sh
set -euo pipefail

ROOT="/development/multgesti-top-home"
WEB="/var/www/multigesti"
ICON_DIR="$ROOT/public/icons"

mkdir -p "$ICON_DIR"

echo "==> Gerando ícones PWA (Bootstrap Icons: bi-grid-1x2-fill)..."
python3 - << 'PY'
import gi
gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf
from pathlib import Path

# Bootstrap Icons 1.11 — grid-1x2-fill (visão de módulos/dashboard)
ICON_PATH = (
    "M0 1a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1z"
    "m9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z"
    "m0 9a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z"
)

out_dir = Path("/development/multgesti-top-home/public/icons")
out_dir.mkdir(parents=True, exist_ok=True)

def make_svg(size: int) -> str:
    # padding ~18% — ícone branco sobre fundo theme Bootstrap primary
    pad = size * 0.18
    inner = size - 2 * pad
    scale = inner / 16.0
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <rect width="{size}" height="{size}" rx="{size * 0.22:.1f}" ry="{size * 0.22:.1f}" fill="#0d6efd"/>
  <g fill="#ffffff" transform="translate({pad:.2f},{pad:.2f}) scale({scale:.6f})">
    <path d="{ICON_PATH}"/>
  </g>
</svg>'''

targets = [
    (192, "pwa-192x192.png"),
    (512, "pwa-512x512.png"),
    (180, "apple-touch-icon.png"),
]

for size, name in targets:
    svg_path = Path(f"/tmp/{name}.svg")
    svg_path.write_text(make_svg(size), encoding="utf-8")
    pb = GdkPixbuf.Pixbuf.new_from_file_at_size(str(svg_path), size, size)
    out = out_dir / name
    pb.savev(str(out), "png", [], [])
    print(f"ok {name} {pb.get_width()}x{pb.get_height()}")

# também atualiza favicon público
logo = Path("/development/multgesti-top-home/public/pwa-icon.png")
pb512 = GdkPixbuf.Pixbuf.new_from_file(str(out_dir / "pwa-512x512.png"))
pb512.savev(str(logo), "png", [], [])
print(f"ok {logo.name}")
PY

echo "==> Ajustando favicon no index.html..."
python3 - << 'PY'
from pathlib import Path
path = Path("/development/multgesti-top-home/index.html")
text = path.read_text()
old = '<link rel="icon" type="image/svg+xml" href="/logo.png" />'
# com base /multigesti/ o build reescreve paths absolutos começando em / — usamos relativo ao site
new = '<link rel="icon" type="image/png" href="/multigesti/icons/pwa-192x192.png" />'
if "icons/pwa-192x192.png" in text:
    print("favicon já aponta para ícone PWA")
elif old in text:
    path.write_text(text.replace(old, new, 1))
    print("favicon atualizado")
else:
    # tenta variante já com /multigesti/
    old2 = '<link rel="icon" type="image/svg+xml" href="/multigesti/logo.png" />'
    if old2 in text:
        path.write_text(text.replace(old2, new, 1))
        print("favicon atualizado (variante multigesti)")
    else:
        print("aviso: link de favicon não encontrado no formato esperado")
PY

echo "==> Rebuild + publish..."
cd "$ROOT"
npm run build
mkdir -p "$WEB"
rsync -a --delete "$ROOT/dist/" "$WEB/"
chown -R www-data:www-data "$WEB"

nginx -t
systemctl reload nginx

echo
echo "OK — ícone PWA: Bootstrap bi-grid-1x2-fill (azul #0d6efd)."
echo "Recarregue https://tophc.com.br:1200/multigesti/ (Ctrl+Shift+R)."
echo "Se o app já estava instalado, desinstale e instale de novo para atualizar o ícone."
