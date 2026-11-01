# Afiliate — Worker WhatsApp no Termux (Android)
O worker usa **Baileys não oficial**. Há risco de bloqueio da conta. Envie ofertas somente a grupos onde a publicação é autorizada; nunca use disparos massivos sem consentimento.

## Fluxo existente (não altera suas campanhas)
**Afiliate miner → Firebase → Meus Produtos → Campanhas do Afiliate → fila → WhatsApp**.
O worker usa o UID da mesma conta do Afiliate e preserva campanhas já salvas. Não é preciso Render para executar o worker; a plataforma Afiliate/site e os scrapers podem continuar dependendo de um backend hospedado.

## 1. Instalação
Instale Termux pelo F-Droid. No Termux:
```sh
pkg update -y && pkg upgrade -y
pkg install -y git nodejs tmux
termux-wake-lock
cd ~
git clone https://github.com/wheslleysousa/Afiliate.git
cd Afiliate/whatsapp-worker
npm install
npm run check
cp -n .env.example .env
nano .env
```
Se você já clonou antes: `cd ~/Afiliate && git pull --ff-only && cd whatsapp-worker`. **Não apague `auth/`** ao atualizar.

## 2. Credenciais (não compartilhar nem subir ao GitHub)
No Firebase Console do **mesmo projeto que o Afiliate utiliza**, gere uma chave privada em Configurações do Projeto → Contas de serviço. Salve em `whatsapp-worker/serviceAccountKey.json` no Termux (por exemplo, usando `termux-setup-storage` e copiando da pasta Downloads). Proteja:
```sh
chmod 600 serviceAccountKey.json
```
No `.env`, configure `USER_UID` igual ao da sua conta no Afiliate, `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json` e mantenha o `FIRESTORE_DATABASE_ID` do exemplo. Não use UID inventado, não cole credenciais em chats e não comite `.env` ou `auth/`.

**Primeiro teste, sem disparar:** deixe `WA_SEND_ENABLED=false` e `WA_GROUP_COMMANDS_ENABLED=false`. Para parear por código no mesmo telefone, adicione `WA_PAIRING_PHONE=55DDDNUMERO` (só números, com DDI 55); caso contrário, use QR em uma segunda tela.

## 3. Verificar Firestore sem enviar mensagens
```sh
npm run doctor
```
O comando confirma credenciais, UID, acesso ao banco nomeado e amostras de produtos, grupos, campanhas e filas. Não publica mensagens. Se der erro, corrija antes de ligar o worker.

## 4. Conectar WhatsApp em modo seguro
```sh
node index.js
```
Entre no **Afiliate → Automação Zap → Contas** e solicite conectar uma conta (ou reutilize uma já cadastrada). O worker lê `users/{uid}/waSessions` e gera o QR. Caso `WA_PAIRING_PHONE` esteja definido, mostrará um código no próprio Termux: no WhatsApp, abra **Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone**. Não é necessário escanear o QR exibido na própria tela.

Quando conectar, o worker deve exibir `CONECTADO COM SUCESSO AO WHATSAPP!` e sincronizar os grupos para o painel. **Em modo seguro, não envia ofertas nem cria/sai de grupos.**

## 5. Ativar só depois de testar
No Afiliate, revise todas as campanhas já ativas. Pause as antigas que não quer executar; selecione **um único grupo de teste autorizado**, **um produto** e um horário válido, e confirme se a extensão salvou o produto em **Meus Produtos**.

Pare o worker (`Ctrl+C`). Edite `.env`:
```sh
nano .env
# altere WA_SEND_ENABLED=false para WA_SEND_ENABLED=true
node index.js
```
Acompanhe **Automação Zap → Fila & Logs** e confira se chegou uma mensagem real ao grupo. Para interromper, pare o worker e volte para `WA_SEND_ENABLED=false` antes de reiniciar. `WA_GROUP_COMMANDS_ENABLED` pode permanecer `false` para evitar criar ou sair de grupos por acidente.

**Proteções:** em modo seguro não gera nem consome filas; offline deixa mensagens pendentes; ofertas antigas (>180 min, configurável) são descartadas; campanha pausada ou removida não publica; envios são reivindicados atomicamente para reduzir duplicações. Itens em `processing` após queda precisam revisão humana (para não mandar duplicado).

## 6. Rodar no Android
Para testar continuamente, use `tmux`:
```sh
tmux new -s afiliate
node index.js
# dentro do tmux: Ctrl+B, depois D para sair sem encerrar
tmux attach -t afiliate
```
Depois do teste, opcionalmente instale o PM2: `npm install -g pm2 && pm2 start index.js --name afiliate-worker && pm2 save`; consulte com `pm2 logs afiliate-worker` e pare com `pm2 stop afiliate-worker`. **Não rode tmux e PM2 simultaneamente.**

Em Android/HyperOS, configure **Termux → Bateria → Sem restrições**, permita execução em segundo plano, mantenha internet e evite “Forçar parada”. `termux-wake-lock` e PM2 ajudam, mas **Android ainda pode encerrar processos**, portanto não garantem 24/7. Opcionalmente use Termux:Boot para reiniciar após boot.

## Diagnóstico comum
- **UID sem perfil:** use a mesma conta Firebase do site e da extensão; confirme o UID.
- **PERMISSION_DENIED/NOT_FOUND:** revise service account, projeto e `FIRESTORE_DATABASE_ID`.
- **Nenhum QR/código:** antes crie/solicite conexão no painel Afiliate; verifique `waSessions`.
- **Nenhum grupo:** confirme que a conta conectada participa de grupos válidos.
- **Sem disparo:** revise `WA_SEND_ENABLED=true`, campanha habilitada, sessão, grupos, produto e horário.
- **Erro de índice Firestore:** implante o índice de `sendQueue (status ASC, scheduledAt ASC)` contido em `firestore.indexes.json`.
- **Caiu:** veja erros no terminal/PM2 e otimizador de bateria. Não apague `auth/` por reflexo.
- **Segurança:** o código legado também salva metadados de participantes na coleção `waGroups`. Revise acesso e retenção antes de expandir para terceiros.

## Limites
Worker ainda não foi testado diretamente neste Android nem com seu WhatsApp real. O envio de **canais** do WhatsApp não está demonstrado; o código usa somente identificadores de grupos `@g.us`. API não oficial pode parar de funcionar após mudanças no WhatsApp.
