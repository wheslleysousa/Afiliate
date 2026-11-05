# Afiliate — Canais e grupos no WhatsApp

## Situação e limites
O worker do Termux usa Baileys (não oficial) e só pode enviar mensagens para **grupos em que você participa** ou **canais em que a conta conectada tem permissão de administrador**. Contas que apenas seguem um canal não têm permissão para publicar.

## Sincronização
1. Abra **WhatsApp → Canais → Atualizar** no Afiliate para solicitar sincronização. O worker usa o mesmo sinal de sincronização de grupos.
2. Se Baileys tiver `newsletterFetchAllParticipating`, o worker tenta buscar **seus canais e os que você segue**. `canPost` é verificado por metadados privados; qualquer falha mantém o canal em **somente leitura**.
3. Se a versão do Baileys não oferecer essa listagem, o app mostra o limite e você pode clicar **Adicionar por link** para cadastrar cada canal `https://whatsapp.com/channel/...`. Ao cadastrar um canal seguido, ele aparecerá em **Seguindo**, sem permissão de publicação.
4. Canais não são removidos automaticamente por falhas temporárias de API. Use a aba **Meus canais** para encontrar somente canais autorizados.
5. **Grupos:** a sincronização marca como inativos os que não estão na lista atual do WhatsApp, sem apagar o histórico no Firestore. No painel, **Ocultar** esconde um grupo sem sair dele; é possível reexibir com **Mostrar ocultos**. Apagar uma conversa no aplicativo WhatsApp **não significa sair do grupo** — o WhatsApp pode continuar incluindo o grupo na resposta de participação.

## Segurança dos disparos
- Manter `WA_SEND_ENABLED=false` até testar um envio em canal próprio. `WA_GROUP_COMMANDS_ENABLED=false` continua desativando criação e saída de grupos; cadastro/sincronização de canais não publica.
- O supervisor `whatsapp-worker/manager.js` continua seguro e não envia ofertas automaticamente.
- `WA_CHANNEL_MEDIA_ENABLED=false` deixa a publicação em canais como texto, até validar imagem em canal real.
- Publicação automática depende da permissão de administrador revalidada pelo worker e de destinatário explicitamente selecionado.
- Não execute várias instâncias do worker para a mesma sessão nem apague `.env` / `auth/`.

## Android/Vercel
Frontend/API hospedados no Vercel; worker no Termux. O APK só deve ser criado pelo worker local via `npm run build:apk:termux`, **não por GitHub Actions**. Após qualquer alteração no worker: `git pull` e reinicie o processo pelo PM2, preservando autenticação.

## Validação pendente
Compilação em Vercel e testes de helpers provam apenas código, não descoberta de canais reais na versão Baileys instalada. Conferir em uma conta real que os canais seguidos aparecem (automaticamente ou por link) e que um único post no canal próprio é entregue, com disparos bloqueados até autorização deliberada.

## 2026-11-04 — Identidade, seguidores, remoção e links curtos
- Ao sincronizar, guardar `name`, `photoUrl`, `followersCount` e `description` somente quando retornados pelos metadados reais do Baileys. Seguidor desconhecido deve aparecer como **não informado**, nunca inventado.
- **Excluir do Afiliate** cria tombstone em `waChannelExclusions`; não cancela a inscrição no WhatsApp. **Restaurar** remove o tombstone.
- **Sair do canal** solicita `newsletterUnfollow` somente para canais seguidos, com confirmação e permissão isolada `WA_CHANNEL_LEAVE_ENABLED=true`. Canais administrados são gerenciados diretamente no WhatsApp. A opção não libera envio de ofertas, criação de grupos ou saídas automáticas.
- Gerador de campanhas registra `shortLinks` no Firestore antes de colocar a copy na fila, com `targetUrl` apontando para o link de afiliado. Não é seguro usar somente URL encurtada sem gravar o registro. O consumidor da fila também migra copies antigas; se falhar, a publicação **não** acontece com o link bruto.
- O endereço curto público usa `https://lkrm.site/prefixo/codigo`. A confirmação ponta a ponta (resolução HTTPS e WhatsApp real) ainda depende de testes em produção.
