# 🤖 Afiliate WhatsApp Worker (Baileys + Firestore)

Este é um **Worker autônomo em Node.js** projetado para rodar em segundo plano (seja no seu celular via **Termux** ou em uma **VM / VPS / Render**). Ele conecta a uma conta de WhatsApp usando a biblioteca [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) e sincroniza automaticamente os disparos de ofertas agendados no painel **Afiliate App** através do **Google Cloud Firestore**.

---

## ⚠️ AVISOS EXTREMAMENTE IMPORTANTES - LEIA COM ATENÇÃO!

1. **BIBLIOTECA NÃO OFICIAL**: Este software utiliza o protocolo não-oficial `@whiskeysockets/baileys`. Ele NÃO utiliza a API Cloud oficial do WhatsApp (WhatsApp Business API).
2. **RISCO REAL DE BANIMENTO**: O uso de scripts de automação ou disparadores em massa viola os Termos de Serviço do WhatsApp. Existe o risco real do seu número ser **bloqueado/banido permanentemente**.
3. **USE UM NÚMERO EXCLUSIVO E DEDICADO**: **JAMAIS** conecte o seu número de telefone pessoal ou da sua empresa principal neste worker! Adquira um chip/número dedicado exclusivamente para o robô de ofertas.
4. **VOLUME CONSERVADOR & RITMO ANTIBAN**:
   - Utilize intervalos aleatórios moderados (ex: gaps de 30s a 120s entre mensagens).
   - Não dispare para centenas de grupos ao mesmo tempo.
   - Respeite horários comerciais (ex: 09h às 21h).
5. **CONFORMIDADE LGPD**: Por privacidade e conformidade com a LGPD (Lei Geral de Proteção de Dados), este worker registra **apenas a contagem numérica de membros** dos grupos. Ele **NÃO** armazena contatos, nomes ou telefones dos participantes dos grupos no banco de dados.

---

## 📂 Arquitetura do Worker

- **Sincronização de Grupos**: Conecta ao WhatsApp, lê todos os grupos em que o robô é participante e grava o nome, contagem de membros, foto e status de admin em `users/{USER_UID}/waGroups/{groupId}`.
- **Motor de Campanhas**: Consulta as campanhas ativas do usuário em `users/{USER_UID}/campaigns`, filtra os produtos do catálogo conforme os critérios (desconto, preço, vendas, plataforma) e agenda as mensagens na fila `users/{USER_UID}/sendQueue` com tempos de pausa sorteados (*pacing* aleatório).
- **Consumidor de Fila (Send Queue)**: Processa as mensagens com status `pending`, simula o status "digitando..." por alguns segundos, envia a imagem com a legenda da oferta no grupo e registra o log em `users/{USER_UID}/sendLog`.

---

## 🚀 Como Rodar no Termux (Android)

Você pode transformar um celular Android antigo em um servidor de automação 24/7 para seus grupos de ofertas!

### 1. Instalar o Termux
Baixe a versão atualizada do Termux através do **F-Droid** (evite a versão desatualizada da Play Store).

### 2. Preparar o Ambiente no Termux
Abra o aplicativo Termux e execute os comandos:

```bash
# Atualizar pacotes
pkg update && pkg upgrade -y

# Instalar Node.js, Git e utilitários
pkg install nodejs-lts git tmux -y

# Impedir que o Android coloque o Termux em hibernação/economia de bateria
termux-wake-lock
```

### 3. Baixar ou Copiar os Arquivos
Navegue até a pasta do worker:

```bash
cd whatsapp-worker
npm install
```

### 4. Configurar as Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
nano .env
```

Preencha as variáveis:
- `USER_UID`: Copie o seu UID exibido no rodapé/perfil do Afiliate App.
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Adicione o caminho do arquivo JSON de credenciais baixado do seu projeto no Firebase Console (`serviceAccountKey.json`).

### 5. Iniciar o Worker e Escanear o QR Code
Para rodar pela primeira vez:

```bash
node index.js
```

Um **QR Code em ASCII** será exibido no terminal do Termux.
1. Abra o WhatsApp no seu celular dedicado.
2. Acesse **Aparelhos Conectados > Conectar um Aparelho**.
3. Escaneie o QR Code exibido na tela do Termux.
4. Assim que conectar, você verá a mensagem: `✅ CONECTADO COM SUCESSO AO WHATSAPP!`.

### 6. Manter Rodando em Segundo Plano (com `tmux` ou `pm2`)
Para evitar que o robô pare se você fechar a tela do Termux:

**Usando `tmux`:**
```bash
tmux new -s zapworker
node index.js
# Pressione CTRL + B e depois D para desanexar do terminal sem parar o robô!
```

Para voltar ao terminal do robô depois:
```bash
tmux attach -t zapworker
```

**Usando `pm2`:**
```bash
npm install -g pm2
pm2 start index.js --name afiliate-zap
pm2 save
```

---

## 🌐 Como Rodar numa VM / Servidor na Nuvem (Render, VPS, Railway)

### 1. Arquivo de Credenciais
Em plataformas como o **Render**, você pode definir a variável de ambiente `FIREBASE_SERVICE_ACCOUNT_JSON` colando o conteúdo do arquivo de credencial JSON diretamente na variável, sem precisar subir arquivos sensíveis para o Git.

### 2. Variáveis de Ambiente Necessárias
No painel do seu servidor (ex: Render Environment Variables):
- `USER_UID`: Seu UID do Afiliate App.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Conteúdo completo em texto do `serviceAccountKey.json`.
- `AUTH_DIR`: `./auth` (Certifique-se de configurar um **Persistent Disk** / Volume se estiver em hospedagens serverless para manter a sessão do WhatsApp salva entre reinicializações do contêiner).

> ℹ️ **Aviso do Plano Gratuito do Render**: No plano free do Render, a aplicação entra em modo de suspensão (*sleep*) após inatividade. Quando o contêiner dorme, o WebSocket do Baileys é desconectado. Recomenda-se utilizar uma VPS dedicada (como DigitalOcean, Hetzner) ou manter o worker no Termux.

---

## 🛠️ Solução de Problemas & Dicas

- **O QR Code expirou ou a sessão caiu**: Apague a pasta `./auth` e execute `node index.js` para ler um novo QR Code.
- **Aviso de limite de envios**: Aumente os valores `minGapSec` e `maxGapSec` nas configurações de campanhas no painel do aplicativo.
- **O robô não é admin nos grupos**: Sem permissão de administrador em alguns grupos, o robô conseguirá enviar mensagens normalmente, mas a foto e descrição do grupo no painel do app podem demorar mais para atualizar.
