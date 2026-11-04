# Afiliate — contexto do produto

## Trabalho principal
Aplicativo Android e web para afiliados brasileiros administrarem produtos, criarem divulgações e acompanharem seus grupos/campanhas do WhatsApp.

## Usuário e ambiente
Mobile-first: uso frequente em Android, inclusive com worker Node.js em Termux. Internet móvel instável, WebView e sessões Baileys não oficiais exigem estados claros e recuperação de erros.

## Acesso às ações do dia a dia
1. Início: resumo objetivo e próxima ação.
2. Explorar: pesquisar ofertas/produtos.
3. Criar: preparar divulgação/copy.
4. WhatsApp: gerenciar grupos, contas e campanhas.
5. As demais ferramentas (encurtador, bio, cupons, projetos e configurações) também ficam no mesmo menu lateral, sem aba "Mais" ou barra inferior.

## Comportamentos obrigatórios
- Mostrar estado real, não sucesso otimista de comandos pendentes.
- Não apagar grupo local antes de confirmação de saída no WhatsApp.
- Separar "sair do grupo" de "apagar para todos" (o último NÃO é suportado).
- Não exigir Render para APIs. Migração backend integrada; fluxos reais ainda precisam de validação.
- Preservar autenticação, banco, dados, pacote Android e fluxo de atualização.
- Nunca ativar disparos de WhatsApp automaticamente; integração não oficial pode sofrer bloqueios.
- Respeitar "um comando por vez" no fluxo de suporte Termux.

## Definição de sucesso
Um usuário novo encontra Explorar/Criar/WhatsApp pelo menu lateral acessível no cabeçalho do celular, distingue grupos realmente conectados dos registros antigos, vê erros do worker claramente e não perde links ou dados em atualizações.
