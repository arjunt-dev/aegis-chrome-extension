# Aegis: Zero-Knowledge, AI-Driven Phishing URL Detector

Aegis is a privacy-first phishing detection system with a true zero-knowledge architecture. It consists of a FastAPI backend with a stacked ensemble ML model, a Manifest V3 Chrome Extension with client-side encryption, and an Android mobile app that intercepts URLs at the OS level.

---

## Architecture

- **Chrome Extension (MV3)** — React 19 + Vite 7 + Tailwind CSS 4.1 monorepo. Implements zero-knowledge auth: master key and `auth_hash` derived client-side using Argon2id (via `hash-wasm`) with PBKDF2-HMAC-SHA256 fallback. Vault data encrypted with AES-GCM (Web Crypto API) before syncing. Access tokens held in-memory only.
- **Mobile App (Android)** — React Native 0.81 / Expo SDK 54. Intercepts HTTP/HTTPS links via Android intent filters, checks local blocklist (AsyncStorage), and prompts users with risk-graded UI before opening URLs.
- **Backend** — Async FastAPI server with Tortoise ORM (SQLite), APScheduler for OTP cleanup, Redis rate limiting, and a 5-model stacked ensemble ML engine. Acts as an opaque repository: never receives raw passwords, only validates client-derived auth hashes via constant-time comparison.

---

## Directory Structure

```
aegis-project/
├── backend/
│   └── app/                    # FastAPI app
│       ├── main.py             # Entry point, CORS, middleware
│       ├── config.py           # DB, JWT, mail, model loading
│       ├── models.py           # Tortoise ORM: User, Otp, Vault
│       ├── schemas.py          # Pydantic v2 request/response models
│       ├── routes.py           # API endpoints (/api/*)
│       ├── security.py         # Auth, JWT, constant-time compare
│       ├── predict.py          # ML feature extraction & inference
│       ├── signals.py          # Post-save signals (OTP email)
│       ├── services.py         # fastapi-mail email service
│       ├── tasks.py            # APScheduler: expired OTP cleanup
│       ├── utils.py            # OTP generation, timezone helpers
│       ├── logging_config.py   # Rotating file + console logger
│       ├── phishing_model/     # Trained model & reference data
│       ├── dataset/            # Training datasets (LegitPhish, PhishTank, Umbrella)
│       ├── notebooks/          # Jupyter training notebook
│       └── scripts/            # Legacy training scripts
├── frontend/                   # Chrome extension monorepo
│   ├── packages/
│   │   ├── chrome-extension/   # React 19 popup UI
│   │   ├── background-worker/  # Service worker (esbuild)
│   │   ├── authentication/     # Auth flow UI
│   │   └── settings-ui/        # Options page
│   ├── static/                 # Manifest, icons, assets
│   └── aegis-dist/             # Built extension output
├── mobile-app/                 # React Native / Expo Android app
│   ├── app/                    # Expo Router file-based routing
│   ├── screens/                # Home, UrlAnalysis, BlockedUrls
│   ├── services/               # API client (prediction.ts)
│   ├── context/                # BlocklistContext
│   ├── storage/                # AsyncStorage blocklist
│   ├── types/                  # PredictionLabel, AnalysisResult, etc.
│   └── constants/              # Theme tokens
└── requirements-pipline.txt    # Pinned deps for ML training notebook
```

---

## Prerequisites

- Node.js ≥22, pnpm
- Python ≥3.12, uv
- Redis (backend rate limiting)
- Android Studio & JDK 17+ (mobile app)

---

## Setup

### 1. Backend

```bash
cd backend
uv sync
cp app/.env.example app/.env   # Fill in MAIL_USERNAME, MAIL_PASSWORD, REDIS_URL, SECRET_KEY
```

Start Redis (Docker):

```bash
docker run -d -p 6379:6379 redis:alpine
```

Initialize database:

```bash
cd app
uv run aerich init -t config.TORTOISE_ORM
uv run aerich init-db
uv run aerich upgrade
```

Run dev server:

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 5000
```

API docs: http://localhost:5000/docs

### 2. Chrome Extension

```bash
cd frontend
pnpm install
pnpm dev                  # Development with hot-reload
pnpm run build            # Production build → aegis-dist/
```

Install in Chrome: `chrome://extensions/` → Developer mode → Load unpacked → select `frontend/aegis-dist`.

### 3. Mobile App

```bash
cd mobile-app
pnpm install
# Update services/prediction.ts with your backend URL
pnpx expo run:android     # Requires development build (not Expo Go)
```

Configure as default browser: Android Settings → Apps → Default Apps → Browser App → Aegis.

---

## API Endpoints

| Endpoint                 | Auth   | Description                                              |
| ------------------------ | ------ | -------------------------------------------------------- |
| `POST /api/predict`    | No     | Analyze a URL → Safe / Suspicious / Phishing            |
| `POST /api/pre-login`  | No     | Fetch PBKDF2 salt for client-side key derivation         |
| `POST /api/signup`     | No     | Register (client sends auth_hash + encrypted master key) |
| `POST /api/login`      | No     | Authenticate (client sends auth_hash, never password)    |
| `POST /api/refresh`    | No     | Rotate access/refresh tokens                             |
| `POST /api/verify-otp` | No     | Verify OTP for account activation                        |
| `POST /api/logout`     | No     | Invalidate session                                       |
| `GET /api/vault`       | Bearer | Retrieve encrypted vault blob                            |
| `POST /api/vault`      | Bearer | Store encrypted vault blob                               |

### Prediction

```json
// POST /api/predict  { "url": "https://example.com" }
{
  "prediction": "Safe",
  "confidence": 0.97
}
```

**Prediction labels:** `Safe`, `Suspicious`, `Phishing`

---

## ML Model

Stacked ensemble trained on 100K+ URLs (LegitPhish + PhishTank + Umbrella Top 1M):

- **Base models:** CatBoost, Extra Trees, Random Forest, TF-IDF + Logistic Regression
- **Meta-learner:** Logistic Regression (scaled)
- **Risk bands:** configurable thresholds mapping probability → Safe / Suspicious / Phishing

### Features (~32)

URL length, entropy (Shannon), IP detection, brand lookalike (RapidFuzz Levenshtein + ratio), hostname token statistics, suspicious keyword detection, TLD popularity, known domain reputation, digit runs, punycode detection, URL shortener check, phishing domain similarity, brand-keyword combinations, `@` symbol count, and more.

---

## Security

- **Zero-knowledge auth**: Argon2id (64 MiB, 3 iterations) or PBKDF2-HMAC-SHA256 (600K iterations) derived client-side. The server never handles raw passwords.
- **AES-GCM encryption**: Vault data encrypted client-side before sync. Server stores only opaque ciphertext.
- **Constant-time verification**: `secrets.compare_digest` prevents timing-based enumeration.
- **Ephemeral tokens**: Access tokens in memory only; refresh tokens and wrapped master key JWK in session storage.

---

## Troubleshooting

- **Redis**: `redis-cli ping` to verify. Check `REDIS_URL` in `.env`.
- **Database**: Run `uv run aerich init-db` or delete `db.sqlite3` and re-run migrations.
- **Mobile interception**: Ensure development build (not Expo Go) is installed and Aegis is set as default browser.
- **Mail**: Use a Gmail App Password with 2-Step Verification enabled.

---

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/arjunt-dev/aegis-chrome-extension)

## License

Unlicensed — All rights reserved.

Created by Arjun T.
