#!/usr/bin/env bash
set -euo pipefail

# Script de deploy para multgesti
# - Build com Vite
# - Backup do /var/www/html
# - Publicação em produção

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$PROJECT_DIR/dist"
WEB_ROOT="/var/www/html"
TIMESTAMP="$(date +%F-%H%M%S)"
BACKUP_DIR="/var/www/html.bak.$TIMESTAMP"

log() { echo -e "[deploy] $*"; }
have_cmd() { command -v "$1" >/dev/null 2>&1; }

log "Iniciando build do projeto em $PROJECT_DIR"
pushd "$PROJECT_DIR" >/dev/null
npm run build
popd >/dev/null

if [[ ! -d "$BUILD_DIR" ]] || [[ -z "$(ls -A "$BUILD_DIR" 2>/dev/null || true)" ]]; then
  log "ERRO: pasta de build '$BUILD_DIR' está vazia ou não existe. Abortando."
  exit 1
fi

log "Criando backup do site atual: $BACKUP_DIR"
sudo cp -a "$WEB_ROOT" "$BACKUP_DIR"

log "Publicando nova versão em $WEB_ROOT"
if have_cmd rsync; then
  log "Usando rsync"
  sudo rsync -a --delete "$BUILD_DIR/" "$WEB_ROOT/"
else
  log "rsync não encontrado; aplicando fallback com rm+cp"
  sudo find "$WEB_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  sudo cp -a "$BUILD_DIR/"* "$WEB_ROOT/"
fi

log "Deploy concluído. Verifique em: https://multgesti.cloud/"
log "Backup criado em: $BACKUP_DIR"

exit 0