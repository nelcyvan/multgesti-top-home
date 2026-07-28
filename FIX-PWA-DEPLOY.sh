#!/usr/bin/env bash
# Publica PWA Multgest-i: ícones corretos + rsync + nginx
# Uso (root): bash /development/multgesti-top-home/FIX-PWA-DEPLOY.sh
set -euo pipefail

ROOT="/development/multgesti-top-home"
WEB="/var/www/multigesti"
NGINX="/etc/nginx/sites-available/default"

cd "$ROOT"

echo "==> Gerando ícones 192/512 (PNG puro, sem sharp/PIL)..."
python3 - << 'PY'
import struct, zlib
from pathlib import Path

def read_png(path: Path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"não é PNG: {path}"
    pos = 8
    width = height = None
    idat = b""
    color_type = bit_depth = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos+4])[0]
        ctype = data[pos+4:pos+8]
        cdata = data[pos+8:pos+8+length]
        pos += 12 + length
        if ctype == b"IHDR":
            width, height, bit_depth, color_type, *_ = struct.unpack(">IIBBBBB", cdata)
        elif ctype == b"IDAT":
            idat += cdata
        elif ctype == b"IEND":
            break
    if width is None:
        raise SystemExit("IHDR ausente")
    if bit_depth != 8 or color_type not in (2, 6):
        raise SystemExit(f"PNG não suportado depth={bit_depth} type={color_type}")
    raw = zlib.decompress(idat)
    bpp = 4 if color_type == 6 else 3
    stride = width * bpp
    rows = []
    i = 0
    prev = bytearray(stride)
    for _ in range(height):
        filt = raw[i]
        i += 1
        row = bytearray(raw[i:i+stride])
        i += stride
        if filt == 0:
            pass
        elif filt == 1:  # Sub
            for x in range(stride):
                left = row[x-bpp] if x >= bpp else 0
                row[x] = (row[x] + left) & 255
        elif filt == 2:  # Up
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif filt == 3:  # Average
            for x in range(stride):
                left = row[x-bpp] if x >= bpp else 0
                row[x] = (row[x] + ((left + prev[x]) // 2)) & 255
        elif filt == 4:  # Paeth
            def paeth(a, b, c):
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                if pa <= pb and pa <= pc: return a
                if pb <= pc: return b
                return c
            for x in range(stride):
                a = row[x-bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x-bpp] if x >= bpp else 0
                row[x] = (row[x] + paeth(a, b, c)) & 255
        else:
            raise SystemExit(f"filtro PNG {filt} não suportado")
        if bpp == 3:
            rgba = bytearray()
            for x in range(0, stride, 3):
                rgba += row[x:x+3] + b"\xff"
            rows.append(rgba)
            prev = bytearray(row)
        else:
            rows.append(row)
            prev = bytearray(row)
    return width, height, rows

def write_png(path: Path, width: int, height: int, rows):
    def chunk(tag, payload):
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)

def fit_square(src_w, src_h, rows, size, bg=(255, 255, 255, 255)):
    # scale contain
    scale = min(size / src_w, size / src_h)
    nw, nh = max(1, int(src_w * scale)), max(1, int(src_h * scale))
    ox, oy = (size - nw) // 2, (size - nh) // 2
    out = [bytearray(bg[0:1] * 0) for _ in range(size)]  # placeholder
    out = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            if ox <= x < ox + nw and oy <= y < oy + nh:
                sx = int((x - ox) * src_w / nw)
                sy = int((y - oy) * src_h / nh)
                sx = min(src_w - 1, max(0, sx))
                sy = min(src_h - 1, max(0, sy))
                row += rows[sy][sx*4:(sx+1)*4]
            else:
                row += bytes(bg)
        out.append(row)
    return out

src = Path("/development/multgesti-top-home/public/logo.png")
w, h, rows = read_png(src)
out_dir = Path("/development/multgesti-top-home/public/icons")
out_dir.mkdir(parents=True, exist_ok=True)
for size, name in [(192, "pwa-192x192.png"), (512, "pwa-512x512.png"), (180, "apple-touch-icon.png")]:
    fitted = fit_square(w, h, rows, size)
    write_png(out_dir / name, size, size, fitted)
    print(f"gerado {name} {size}x{size}")
PY

echo "==> Rebuild..."
npm run build

echo "==> Publicando em $WEB ..."
mkdir -p "$WEB"
rsync -a --delete "$ROOT/dist/" "$WEB/"
chown -R www-data:www-data "$WEB"

echo "==> Ajustando Nginx (sw.js / manifest / workbox)..."
python3 - << 'PY'
from pathlib import Path
path = Path("/etc/nginx/sites-available/default")
text = path.read_text()
block = '''
    location = /multigesti/sw.js {
        alias /var/www/multigesti/sw.js;
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/multigesti/";
        default_type application/javascript;
    }

    location ~ ^/multigesti/(workbox-.*\\.js)$ {
        alias /var/www/multigesti/$1;
        add_header Cache-Control "no-cache";
        default_type application/javascript;
    }

    location = /multigesti/manifest.webmanifest {
        alias /var/www/multigesti/manifest.webmanifest;
        add_header Cache-Control "no-cache";
        default_type application/manifest+json;
    }

'''
marker = "    # ---------- Multgest-i (frontend) ----------\n"
if "location = /multigesti/sw.js" in text:
    print("nginx: locations PWA já existem")
elif marker not in text:
    raise SystemExit("marker Multgest-i não encontrado no nginx")
else:
    path.write_text(text.replace(marker, block + marker, 1))
    print("nginx: locations PWA inseridas")
PY

nginx -t
systemctl reload nginx

echo "==> Verificando URLs..."
curl -sk --resolve tophc.com.br:443:127.0.0.1 -o /tmp/m.webmanifest -w 'manifest:%{http_code} ctype:%{content_type}\n' https://tophc.com.br/multigesti/manifest.webmanifest
curl -sk --resolve tophc.com.br:443:127.0.0.1 -o /tmp/sw.js -w 'sw:%{http_code} ctype:%{content_type}\n' https://tophc.com.br/multigesti/sw.js
head -c 80 /tmp/m.webmanifest; echo
head -c 80 /tmp/sw.js; echo
ls -la "$WEB" | head -20

echo
echo "OK. Abra https://tophc.com.br:1200/multigesti/ (porta pública NAT),"
echo "DevTools → Application → Manifest / Service Workers."
echo "Chrome: ícone instalar na barra, ou menu → Instalar Multgest-i."
