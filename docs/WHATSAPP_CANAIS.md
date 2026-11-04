# Afiliate — canais do WhatsApp (implementação em desenvolvimento)

## Estado
O suporte a canais pertence à branch `feat/whatsapp-group-sync-mobile-ui` (PR #2); não está automaticamente instalado na `main` ou no APK existente.

### Fluxo
1. Conectar a conta WhatsApp com o worker local do Termux em modo seguro.
2. No Afiliate, abrir **Automação WhatsApp → Canais**; informar o link oficial `https://whatsapp.com/channel/...` ou o JID `@newsletter`.
3. A interface registra `users/{uid}/waCommands` com `action: registerChannel`. O worker verifica os metadados e as permissões da conta pelo socket Baileys e grava em `users/{uid}/waChannels` apenas quando a role é ADMIN/OWNER/CREATOR.
4. Se o Baileys instalado oferecer `newsletterFetchAllParticipating`, a sincronização tentará descobrir canais administrados automaticamente. Caso contrário, o cadastro manual por convite continua disponível.
5. Ao criar campanha, escolher explicitamente o canal autorizado na lista de **Grupos e canais**; o worker cria itens `sendQueue` e preserva informações de sessão.
6. No momento do envio, o worker revalida ao vivo o papel de administrador do canal; destinatários privados e canais não verificados são rejeitados. Itens com falha ficam visíveis na fila e em `sendLog`.

### Importante para segurança
- O worker instalado anteriormente tem `WA_SEND_ENABLED=false`. **Não habilitar** antes do teste único em canal próprio e revisão do envio real (incluindo imagens).
- `WA_GROUP_COMMANDS_ENABLED=false` continua bloqueando criação/saída; cadastrar um canal existente é permitido por ser uma verificação sem publicação.
- `whatsapp-worker/manager.js` ainda força as duas flags para `false` em workers multiusuário. Não o use como prova de envio automático em produção.
- **Baileys não é API oficial**. O envio para canais, especialmente mídia, pode falhar ou nem aparecer no WhatsApp; um `sendMessage` sem erro não comprova que o público recebeu.
- Não repetir automaticamente uma publicação após falha incerta: isso pode duplicar posts.
- O Firestore atual dá escrita ao cliente no próprio namespace de usuário. A segurança do envio **não deve depender só** de `canPost` armazenado lá; o worker revalida o papel administrativo ao vivo.
- Faltam testes ponta a ponta com canal real, verificação da versão Baileys instalada no Termux, e conferência da conta/autorizações antes de afirmar que o recurso está pronto.

## Integração com Vercel e Android
O worker Baileys roda **fora da Vercel**, no Termux. Vercel hospeda o frontend/API Express e deve receber a migração do PR #1. A ordem de release segura é: migrar API do Render (PR #1), integrar interface/worker de canais (PR #2), corrigir `VITE_API_URL`/build, recompilar APK, atualizar worker local preservando `auth/` e `.env`, testar uma única mensagem de canal próprio e só então ativar campanha.

## Diagnóstico do worker
No Termux, a confirmação requer `workerStatus/current` recente, sessão WhatsApp realmente conectada e canal marcado `canPost: true` após validação de metadados. O build da Vercel e os testes de helpers **não** confirmam envio de canal real.
