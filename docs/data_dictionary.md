# 📖 Data Dictionary (MongoDB Collections)

### 1. `users` Collection
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId / String | Yes | MongoDB Document ID |
| `email` | String | Yes | Unique user email address |
| `password_hash` | String | Yes | Bcrypt hashed password |
| `role` | String | Yes | `USER`, `ADMIN`, `STAFF` |
| `is_active` | Boolean | Yes | Account active status (default: `true`) |
| `created_at` | ISODate | Yes | Document creation timestamp |

### 2. `whatsapp_messages` Collection
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Unique Message ID |
| `sender` / `recipient` | String | Yes | Phone number in E.164 format |
| `direction` | String | Yes | `inbound` or `outbound` |
| `message` | String | Yes | Message content body |
| `detected_intent` | String | No | Intent predicted by NLP/ML engine |
| `created_at` | ISODate | Yes | Message timestamp |

### 3. `products` Collection
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Product ID |
| `sku` | String | Yes | Stock keeping unit code |
| `name` | String | Yes | Product title |
| `category` | String | Yes | Fashion category (e.g., `dresses`, `tops`) |
| `price` | Number | Yes | Product retail price |
| `stock_quantity` | Number | Yes | In-stock inventory count |
