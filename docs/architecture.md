# 🏗️ System Architecture

```mermaid
flowchart TD
    User["Customer (WhatsApp App)"]
    Meta["Meta WhatsApp Cloud API"]
    
    subgraph Backend ["FastAPI Backend"]
        Webhook["/api/v1/whatsapp/webhook"]
        Service["Conversation Service"]
        IntentAI["Intent Classifier (ML/NLP)"]
        Assistant["Fashion AI Assistant (LLM)"]
        DB[(MongoDB)]
        Cache[(Redis)]
    end

    subgraph Frontend ["React Admin Dashboard"]
        UI["Admin Console"]
    end

    User <-->|Chat Messages| Meta
    Meta <-->|Webhooks & Graph API| Webhook
    Webhook --> Service
    Service <--> IntentAI
    Service <--> Assistant
    Service <--> DB
    Service <--> Cache
    UI <-->|REST API| Backend
```

## Architectural Highlights
- **FastAPI Core**: Lightweight asynchronous ASGI web server.
- **Service & Repository Pattern**: Clean decoupling between HTTP layer, business logic, and database queries.
- **Modular AI Layer**: Dedicated modules for lightweight intent detection and LLM-driven fashion styling dialogue.
