# Aegis: Privacy-First Phishing Detection System

Aegis is a zero-knowledge, AI-powered system designed to detect and block phishing URLs in real-time. The project consists of three main components:

1. An asynchronous FastAPI backend with an integrated Machine Learning model.
2. A Manifest V3 Chrome Extension that encrypts user data client-side before synchronization.
3. An Android mobile application built with React Native and Expo that intercepts URLs at the system level.

---

## Project Architecture

Aegis uses a three-tier architecture:

- Chrome Extension / Frontend: Written in React 18, Vite, and Tailwind. It performs client-side encryption using the Web Crypto API (AES-GCM, PBKDF2) so that user vaults remain secure and private.
- Mobile Application: Written in React Native and Expo. It handles OS-level intent filters to intercept HTTP/HTTPS links, checks a local blocklist, and prompts users before opening URLs.
- Backend: An async FastAPI server that hosts the ML threat detection engine, manages JWT-based user authentication, and provides encrypted vault storage. It uses SQLite for persistence and Redis for rate-limiting.

---

## Directory Structure

aegis-project/
├── backend/                  # FastAPI prediction and authentication backend
│   └── app/                  # Application code, ML models, and configuration
├── frontend/                 # Chrome extension monorepo
│   ├── packages/             # React packages for auth, settings, and popup UI
│   ├── static/               # Manifest files and assets
│   └── aegis-dist/           # Compiled extension output
└── mobile-app/               # React Native Android app (Expo build)
    ├── app/                  # File-based routing setup
    ├── screens/              # UI screens (Home, Analysis, Blocked List)
    ├── components/           # UI components
    ├── hooks/                # URL interception and analysis hooks
    └── services/             # API integration

---

## Prerequisites

To run and develop the Aegis system, the following tools are required:

- Node.js (version 22 or higher)
- pnpm (package manager for frontend)
- Python (version 3.12 or higher)
- uv (Python package installer)
- Redis (for backend rate limiting)
- Git (for version control)
- Android Studio & JDK 17+ (for building the mobile app)

---

## Installation and Setup

### 1. FastAPI Backend Setup

First, navigate to the backend directory:

```bash
cd backend
```

Ensure uv is installed:

```bash
pip install uv
```

Install the backend dependencies:

```bash
uv sync
```

Configure  environment variables. Copy the example template:

```bash
cp app/.env.example app/.env
```

Open the newly created `app/.env` file and fill in the required settings:

- MAIL_USERNAME and MAIL_PASSWORD: Use  Gmail address and a Gmail App Password if wanted for OTP email verification.
- REDIS_URL: Typically set to redis://localhost:6379.
- SECRET_KEY: A secure random string for signing JWT tokens.

Start Redis server.  It can be run locally or via Docker:

```bash
# Via Docker
docker run -d -p 6379:6379 redis:alpine
```

Initialize the database and run migrations:

```bash
cd app
uv run aerich init -t config.TORTOISE_ORM
uv run aerich init-db
```

Start the development server:

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 5000
```

The API documentation will be available locally at: http://localhost:5000/docs

### 2. Chrome Extension Setup

Go to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
pnpm install
```

To run the extension in development mode with hot-reloading:

```bash
pnpm dev
```

To build a production version:

```bash
pnpm run build
```

The built files will be outputted to `frontend/aegis-dist`.

To install the extension in Chrome:

1. Open Chrome and head to chrome://extensions/
2. Toggle "Developer mode" in the top-right corner.
3. Click "Load unpacked" in the top-left corner.
4. Select the `frontend/aegis-dist` directory.

### 3. Mobile App (Android) Setup

Go to the mobile-app directory:

```bash
cd mobile-app
```

Install dependencies:

```bash
pnpm install
```

Configure the API base URL in `services/prediction.ts`. Update the API_BASE_URL variable to point to the backend

- If testing on the Android Emulator, use: http://10.0.2.2:5000 (assuming the backend runs on port 5000)
- If testing on a physical device, use machine's local IP: e.g. http://192.168.x.x:5000

