# Instruções e Regras Padrão do Projeto (AGENTS.md)

1. **Controle de Versão e Incremento**:
   - Sempre que houver uma grande mudança ou adição de funcionalidade no aplicativo, a versão do app deve ser incrementada em `0.0.1` (ex: de `0.0.1` para `0.0.2`).
   - Essa versão deve ser atualizada no arquivo `package.json` (campo `version`) e refletida nas informações do projeto.

2. **Segurança e Arquitetura**:
   - Manter regras rigorosas de Firestore e suporte a dispositivos móveis (Safe Area insets para entalhes/câmera).
   - Manter integrações reais com o Firebase e fluxos otimizados para encurtamento de links.
