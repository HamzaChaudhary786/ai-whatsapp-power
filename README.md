# 👗 WhatsApp AI Fashion Assistant

A production-ready conversational AI assistant for fashion retail, integrating Meta's WhatsApp Cloud API, FastAPI, MongoDB (Motor), custom ML intent classifiers, LLM recommendation agents, and a React management dashboard.

---

## 📁 Project Structure

```text
whatsapp-ai-fashion/
│
├── backend/                  # FastAPI Application & MongoDB Services
│   ├── config/               # Settings & Environment Configuration
│   │   └── settings.py
│   ├── db/                   # MongoDB Async Connection via Motor
│   │   └── mongodb.py
│   ├── models/               # Pydantic & Document Models (User, Customer)
│   │   ├── user_model.py
│   │   └── customer_model.py
│   ├── controllers/          # Business Logic Handlers
│   │   ├── auth_controller.py
│   │   ├── user_controller.py
│   │   └── whatsapp_controller.py
│   ├── routes/               # API Endpoints
│   │   ├── auth_routes.py
│   │   ├── user_routes.py
│   │   └── whatsapp_routes.py
│   ├── utils/                # Security (Bcrypt, JWT) & Response Helpers
│   │   ├── security.py
│   │   └── response.py
│   ├── integrations/         # WhatsApp Cloud API Client
│   │   └── whatsapp.py
│   ├── ai/                   # NLP Intent Model & Fashion Assistant
│   │   ├── intent_model.py
│   │   └── assistant.py
│   ├── tests/                # Automated Tests
│   ├── main.py               # FastAPI App & Lifespan Hooks
│   ├── requirements.txt      # Python Dependencies (FastAPI, Motor, Pydantic)
│   └── .env.example          # Environment Variables Template
│
├── frontend/                 # Admin Dashboard & Analytics (React/Vite)
│   ├── src/
│   │   ├── api/              # Backend Client
│   │   ├── components/       # Reusable UI Components
│   │   ├── layouts/          # Dashboard Layouts
│   │   ├── pages/            # Views (Chats, Catalog, Analytics)
│   │   └── hooks/            # Custom React Hooks
│   └── package.json
│
├── ml/                       # Machine Learning & NLP Pipeline
│   ├── data/                 # Training & Evaluation Datasets
│   ├── notebooks/            # Exploratory Data Analysis & Prototyping
│   ├── src/                  # ML Training & Evaluation Scripts
│   │   ├── train_intent.py
│   │   └── evaluate_intent.py
│   └── artifacts/            # Serialized Models & Scalers
│
├── docs/                     # Specifications & Architecture Docs
│   ├── requirements.md
│   ├── architecture.md
│   └── data_dictionary.md
│
├── docker-compose.yml        # Docker Multi-container Orchestration (Mongo, Backend, Frontend)
└── README.md
```

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run FastAPI Server
uvicorn main:app --reload --port 8000
```

- API Docs: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/health`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Docker Compose (Full Stack with MongoDB)

```bash
docker-compose up --build
```
