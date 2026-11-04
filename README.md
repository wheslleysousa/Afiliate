# AfiliaCopy — Gerador de Copy para Afiliados Brasileiros

O **AfiliaCopy** é uma aplicação web completa desenvolvida para afiliados de e-commerce no Brasil (Mercado Livre, Shopee, Amazon, AliExpress e Shein). Basta colar o link de um produto para extrair automaticamente os dados (título, preços, parcelamento, cupom, imagem) e gerar copies altamente persuasivas e prontas para compartilhar no WhatsApp e redes sociais.

---

## 🏗️ Arquitetura do Projeto

```
                +---------------------------------+
                |        AfiliaCopy Frontend      |
                |  (Vite + React + Tailwind CSS)  |
                +---------------------------------+
                                |
                   API Requests | (/scrape, /api/gemini/copy)
                                v
                +---------------------------------+
                |        AfiliaCopy Backend       |
                |      (FastAPI + Python / Node)  |
                +---------------------------------+
                                |
      +-------------------------+-------------------------+
      |                         |                         |
      v                         v                         v
[Scrapers Nativos]      [APIs de Afiliados]       [IA Gemini API]
 (ML, Shopee, Amazon)   (AliExpress, Shein)     (Copies Persuasivas)
```

---

## 📂 Estrutura de Repositório (Monorepo)

```
afiliacopy/
├── backend/
│   ├── main.py
│   ├── scrapers/
│   ├── models.py
│   ├── requirements.txt
│   ├── render.yaml
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── netlify.toml
│   └── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Como Rodar Localmente

### 1. Backend (FastAPI - Python)

```bash
# Entrar no diretório do backend
cd backend

# Criar e ativar o ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependências
pip install -r requirements.txt

# Executar servidor FastAPI
uvicorn main:app --reload --port 8000
```
- API local: `http://localhost:8000`
- Documentação interativa Swagger: `http://localhost:8000/docs`

---

### 2. Frontend (Vite + React)

```bash
# Entrar no diretório do frontend
cd frontend # ou na raiz caso use Vite diretamente

# Instalar dependências Node
npm install

# Criar variáveis de ambiente
cp .env.example .env

# Executar em modo dev
npm run dev
```
- Aplicação web: `http://localhost:3000` ou `http://localhost:5173`

---

## 🌐 Deploy em Produção

### Web e backend na Vercel

O mesmo projeto Vercel `afiliate` publica o frontend Vite e a API Express. A função `api/index.ts` reutiliza `server.ts`; as rotas `/api/*` são encaminhadas para essa função por `vercel.json`. O build oficial é `npm run build`.

- Aplicativo web e links curtos: `https://lkrm.site`.
- `https://www.lkrm.site` redireciona permanentemente (308) para `https://lkrm.site`.
- API pública em produção: `https://api.lkrm.site/api/*` (após publicar a migração).
- API privada de teste: `https://api-preview.lkrm.site/api/*` (exige autenticação no Vercel).
- APK Android: URL padrão da API `https://api.lkrm.site`.
- `VITE_SHORT_DOMAIN=https://lkrm.site` é opcional; esse domínio já é o fallback.
- `VITE_API_URL` é opcional. A aplicação web usa chamadas relativas quando não há uma URL válida configurada; o APK usa `api.lkrm.site`. Builds novos ignoram qualquer valor legado do Render.

**Antes da ativação em produção:** validar API, URLs públicas do encurtador, OAuth e configurações de ambiente; concluir a implantação da branch de migração. O redirecionamento de domínio e os smoke tests da função não significam, por si só, que a migração já foi publicada na `main`.

### Deploy das Regras e Índices do Firebase (Firestore)
Para implantar as regras de segurança e os índices compostos no projeto Firebase CLI:

```bash
# Implantar apenas os índices compostos (necessário para a aba Marketplace Global)
firebase deploy --only firestore:indexes

# Implantar apenas as regras de segurança do Firestore
firebase deploy --only firestore:rules

# Implantar ambos
firebase deploy --only firestore
```

---

## 🔑 Variáveis de Ambiente

### Backend (`.env`)
```env
PORT=8000
GEMINI_API_KEY=sua_chave_gemini_opcional
ALIEXPRESS_APP_KEY=
ALIEXPRESS_APP_SECRET=
ALIEXPRESS_TRACKING_ID=
```

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:8000
```

---

## ⚡ Recursos Principais
- **Scraping Universal**: Suporte a Mercado Livre, Shopee, Amazon, AliExpress e Shein.
- **Copy Engine**: Templates dinâmicos com tags substituíveis (`{TITLE}`, `{PRICE_TO}`, `{COUPON}`, etc.).
- **Geração por IA (Gemini)**: Criação de gatilhos de urgência, oferta relâmpago e reviews sinceros sob medida.
- **WhatsApp Live Preview**: Visualização idêntica à do WhatsApp com botões de 1-clique para copiar texto e compartilhar.
- **Histórico & Templates Customizados**: Salve suas melhores ofertas e crie modelos de mensagens personalizados.
