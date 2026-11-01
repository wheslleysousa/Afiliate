# Afiliate Android — login e conexão WhatsApp no próprio aplicativo

## Experiência
Abrir o APK → entrar/criar conta Firebase → Automação WhatsApp → Conectar → escolher Código no celular ou QR Code. O usuário final não abre site, não instala Termux e não recebe credencial Firebase Admin.

O APK usa o shell Android Capacitor 8 e preserva o pacote com.lkrm.app. A interface é instalada, mas login, sincronização Firestore e WhatsApp precisam de rede. Não é uma integração offline com WhatsApp.

## Implementado em código — 2026-11-01
- O componente WhatsAppSessionCard permite escolher Código no celular ou QR Code, solicitar pareamento do número com DDI/DDD e acompanhar em tempo real o campo privado pairingCode na sessão Firebase. O usuário digita o código DENTRO do WhatsApp em Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone (não dentro do Afiliate). QR visível no próprio aplicativo exige outro dispositivo/tela para escaneamento.
- O worker Baileys gera código por sessão com sock.requestPairingCode(phone), sem exibi-lo em logs, e limpa os campos temporários quando conectado. O erro 401 arquiva credenciais recusadas em vez de apagar automaticamente.
- O supervisor opcional manager.js monitora usuários no Firestore e inicia processos isolados por UID. Armazena sessões em auth-users/<uid>, com limite inicial de até 100 usuários monitorados e 20 workers simultâneos (piloto). **Não foi implantado nem validado com várias contas reais**.
- O painel informa indisponibilidade do serviço sem instruir usuários finais a instalar Termux.
- No supervisor multiusuário, envio de campanhas e comandos que modificam grupos ficam FORÇADAMENTE desativados.

## Infraestrutura indispensável para qualquer pessoa conectar
O APK sozinho não sustenta WebSockets Baileys nem guarda sessões de contas de terceiros. Precisa de serviço backend online e persistente para:
1. reconhecer autenticação Firebase da conta e observar somente suas solicitações;
2. chamar Baileys, devolver o código/QR no documento privado users/{uid}/waSessions/{sessionId};
3. guardar credenciais de cada usuário em diretórios privados persistentes e reconectar após reinício;
4. registrar heartbeat individual e erros de forma transparente.

O worker no Termux com USER_UID fixo atende uma conta de teste e não é servidor público. O manager.js é ponto de partida para hospedar, não produção garantida.

**Segurança pendente para publicação:** revisão das 15 vulnerabilidades npm reportadas, isolamento e cotas/limites de sessões, exclusão e retenção de dados, confirmação das regras Firestore implantadas e testes com duas contas diferentes. As Firestore Rules atuais permitem que o próprio usuário escreva status em waSessions; produção exige separar pedidos autenticados (graváveis pelo cliente) e estados/códigos (graváveis só por backend), para evitar falsas conexões. Chaves de serviço e arquivos auth nunca entram no APK, Git ou chats.

Baileys não é oficial: pode violar termos do WhatsApp, parar com mudanças de protocolo ou causar restrições na conta. A API WhatsApp Business oficial não oferece pareamento por QR/código para contas pessoais.

## Build e instalação
O workflow GitHub Actions build-apk.yml compila React/Vite, gera projeto Android Capacitor e executa Gradle assembleDebug. Após sucesso, abra a execução do GitHub Actions → seção Artifacts → app-debug e extraia app-debug.apk. Instale o APK diretamente no Android. Esta versão é debug, não publicação assinada de produção.

Evite alterar com.lkrm.app ou apagar dados na atualização. APK debug gerado em runner diferente pode ter assinatura incompatível; antes de atualizar usuários finais, configurar uma chave de assinatura estável e publicar release.

## Critérios de validação ainda não executados
- APK instala, Firebase email/senha autentica, sessão persiste, navegação celular correta.
- Em conta A, código gerado aparece no APK, digitado no WhatsApp e sessão confirma connection.open.
- Conta B conecta de forma isolada; A não vê/edita seus grupos, telefones, QR ou códigos.
- QR funciona usando outro aparelho/tela; re-pareamento após 401 preserva backup.
- Desligar supervisor mostra serviço indisponível; reiniciar com volume preserva sessão.
- Campanhas e comandos de grupos permanecem desativados até auditoria e consentimento.
