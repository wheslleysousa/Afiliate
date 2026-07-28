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

### Deploy do Backend no Render (Free Tier)
1. Conecte o repositório no **Render** (`render.com`).
2. Selecione **Web Service** com diretório raiz `backend`.
3. Defina o comando de Build: `pip install -r requirements.txt`.
4. Defina o comando de Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. *(Opcional)* Configure um monitor no **UptimeRobot** pingando `https://seu-backend.onrender.com/health` a cada 5 minutos para evitar cold start.

### Deploy do Frontend no Netlify (Free Tier)
1. Importe o repositório no **Netlify** (`netlify.com`).
2. Defina o Base Directory como `frontend`.
3. Defina o Build command como `npm run build` e o Publish directory como `frontend/dist` (ou `dist`).
4. Adicione a variável de ambiente:
   - `VITE_API_URL` = `https://seu-backend.onrender.com`

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
