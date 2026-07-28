#!/usr/bin/env bash
# Corrige links sem /multigesti/ e força porta :1200 no host público
# Uso (root): bash /development/multgesti-top-home/FIX-PWA-PORT.sh
set -euo pipefail

ROOT="/development/multgesti-top-home"
WEB="/var/www/multigesti"
cd "$ROOT"

echo "==> Criando src/utils/appUrl.ts..."
mkdir -p src/utils
cat > src/utils/appUrl.ts << 'EOF'
/** Prefixa caminhos com o base do Vite (/multigesti/) para não perder o subpath/porta. */
export function appUrl(path: string = "/"): string {
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  if (!path || path === "/") {
    return `${base}/`;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
EOF

echo "==> Guard de porta :1200 em main.tsx..."
python3 - << 'PY'
from pathlib import Path
path = Path("/development/multgesti-top-home/src/main.tsx")
text = path.read_text()
guard = """
// NAT público: HTTPS só na :1200. Sem porta o app quebra fora da rede local.
if (
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  (window.location.hostname === "tophc.com.br" || window.location.hostname === "www.tophc.com.br") &&
  !window.location.port
) {
  const { pathname, search, hash } = window.location;
  window.location.replace(`https://${window.location.hostname}:1200${pathname}${search}${hash}`);
}

"""
if "hostname}:1200" in text or "hostname === \"tophc.com.br\"" in text and ":1200" in text:
    print("main.tsx: guard de porta já presente")
else:
    # injeta após imports, antes do registerSW / render
    needle = "import { registerSW } from 'virtual:pwa-register';\n"
    if needle in text:
        text = text.replace(needle, needle + "\n" + guard, 1)
    else:
        text = guard + text
    path.write_text(text)
    print("main.tsx: guard :1200 adicionado")
PY

echo "==> Corrigindo navegações absolutas sem /multigesti/..."
python3 - << 'PY'
from pathlib import Path
import re

ROOT = Path("/development/multgesti-top-home/src")

def ensure_import(text: str, import_line: str) -> str:
    if "appUrl" in text and "utils/appUrl" in text:
        return text
    # inserir após o primeiro import
    m = re.search(r"^(import .+?\n)", text, re.M)
    if not m:
        return import_line + "\n" + text
    idx = m.end()
    # achar fim do bloco de imports
    pos = 0
    for m in re.finditer(r"^import .+?;\s*\n", text, re.M):
        pos = m.end()
    if pos == 0:
        return import_line + "\n" + text
    return text[:pos] + import_line + "\n" + text[pos:]

replacements_href_loc = [
    # window.location.href = "..."
    (r'window\.location\.href\s*=\s*"/gestmkt/permissao"', 'window.location.href = appUrl("/gestmkt/permissao")'),
    (r"window\.location\.href\s*=\s*'/gestmkt/permissao'", "window.location.href = appUrl('/gestmkt/permissao')"),
    (r'window\.location\.href\s*=\s*"/zaphub/permissao"', 'window.location.href = appUrl("/zaphub/permissao")'),
    (r'window\.location\.href\s*=\s*"/gestlog/permissao"', 'window.location.href = appUrl("/gestlog/permissao")'),
    (r'window\.location\.href\s*=\s*"/gestpro/permissao"', 'window.location.href = appUrl("/gestpro/permissao")'),
    (r'window\.location\.href\s*=\s*"/gestoper"', 'window.location.href = appUrl("/gestoper")'),
    (r'window\.location\.href\s*=\s*"/gestvendas"', 'window.location.href = appUrl("/gestvendas")'),
    (r'window\.location\.href\s*=\s*"/gestfin/permissao"', 'window.location.href = appUrl("/gestfin/permissao")'),
    (r'window\.location\.href\s*=\s*"/ofxconcilia/permissao"', 'window.location.href = appUrl("/ofxconcilia/permissao")'),
    (r'window\.location\.href\s*=\s*"/ofxconcilia"', 'window.location.href = appUrl("/ofxconcilia")'),
    (r'window\.location\.href\s*=\s*"/gestlog"', 'window.location.href = appUrl("/gestlog")'),
    (r'window\.location\.href\s*=\s*"/gestmkt"', 'window.location.href = appUrl("/gestmkt")'),
    (r'window\.location\.href\s*=\s*"/dashboard"', 'window.location.href = appUrl("/dashboard")'),
    (r"window\.location\.href\s*=\s*'/dashboard'", "window.location.href = appUrl('/dashboard')"),
    (r'window\.location\.href\s*=\s*"/"', 'window.location.href = appUrl("/")'),
    (r"window\.location\.href\s*=\s*'/'", "window.location.href = appUrl('/')"),
]

href_attrs = [
    (r'href="/dashboard"', 'href={appUrl("/dashboard")}'),
    (r"href='/dashboard'", "href={appUrl('/dashboard')}"),
    (r'backLink="/dashboard"', 'backLink={appUrl("/dashboard")}'),
    (r"backLink='/dashboard'", "backLink={appUrl('/dashboard')}"),
]

# TopBar default backLink
files_touched = []
for path in ROOT.rglob("*"):
    if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
        continue
    text = path.read_text()
    orig = text
    for a, b in replacements_href_loc + href_attrs:
        text = re.sub(a, b, text)
    # TopBar default
    if path.name == "TopBar.tsx":
        text = text.replace('backLink = "/dashboard"', 'backLink = "/dashboard"')  # keep raw; resolve below
        if "resolvedBackLink" not in text and "href={backLink}" in text:
            text = text.replace(
                "href={backLink}",
                'href={backLink.startsWith(String(import.meta.env.BASE_URL || "/")) ? backLink : appUrl(backLink)}',
            )
    if text != orig:
        # relative import depth
        rel = path.relative_to(ROOT)
        depth = len(rel.parts) - 1
        prefix = "../" * depth if depth else "./"
        # utils is under src/utils
        # from src/pages/dashboard -> ../../utils/appUrl
        # from src/components -> ../utils/appUrl
        import_line = f'import {{ appUrl }} from "{prefix}utils/appUrl";'
        # fix prefix: path is relative to src, utils is src/utils
        # depth = number of dirs under src
        dirs = rel.parts[:-1]
        prefix = "../" * len(dirs) if dirs else "./"
        import_line = f'import {{ appUrl }} from "{prefix}utils/appUrl";'
        text = ensure_import(text, import_line)
        path.write_text(text)
        files_touched.append(str(rel))

print("arquivos atualizados:")
for f in files_touched:
    print(" -", f)
if not files_touched:
    print(" (nenhuma alteração — talvez já aplicado)")
PY

echo "==> Manifest start_url absoluto com :1200..."
python3 - << 'PY'
from pathlib import Path
vite = Path("/development/multgesti-top-home/vite.config.ts")
text = vite.read_text()
old = "start_url: '/multigesti/',\n        scope: '/multigesti/',"
new = "start_url: 'https://tophc.com.br:1200/multigesti/',\n        scope: 'https://tophc.com.br:1200/multigesti/',"
if "tophc.com.br:1200/multigesti" in text:
    print("vite: start_url já absoluto")
elif old not in text:
    # tentar aspas duplas / variação
    raise SystemExit("bloco start_url/scope não encontrado")
else:
    vite.write_text(text.replace(old, new, 1))
    print("vite: start_url/scope com :1200")
PY

echo "==> Build + publish..."
npm run build
rsync -a --delete "$ROOT/dist/" "$WEB/"
chown -R www-data:www-data "$WEB"

echo
echo "OK."
echo "1) Hard refresh / reinstale o PWA"
echo "2) Navegue pelo dashboard — URLs devem ficar em https://tophc.com.br:1200/multigesti/..."