Because the app registers Android intent filters at the native level, it requires a development build rather than Expo Go.

Build and run locally:

```bash
pnpx expo run:android
```

Alternatively, build using EAS:

```bash
pnpx eas build --platform android --profile development
```

Once installed, configure Aegis as default browser under Android Settings -> Apps -> Default Apps -> Browser App. This ensures Aegis intercepts links clicked in other applications.

---

## Android Interception & User Flow

When a user clicks a link in another app:

1. Aegis intercepts the click and launches its URL Analysis screen.
2. It checks the local SQLite/AsyncStorage blocklist. If the link is blocked, it shows a warnings page.
3. If not blocked, it makes an API request to the backend (/predict endpoint).
4. The prediction result determines the screen state:
   - Safe (Teal UI): Let the user proceed to open the URL, block it, or cancel.
   - Suspicious (Yellow UI): Warns the user, offering options to open with caution, block, or cancel.
   - Phishing (Red UI): Disables the default "open" action, allowing only "block" or "cancel" (an override is hidden for advanced users).

### Deep Link Testing

Users can also launch Aegis manually using this deep link structure:

```
aegis://analyze?url=https://example.com
```

Alternatively, test via ADB command:

```bash
adb shell am start \
  -a android.intent.action.VIEW \
  -d "https://suspicious-example.com" \
  com.aegis.shield
```

---

## Machine Learning Model

Aegis uses a stacked ensemble model:

- Level 1: CatBoost, Extra Trees, Random Forest, and Logistic Regression.
- Level 2: Logistic Regression (Meta-classifier combining the base predictions).

The model is trained on over 100,000 URLs from the LegitPhish dataset. It extracts 16 features from every checked URL, including:

- url_length: Total characters.
- has_ip_address: Checks if an IP is used instead of a domain.
- dot_count: Number of dots in the URL.
- https_flag: Protocol check.
- url_entropy: Shannon entropy.
- token_count, subdomain_count, query_param_count, path_length, domain_name_length, and character statistics.

The API response for URL validation is structured as follows:

- Endpoint: POST /api/predict
- Request payload:

  ```json
  {
    "url": "https://example.com"
  }
  ```
- Response payload:

  ```json
  {
    "prediction": 1,
    "confidence": 0.95
  }
  ```

  Where prediction value is:- -1: Safe

  - 0: Suspicious
  - 1: Phishing

The mobile app maps various backend responses (like safe, legitimate, benign to SAFE; suspicious to SUSPICIOUS; and phishing, malicious, fraud to PHISHING).

---

## Security & Privacy

- Client-Side Encryption: Encrypts vault data using AES-GCM and derives keys using PBKDF2 from password in-browser. The backend only sees encrypted blobs.
- Secure Hashing: Password storage uses Argon2-cffi.
- Stateless Sessions: Uses JWT tokens with 15-minute access expiration and automatic refresh tokens.

---

## Troubleshooting

### Redis Connection Error

If Redis connection fails, check if Redis server is active:

```bash
redis-cli ping
```

Make sure the REDIS_URL in the backend `.env` matches the connection details.

### Mail Delivery Failures

If OTP emails are failing to send, ensure using Google App Password and that the Google account has 2-Step Verification active.

### Missing Tables or Database Errors

On database errors (e.g., table not found), run:

```bash
uv run aerich init-db
```

Or, delete `db.sqlite3` in the backend folder and run the migration commands again.

### Mobile App Link Interception Issues

If links are not opening in Aegis, ensure that:

- The development client (`pnpx expo run:android`) has been built and not the Expo Go app.
- Aegis has been selected as the default browser in Android Settings.
- The scheme and intent filter setup in `app.json` has been updated in the built APK.
- AsyncStorage issues can usually be resolved by clearing the application's data.

---

## License & Contributors

This project is currently unlicensed. All rights reserved.

Created by Arjun T.
