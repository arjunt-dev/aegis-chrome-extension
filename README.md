# 🛡️ Aegis - Privacy-First Phishing Detection

> **A zero-knowledge, AI-powered Chrome extension that detects and blocks phishing URLs in real-time**

Aegis is a privacy-focused security solution built with modern web technologies, featuring end-to-end encryption, machine learning-based threat detection, and a seamless user experience. All sensitive data is encrypted client-side before transmission, ensuring true zero-knowledge architecture.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Chrome Extension Installation](#chrome-extension-installation)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [ML Model](#-ml-model)
- [Security](#-security)
- [Development](#-development)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### 🔐 Security & Privacy
- **Zero-Knowledge Architecture**: All sensitive data encrypted using AES-GCM in-browser before transmission
- **Client-Side Encryption**: Master keys never leave the user's device in plaintext
- **Argon2 Password Hashing**: Industry-standard secure password storage
- **JWT Authentication**: Stateless authentication with access and refresh tokens
- **PBKDF2 Key Derivation**: Secure key derivation from user passwords

### 🤖 Machine Learning
- **Real-Time Phishing Detection**: Instant URL analysis using ensemble ML models
- **High Accuracy**: Stacked classifier combining CatBoost, Extra Trees, Random Forest, and Logistic Regression
- **Feature-Rich Analysis**: 16+ URL features including entropy, domain characteristics, and suspicious patterns
- **Trained on 100k+ URLs**: LegitPhish dataset for robust threat detection

### 🚀 User Experience
- **Instant Predictions**: Fast URL risk assessment with confidence scores
- **URL Blocking**: Automatically block suspicious URLs
- **Prediction History**: Track and review past URL checks
- **Sync Across Devices**: Cloud-synced blocklists for logged-in users
- **OTP Email Verification**: Secure account activation via email OTP

### ⚙️ Technical Excellence
- **Manifest V3 Compliant**: Latest Chrome extension standards
- **Background Service Worker**: Efficient API proxying and storage management
- **Rate Limiting**: Redis-backed rate limiting for API protection
- **Automatic Token Refresh**: Seamless authentication experience
- **Monorepo Architecture**: Clean separation of concerns with pnpm workspaces

---

## 🏗️ Architecture

Aegis follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension (Frontend)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Popup UI   │  │  Settings UI │  │   Auth UI    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           │                                  │
│                  ┌────────▼────────┐                         │
│                  │ Background      │                         │
│                  │ Service Worker  │                         │
│                  │ (API Proxy +    │                         │
│                  │  Encryption)    │                         │
│                  └────────┬────────┘                         │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTPS
                  ┌─────────▼──────────┐
                  │   FastAPI Backend  │
                  │  ┌──────────────┐  │
                  │  │  ML Engine   │  │
                  │  ├──────────────┤  │
                  │  │  Auth System │  │
                  │  ├──────────────┤  │
                  │  │  Vault API   │  │
                  │  └──────────────┘  │
                  │         │           │
                  │  ┌──────▼──────┐   │
                  │  │   SQLite    │   │
                  │  └─────────────┘   │
                  └────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │   Redis (Rate      │
                  │   Limiting)        │
                  └────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern async web framework with automatic OpenAPI docs
- **Tortoise ORM** - Async ORM for database operations
- **SQLite** - Lightweight database for data persistence
- **Redis** - In-memory store for rate limiting
- **Argon2-cffi** - Secure password hashing
- **PyJWT** - JSON Web Token implementation
- **Pydantic** - Data validation and settings management
- **FastAPI-Mail** - Email service for OTP delivery
- **APScheduler** - Background task scheduling (OTP cleanup)
- **FastAPI-Limiter** - Rate limiting middleware

### Frontend
- **React 18** - UI library with TypeScript
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server
- **Axios** - HTTP client with interceptors
- **pnpm** - Fast, disk space efficient package manager
- **Monorepo** - Multiple packages in a single repository

### Machine Learning
- **Scikit-Learn 1.6.1** - Core ML library
- **CatBoost** - Gradient boosting library
- **pandas** - Data manipulation and analysis
- **joblib** - Model serialization
- **Ensemble Learning** - Stacked classifier approach
  - Base Models: LogisticRegression, ExtraTrees, RandomForest, CatBoost
  - Meta Model: LogisticRegression

### Chrome Extension
- **Manifest V3** - Latest Chrome extension specification
- **Web Crypto API** - Browser-native cryptography (AES-GCM, PBKDF2)
- **Service Workers** - Background script architecture
- **Chrome Storage API** - Persistent local storage
- **Declarative Net Request** - URL blocking capabilities

---

## 📦 Prerequisites

### Required
- **Python 3.12+** - Backend runtime
- **Node.js 22+** - Frontend runtime
- **pnpm** - Package manager for frontend
- **uv** - Fast Python package installer
- **Redis** - For rate limiting (or use Docker)
- **Git** - Version control

### Optional
- **Docker** - For containerized services
- **Gmail Account** - For OTP email delivery (with App Password)

---

## 🚀 Installation

### Backend Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/arjunt-dev/aegis-chrome-extension.git
   cd aegis-chrome-extension/backend
   ```

2. **Install uv (Python Package Installer)**
   ```bash
   pip install uv
   ```

3. **Install Dependencies**
   ```bash
   uv sync
   ```

4. **Configure Environment Variables**
   
   Create a `.env` file in `backend/app/`:
   ```bash
   cp app/.env.example app/.env
   ```
   
   Edit `app/.env` with your credentials:
   ```env
   # Email Configuration (Gmail)
   MAIL_USERNAME=your-email@gmail.com
   MAIL_PASSWORD=your-app-password  # Get from Gmail Security Settings
   
   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   
   # Security
   SECRET_KEY=your-super-secret-key-change-this-in-production
   DEBUG=True
   ```

5. **Start Redis Server**
   ```bash
   # Option 1: Local Redis
   redis-server
   
   # Option 2: Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

6. **Run Database Migrations**
   ```bash
   cd app
   uv run aerich init -t config.TORTOISE_ORM
   uv run aerich init-db
   ```

7. **Start the Backend Server**
   ```bash
   # From backend/app directory
   uv run uvicorn main:app --reload --host 0.0.0.0 --port 5000
   ```

   The API will be available at: `http://localhost:5000`
   
   API Documentation: `http://localhost:5000/docs`

### Frontend Setup

1. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Install pnpm (if not already installed)**
   ```bash
   npm install -g pnpm
   ```

3. **Install Dependencies**
   ```bash
   pnpm install
   ```

4. **Build the Extension**
   ```bash
   # Production build
   pnpm run build
   
   # Development mode (with hot reload)
   pnpm dev
   ```

   The built extension will be in `frontend/aegis-dist/`

### Chrome Extension Installation

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load Unpacked Extension**
   - Click "Load unpacked"
   - Select the `frontend/aegis-dist` folder

3. **Verify Installation**
   - The Aegis icon should appear in your Chrome toolbar
   - Click it to open the extension popup

4. **First Time Setup**
   - Click on the extension icon
   - Sign up for a new account
   - Verify your email with the OTP sent to your inbox
   - Start protecting yourself from phishing!

---

## 🔧 Environment Variables

### Backend (`backend/app/.env`)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SECRET_KEY` | JWT signing key | Yes | - |
| `DEBUG` | Enable debug mode | No | `True` |
| `MAIL_USERNAME` | Gmail address for OTP | Yes | - |
| `MAIL_PASSWORD` | Gmail app password | Yes | - |
| `MAIL_SERVER` | SMTP server | No | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | No | `587` |
| `REDIS_URL` | Redis connection URL | Yes | `redis://localhost:6379` |

### Getting Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification
3. Go to "App passwords"
4. Generate a new app password for "Mail"
5. Use this 16-character password in your `.env` file

---

## 📚 API Documentation

Once the backend is running, visit `http://localhost:5000/docs` for interactive API documentation.

### Key Endpoints

#### Authentication
- **POST** `/api/signup` - Create new user account
- **POST** `/api/login` - Authenticate user
- **POST** `/api/verify-otp` - Verify email with OTP
- **POST** `/api/refresh` - Refresh access token
- **POST** `/api/logout` - Logout user

#### Prediction
- **POST** `/api/predict` - Analyze URL for phishing
  ```json
  {
    "url": "https://example.com"
  }
  ```
  Response:
  ```json
  {
    "prediction": 1,      // -1: Safe, 0: Suspicious, 1: Phishing
    "confidence": 0.95    // Confidence score (0-1)
  }
  ```

#### Vault (Encrypted Storage)
- **GET** `/api/vault` - Retrieve encrypted vault data
- **POST** `/api/vault` - Update encrypted vault data

### Rate Limits
- Signup: 5 requests per 5 minutes
- Prediction: 20 requests per minute

---

## 🧠 ML Model

### Architecture: Stacked Ensemble Classifier

Aegis uses a two-level stacking approach for maximum accuracy:

**Level 1 - Base Models:**
1. **CatBoost** - Handles categorical features well
2. **Extra Trees** - Reduces overfitting through randomization
3. **Random Forest** - Robust ensemble method
4. **Logistic Regression** - Linear baseline model

**Level 2 - Meta Model:**
- **Logistic Regression** - Combines base model predictions

### Features Extracted (16 total)

| Feature | Description |
|---------|-------------|
| `url_length` | Total characters in URL |
| `has_ip_address` | Contains IP instead of domain |
| `dot_count` | Number of dots in URL |
| `https_flag` | Uses HTTPS protocol |
| `url_entropy` | Shannon entropy of URL |
| `token_count` | Number of tokens in URL |
| `subdomain_count` | Number of subdomains |
| `query_param_count` | Number of query parameters |
| `tld_length` | Length of TLD |
| `path_length` | Length of URL path |
| `has_hyphen_in_domain` | Hyphen in domain name |
| `number_of_digits` | Count of numeric characters |
| `tld_popularity` | TLD in common list |
| `suspicious_file_extension` | Suspicious file extension |
| `domain_name_length` | Length of domain |
| `percentage_numeric_chars` | Ratio of numbers to total chars |

### Dataset
- **Source**: LegitPhish
- **Size**: 100,000+ URLs
- **Classes**: Legitimate vs Phishing

### Prediction Output
- **-1**: Safe (Confidence in legitimacy)
- **0**: Suspicious (Low phishing probability < 40%)
- **1**: Phishing (High phishing probability ≥ 40%)

---

## 🔒 Security

### Zero-Knowledge Architecture

1. **Client-Side Encryption**
   - User password → PBKDF2 → Encryption Key
   - Master User Key generated locally
   - All vault data encrypted with AES-GCM before transmission

2. **Server-Side Security**
   - Passwords hashed with Argon2 (never stored in plaintext)
   - Only encrypted data received and stored
   - Server cannot decrypt user vault data

3. **Authentication Flow**
   - JWT-based stateless authentication
   - Access tokens (15 min expiry)
   - Refresh tokens (30 day expiry)
   - Automatic token rotation

4. **Additional Protections**
   - CORS protection
   - Rate limiting (Redis-backed)
   - Input validation (Pydantic)
   - SQL injection prevention (ORM)
   - XSS protection

---

## 💻 Development

### Backend Development

```bash
cd backend/app
uv run uvicorn main:app --reload --port 5000
```

### Frontend Development

```bash
cd frontend
pnpm dev
```

This starts all packages in watch mode. Changes to the extension will require a manual reload in `chrome://extensions`.

### Building for Production

```bash
# Backend
cd backend
uv sync --no-dev

# Frontend
cd frontend
pnpm run build
```

### Database Migrations

```bash
cd backend/app
# Create new migration
uv run aerich migrate --name describe_change

# Apply migrations
uv run aerich upgrade
```

### Running Tests

```bash
# Backend (if tests are implemented)
cd backend
uv run pytest

# Frontend (if tests are implemented)
cd frontend
pnpm test
```

---

## 📁 Project Structure

```
aegis-chrome-extension/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry
│   │   ├── config.py            # Configuration and settings
│   │   ├── models.py            # Database models
│   │   ├── routes.py            # API endpoints
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── security.py          # Auth logic
│   │   ├── predict.py           # ML prediction engine
│   │   ├── services.py          # Email service
│   │   ├── signals.py           # Database signals
│   │   ├── tasks.py             # Background tasks
│   │   ├── utils.py             # Utility functions
│   │   ├── logging_config.py    # Logger setup
│   │   ├── .env.example         # Environment template
│   │   ├── phishing_model/
│   │   │   ├── Base_Ensemble.joblib
│   │   │   └── Meta_LR.joblib
│   │   └── dataset/
│   │       └── LegitPhish.csv
│   └── pyproject.toml           # Python dependencies
├── frontend/
│   ├── packages/
│   │   ├── authentication/      # Auth UI package
│   │   ├── chrome-extension/    # Main popup UI
│   │   ├── settings-ui/         # Settings page
│   │   └── background-worker/   # Service worker
│   ├── static/
│   │   └── manifest.json        # Extension manifest
│   ├── aegis-dist/              # Built extension (output)
│   ├── package.json             # Root package config
│   └── pnpm-workspace.yaml      # Monorepo config
└── README.md                    # This file
```

---

## 🐛 Troubleshooting

### Backend Issues

**Redis Connection Error**
```
Error: Redis connection failed
```
- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check `REDIS_URL` in `.env`
- Install Redis: `brew install redis` (Mac) or `apt install redis` (Linux)

**Email Not Sending**
```
Error: Failed to send OTP
```
- Verify Gmail credentials in `.env`
- Ensure you're using an App Password, not your regular password
- Check Gmail account has 2FA enabled

**Database Errors**
```
Error: No such table
```
- Run migrations: `uv run aerich init-db`
- Delete `db.sqlite3` and re-run migrations

### Frontend Issues

**Extension Not Loading**
```
Error: Manifest file missing or invalid
```
- Ensure you built the extension: `pnpm build`
- Load `frontend/aegis-dist` folder, not `frontend`

**API Connection Failed**
```
Error: Network error
```
- Verify backend is running on `http://localhost:5000`
- Check CORS settings in `backend/app/main.py`
- Ensure extension has host permissions in manifest

**Build Errors**
```
Error: Module not found
```
- Delete `node_modules`: `rm -rf node_modules`
- Reinstall: `pnpm install`
- Clear cache: `pnpm store prune`


## 📄 License

This project is currently unlicensed. All rights reserved.

---

## 👨‍💻 Author

**Arjun T**
- GitHub: [@arjunt-dev](https://github.com/arjunt-dev)

---

## 🙏 Acknowledgments

- LegitPhish dataset for training data
- FastAPI community for excellent documentation
- Chrome Extensions team for Manifest V3

---

**⚠️ Disclaimer**: This extension is provided as-is for educational and personal use. While it uses machine learning to detect phishing URLs, no system is 100% accurate. Always exercise caution when browsing unfamiliar websites.

---

Made with ❤️ and ☕ by Arjun T