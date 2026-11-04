#!/data/data/com.termux/files/usr/bin/bash
# Afiliate: recuperar PM2 apos Android reiniciar/encerrar o Termux.
# Modo seguro: nunca ligar disparos/alteracoes em grupos na recuperacao.
set -eu
export PATH="${PREFIX:-/data/data/com.termux/files/usr}/bin:$PATH"

cd "$HOME/Afiliate/whatsapp-worker"
termux-wake-lock || true

# Recupera os processos salvos se o PM2 ainda nao tiver nenhum ativo.
pm2 resurrect >/dev/null 2>&1 || true
if pm2 describe afiliate-worker >/dev/null 2>&1; then
  WA_SEND_ENABLED=false WA_GROUP_COMMANDS_ENABLED=false pm2 restart afiliate-worker --update-env
else
  WA_SEND_ENABLED=false WA_GROUP_COMMANDS_ENABLED=false pm2 start index.js --name afiliate-worker
fi
pm2 save
pm2 status
