#!/bin/bash
# ==============================================================================
# MEGλ Studio - Auto Sync Watcher
# Monitora alterações em tempo real e envia automaticamente para o GitHub
# Uso: ./auto-sync.sh
# ==============================================================================

echo "👀 [MEGλ Auto-Sync] Monitorando alterações no portfólio..."
echo "Pressione Ctrl+C para parar."

while true; do
  # Verifica se há modificações ou arquivos novos não commitados
  if [[ -n $(git status --porcelain) ]]; then
    echo ""
    echo "⚡ Alteração detectada no código!"
    git add .
    git commit -m "auto: update portfolio ($(date '+%Y-%m-%d %H:%M:%S'))"
    # O hook post-commit cuidará do git push automaticamente!
    echo "⏳ Aguardando novas alterações..."
  fi
  sleep 4
done
