# Afiliate no Termux — gerar APK e manter worker online

Este documento diferencia **build local do APK** e **execução contínua do worker WhatsApp**. O Android tem interface instalada via Capacitor; o worker (Baileys/Firebase Admin) **não** é embutido no APK e precisa de processo sempre ativo. `wake-lock` ajuda, não garante disponibilidade 24/7.

## 1. Gerar o APK no mesmo Android pelo Termux

Ferramentas já evidenciadas em 2026-11-01: Node 26, JDK 21, `~/android-sdk` com plataforma 36, `aapt2`, Git e Python. **Não desinstalar nem reinstalar esses ambientes** sem um erro concreto.

No Termux:

```sh
cd ~/Afiliate
git pull --ff-only
npm run build:apk:termux
```

O comando chama `scripts/build-termux.sh`: valida Java/SDK/AAPT2, instala dependências JS apenas se faltar Vite/Capacitor, compila o frontend com `vite build`, gera e sincroniza `android/` com Capacitor, usa `aapt2` nativo e Gradle para gerar um **APK debug**. Verifica que o ZIP contém `AndroidManifest.xml` e `resources.arsc`; então copia para `~/storage/downloads/Afiliate-debug.apk` quando há permissão. Não modifica chaves de serviço/credenciais/sessão do WhatsApp.

**Possível bloqueio no primeiro teste:** pacotes nativos **Rollup / Tailwind Oxide / Lightning CSS** podem falhar no Termux ARM64. Se isso acontecer, compartilhar o primeiro erro do build; **não apagar `node_modules`, não forçar `npm audit fix --force`, nem reconfigurar o SDK inteiro**. Compilação pelo GitHub Actions já foi confirmada; a execução do novo script diretamente neste celular ainda **não foi testada**. O script informa falha em vez de fingir sucesso.

Assinatura debug criada localmente pode ser diferente da assinatura debug do GitHub Actions. O Android pode impedir a atualização por cima mesmo com `com.lkrm.app` correto; **não desinstalar nem limpar dados sem backup/decisão**. Publicação para outros usuários exige assinatura estável de release.

## 2. Manter o worker (somente a conta configurada no Termux)

Os registros `npm run doctor` confirmaram acesso a Firebase/Firestore do Afiliate. A sessão WhatsApp antiga retornou **401** e não deve ser restaurada automaticamente; a versão atual arquiva credenciais recusadas. Antes de iniciar, garantir que nenhum `node index.js`, PM2 ou tmux anterior esteja rodando para a mesma conta.

```sh
cd ~/Afiliate
git pull --ff-only
cd whatsapp-worker
npm run check
npm run doctor
termux-wake-lock
WA_SEND_ENABLED=false WA_GROUP_COMMANDS_ENABLED=false pm2 start index.js --name afiliate-worker --time
pm2 save
pm2 logs afiliate-worker --lines 30
```

Comandos posteriores: `pm2 list`, `pm2 restart afiliate-worker`, `pm2 stop afiliate-worker`, `pm2 logs afiliate-worker`. **Não rodar o worker pelo tmux e PM2 ao mesmo tempo.**

Ativar no Android **Termux → Bateria → Sem restrições** e permitir execução em segundo plano (e inicialização automática se o fabricante disponibilizar); manter acesso à internet. `termux-wake-lock` diminui a chance de o sistema dormir, mas consome bateria e não garante que o Android não mate a aplicação. Após reboot, pode ser necessário abrir Termux e `pm2 resurrect` ou configurar Termux:Boot — `pm2 save` sozinho não garante autostart após reboot. `termux-wake-unlock` libera wakelock quando não quiser mais rodar serviços.

**Mantenha `WA_SEND_ENABLED=false`, `WA_GROUP_COMMANDS_ENABLED=false`** até validar a nova conexão WhatsApp e uma campanha de teste autorizada. Baileys não oficial tem risco de bloqueio de número. Há 15 vulnerabilidades npm pendentes de correção analisada.

## 3. Limite importante para outros usuários

Este worker de `index.js` carrega somente **um UID** do `.env` local. Assim, enquanto ele estiver rodando no seu Termux, **apenas a conta desse UID** terá um processador de sessão e código. O APK pode ser instalado por outras pessoas, mas isso **não** habilita automaticamente conectar WhatsApp de outras contas.

Um protótipo `manager.js` para multiusuário foi criado, com UID e auth separados, mas **não está validado e nem hospedado**. Hospedagem online confiável, armazenamento persistente por pessoa, isolamento de Firestore, revisão de segurança, cotas, LGPD e testes com duas contas são obrigatórios antes de disponibilizar para o público.

O usuário final usa somente o APK. Termux/worker são infraestrutura do operador em fase de testes, não etapas de instalação dos usuários.

Referências: `docs/ANDROID_APP_WHATSAPP_PAIRING_2026-11-01.md` e `whatsapp-worker/README.md`.
