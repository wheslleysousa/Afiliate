# Afiliate — direção visual e UX

Referência de método: Impeccable (shape → distill → critique → polish → animate), aplicado manualmente. A skill não foi instalada neste ambiente ChatGPT; o documento registra as decisões do produto.

## Identidade
Marca: SVG `src/assets/afiliate-mark.svg`, fiel aos paths vetoriais do launcher Android, azul #116CF5, detalhe branco #FAFAFA, fundo preto #050505. Nunca trocar a marca por Sparkles genéricos.

## Sistema visual
- Fundo principal #07090f; superfícies #0e1119; cartões #151a26; borda #1e2636.
- Texto principal #eef2f9; texto secundário legível #a6b4c9; ação primária azul #116cf5; WhatsApp verde apenas como semântica.
- Componentes com bordas consistentes, menos cartões aninhados, sem efeitos decorativos que disputem atenção com os dados.
- Ações destrutivas exigem confirmação com resultado explícito.

## Navegação responsiva
- Mobile <768 px: sem barra de navegação inferior. Botão de menu no cabeçalho abre a sidebar pela esquerda com todas as seções, rolagem própria, fechamento por X, backdrop, Escape ou seleção de item.
- Desktop: sidebar colapsável; no celular, drawer completo acessível sem deixar os controles da página sobrepostos.
- A marca exibida em toda a interface é **Afiliate** (A maiúsculo); nomes técnicos, chaves, pacote, Firebase, URLs e IDs não são renomeados.
- Aba inicial do módulo WhatsApp: grupos, pois acompanhamento de campanhas está desabilitado quando o worker tem envio desligado.
- Focus visível, touch targets >=44px, inputs >=16px no mobile.

## Feedback/Estados
- `loading` / `empty` / `connected` / `disconnected` / `pending` / `done` / `failed` devem ser diferentes.
- Mensagens devem diferenciar solicitação salva no Firestore de ação confirmada pelo WhatsApp.
- Opções de comunidade/canal mostradas apenas quando a versão instalada do worker anuncia suporte e autorização.

## Movimento
- Transições 160–240 ms para navegação/feedback, sem bloquear interação.
- Sem rolagens bruscas ou animações em loop para conteúdo importante.
- Respeitar `prefers-reduced-motion`; manter cargas visuais leves em Android.

## Próximas telas a refinar (fase 2)
- Dashboard: resumo do dia e CTA único.
- Explorar: busca rápida e cards de produto mais escaneáveis.
- Criar: fluxo guiado, prévia de anúncio antes de publicar.
- WhatsApp: abas "Grupos", "Campanhas", "Atividade" e centro de comandos pendentes com erros e confirmação.
- Configurações: agrupar por "Contas", "Integrações", "Preferências"; remover campos técnicos do caminho principal.
- QA visual: screenshots reais em 360, 390 e 768 px; login, grupos vazio/cheio, erros, teclado aberto, gestos e acessibilidade.

## Guardrails
Validar mudanças visuais no preview e revisar no aparelho após atualização; a migração Render já foi integrada à main. Não alegar "canal/comunidade funcional" apenas porque a API de Baileys existe em outra versão. 
