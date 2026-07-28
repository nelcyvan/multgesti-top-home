# Deploy do frontend Multgest-i no Nginx em `/multigesti/`

Guia para publicar o build Vite em **`https://tophc.com.br/multigesti/`** (ou o domínio do vhost atual), no mesmo padrão do `/chathub/`.

## Pré-requisitos

- Node.js / npm no servidor
- Nginx com o vhost HTTPS já ativo (`/etc/nginx/sites-available/default`)
- Backends no PM2 (portas usadas pelo proxy):

| Serviço        | PM2 name      | Porta |
|----------------|---------------|-------|
| conexao        | `conexao`     | 7001  |
| gestlog        | `gestlog`     | 7002  |
| ofxconcilia    | `ofxconcilia` | 7003  |
| gestpro        | `gestpro`     | 7004  |
| gestfin        | `gestfin`     | 7005  |
| app-gestpro    | `app-gestpro` | 7007  |
| app-gestlog    | `app-gestlog` | 7009  |
| evolution/zaphub | (se usar)  | 7008  |

Confirme:

```bash
pm2 status
ss -tlnp | grep -E '7001|7002|7003|7004|7005|7007|7008|7009'
```

---

## 1. Ajustar o Vite para subpath `/multigesti/`

Em `vite.config.ts`, adicione `base` (junto do `defineConfig`):

```ts
export default defineConfig({
  base: '/multigesti/',
  plugins: [react()],
  // ... resto (server.proxy só vale no `npm run dev`)
})
```

## 2. Ajustar o React Router

Em `src/App.tsx`, use `basename`:

```tsx
<Router basename="/multigesti">
```

Sem isso, rotas como `/dashboard` não batem com a URL `/multigesti/dashboard`.

## 3. Build

```bash
cd /development/multgesti-top-home
npm ci   # se ainda não instalou deps
npm run build
```

Saída esperada: pasta `dist/` com `index.html` e `assets/`.

## 4. Publicar os arquivos estáticos

```bash
sudo mkdir -p /var/www/multigesti
sudo rsync -a --delete /development/multgesti-top-home/dist/ /var/www/multigesti/
sudo chown -R www-data:www-data /var/www/multigesti
```

> Alternativa: publicar em `/development/multgesti-top-home/dist` e apontar o `alias` do Nginx direto para essa pasta (sem rsync).

---

## 5. Bloco Nginx

Inclua **dentro** do `server { ... }` HTTPS (443) do vhost atual (`tophc.com.br`).

Ordem importa: locations de `/api/` e `/apis/` devem ficar **antes** do `location /multigesti/`.

```nginx
# ---------- Multgest-i (frontend) ----------
location = /multigesti {
    return 301 /multigesti/;
}

location /multigesti/ {
    alias /var/www/multigesti/;
    index index.html;
    try_files $uri $uri/ /multigesti/index.html;
}

# Cache de assets versionados do Vite
location /multigesti/assets/ {
    alias /var/www/multigesti/assets/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# ---------- APIs Multgest-i (proxy para PM2) ----------
# Login / permissões (conexao)
location = /api/login {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

location = /api/gestlog/permissao {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

location = /api/gestpro/permissao {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

location = /api/gestfin/permissao {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

location = /api/gestmkt/permissao {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

location = /api/ofxconcilia/permissao {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

location = /api/zaphub/permissao {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

location = /api/zaphub/usuarios {
    proxy_pass http://127.0.0.1:7001;
    include proxy_params;
    proxy_http_version 1.1;
}

# GestLOG
location /api/gestlog/ {
    proxy_pass http://127.0.0.1:7002;
    include proxy_params;
    proxy_http_version 1.1;
    client_max_body_size 50m;
}

# OFX Concilia
location /api/ofxconcilia/ {
    proxy_pass http://127.0.0.1:7003;
    include proxy_params;
    proxy_http_version 1.1;
}

# GestPRO / GestMKT (servidor gestpro)
location /api/gestmkt/ {
    proxy_pass http://127.0.0.1:7004;
    include proxy_params;
    proxy_http_version 1.1;
}

location /api/gestpro/ {
    proxy_pass http://127.0.0.1:7004;
    include proxy_params;
    proxy_http_version 1.1;
    client_max_body_size 50m;
}

# GestFIN
location /api/gestfin/ {
    proxy_pass http://127.0.0.1:7005;
    include proxy_params;
    proxy_http_version 1.1;
}

# Evolution / ZapHub (se o serviço estiver no ar)
location /api/evolution/ {
    proxy_pass http://127.0.0.1:7008;
    include proxy_params;
    proxy_http_version 1.1;
}

location /api/zaphub/ {
    proxy_pass http://127.0.0.1:7008;
    include proxy_params;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}

# Apps mobile / APIs dedicadas
location /apis/gestlog {
    proxy_pass http://127.0.0.1:7009;
    include proxy_params;
    proxy_http_version 1.1;
}

location /apis/gestpro {
    proxy_pass http://127.0.0.1:7010;
    include proxy_params;
    proxy_http_version 1.1;
}
```

### Observações sobre o proxy

- As chamadas do frontend usam caminhos relativos (`/api/...`), **sem** o prefixo `/multigesti`. Por isso o proxy fica em `/api/...` na raiz do domínio.
- Algumas rotas do `app-gestpro` (ex.: inventário avulso, pedidos-separador) no Vite apontam para **7007**. Se no Nginx tudo de `/api/gestpro/` for para 7004, essas rotas específicas podem precisar de `location` mais específicas **antes** do bloco genérico, por exemplo:

```nginx
location = /api/gestpro/pedidos-separador {
    proxy_pass http://127.0.0.1:7007;
    include proxy_params;
    proxy_http_version 1.1;
}
```

Espelhe o `vite.config.ts` quando alguma rota falhar em produção.

### Atenção com `alias` + `try_files`

Em alguns Nginx, `alias` + `try_files` com fallback SPA é chato. Se der 404 em refresh de rota, use `root` assim:

```nginx
location /multigesti/ {
    root /var/www;
    # arquivos ficam em /var/www/multigesti/
    try_files $uri $uri/ /multigesti/index.html;
}
```

---

## 6. Testar e recarregar

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Testes rápidos:

```bash
curl -I https://tophc.com.br/multigesti/
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://tophc.com.br/api/login \
  -H 'Content-Type: application/json' -d '{"usuario":"x","senha":"y"}'
```

- Frontend: deve retornar **200** (HTML)
- Login: **404** usuário não encontrado / **401** / **200** — qualquer coisa **exceto** 502/504 (isso indica backend/PM2 parado)

---

## 7. Atualizar o frontend (redeploy)

```bash
cd /development/multgesti-top-home
npm run build
sudo rsync -a --delete dist/ /var/www/multigesti/
sudo systemctl reload nginx   # só se mudou config; para só estático não é obrigatório
```

---

## Checklist

- [ ] `base: '/multigesti/'` no Vite
- [ ] `basename="/multigesti"` no Router
- [ ] `npm run build` ok
- [ ] Arquivos em `/var/www/multigesti/`
- [ ] Locations Nginx (frontend + `/api`)
- [ ] PM2 com backends online
- [ ] `nginx -t` + `reload`
- [ ] Abrir `https://tophc.com.br/multigesti/` e testar login


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
