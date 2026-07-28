#!/usr/bin/env bash
# Instala e configura PWA no Multgest-i (Vite + vite-plugin-pwa)
# Uso (como root): bash /development/multgesti-top-home/SETUP-PWA.sh
set -euo pipefail

ROOT="/development/multgesti-top-home"
cd "$ROOT"

echo "==> Instalando vite-plugin-pwa..."
npm install -D vite-plugin-pwa

echo "==> Criando ícones PWA a partir de public/logo.png..."
mkdir -p public/icons
# Sem sharp/PIL neste host: reutiliza o logo (válido para installability)
cp -f public/logo.png public/icons/pwa-192x192.png
cp -f public/logo.png public/icons/pwa-512x512.png
cp -f public/logo.png public/icons/apple-touch-icon.png

echo "==> Criando src/vite-env.d.ts..."
cat > src/vite-env.d.ts << 'EOF'
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
EOF

echo "==> Atualizando index.html (meta PWA)..."
python3 - << 'PY'
from pathlib import Path
path = Path("/development/multgesti-top-home/index.html")
text = path.read_text()
if 'name="theme-color"' in text:
    print("index.html: meta PWA já presente")
else:
    needle = '    <title>Multgest-i</title>\n'
    insert = '''    <meta name="theme-color" content="#0d6efd" />
    <meta name="description" content="Multgest-i — gestão operacional" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Multgest-i" />
    <link rel="apple-touch-icon" href="/multigesti/icons/apple-touch-icon.png" />
    <title>Multgest-i</title>
'''
    if needle not in text:
        raise SystemExit("index.html: title não encontrado")
    path.write_text(text.replace(needle, insert, 1))
    print("index.html: meta PWA adicionada")
PY

echo "==> Registrando Service Worker em src/main.tsx..."
python3 - << 'PY'
from pathlib import Path
path = Path("/development/multgesti-top-home/src/main.tsx")
text = path.read_text()
if "virtual:pwa-register" in text:
    print("main.tsx: registerSW já presente")
else:
    old = """import 'bootstrap/dist/css/bootstrap.min.css'; // Adicione esta linha!


ReactDOM.createRoot"""
    new = """import 'bootstrap/dist/css/bootstrap.min.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nova versão disponível — recarrega para aplicar o update
    window.location.reload();
  },
  onOfflineReady() {
    console.log('[PWA] Pronto para uso offline (assets em cache)');
  },
});

ReactDOM.createRoot"""
    if old not in text:
        raise SystemExit("main.tsx: bloco esperado não encontrado")
    path.write_text(text.replace(old, new, 1))
    print("main.tsx: registerSW adicionado")
PY

echo "==> Injetando VitePWA em vite.config.ts..."
python3 - << 'PY'
from pathlib import Path
path = Path("/development/multgesti-top-home/vite.config.ts")
text = path.read_text()

if "VitePWA" in text and "vite-plugin-pwa" in text:
    print("vite.config.ts: VitePWA já configurado")
else:
    if "import { VitePWA } from 'vite-plugin-pwa'" not in text:
        text = text.replace(
            "import react from '@vitejs/plugin-react'\n",
            "import react from '@vitejs/plugin-react'\nimport { VitePWA } from 'vite-plugin-pwa'\n",
            1,
        )

    old = "  plugins: [react()],\n"
    new = """  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons/*.png', 'vite.svg'],
      manifest: {
        name: 'Multgest-i',
        short_name: 'Multgest-i',
        description: 'Multgest-i — gestão operacional',
        theme_color: '#0d6efd',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        lang: 'pt-BR',
        start_url: '/multigesti/',
        scope: '/multigesti/',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/multigesti/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/apis/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\\/\\/fonts\\.googleapis\\.com\\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\\/\\/fonts\\.gstatic\\.com\\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
"""
    if old not in text:
        raise SystemExit("vite.config.ts: plugins: [react()] não encontrado")
    path.write_text(text.replace(old, new, 1))
    print("vite.config.ts: VitePWA adicionado")
PY

echo "==> Atualizando nota no deploy-nginx-multigesti.md..."
python3 - << 'PY'
from pathlib import Path
path = Path("/development/multgesti-top-home/deploy-nginx-multigesti.md")
if not path.exists():
    print("deploy md ausente — pulando")
    raise SystemExit(0)
text = path.read_text()
block = """

## PWA (Service Worker)

Com `base: '/multigesti/'`, o service worker fica em `/multigesti/sw.js` (ou `sw.js` gerado pelo plugin) e o manifest em `/multigesti/manifest.webmanifest`.

Garanta que o Nginx sirva esses arquivos pelo `location /multigesti/` (já coberto pelo `alias`/`root`).

Não cacheie o SW agressivamente:

```nginx
location = /multigesti/sw.js {
    alias /var/www/multigesti/sw.js;
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/multigesti/";
}

location = /multigesti/manifest.webmanifest {
    alias /var/www/multigesti/manifest.webmanifest;
    add_header Cache-Control "no-cache";
    default_type application/manifest+json;
}
```

Após rebuild + rsync, reinstale/atualize o PWA no celular (Chrome → Instalar app).
"""
if "## PWA (Service Worker)" in text:
    print("deploy md: seção PWA já existe")
else:
    path.write_text(text.rstrip() + "\n" + block)
    print("deploy md: seção PWA adicionada")
PY

echo "==> Build de verificação..."
npm run build

echo
echo "OK — PWA configurado."
echo "Próximos passos:"
echo "  1) sudo rsync -a --delete dist/ /var/www/multigesti/"
echo "  2) Ajuste Nginx (seção PWA no deploy-nginx-multigesti.md) se necessário"
echo "  3) Abra https://tophc.com.br/multigesti/ e use 'Instalar app'"
echo "Em dev: o SW fica desligado (devOptions.enabled=false). Use preview/produção para testar PWA."
