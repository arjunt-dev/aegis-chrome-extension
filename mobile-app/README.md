# AEGIS — Secure URL Interceptor & Phishing Detection Gateway

> A React Native (Expo Development Build) Android application that intercepts URLs from any app, analyzes them via a FastAPI ML backend, and lets users decide whether to open, block, or cancel.

---

## Architecture Overview

```
aegis-project/
├── backend/                    # FastAPI phishing prediction backend
│   └── app/                    # POST /predict endpoint
└── mobile-app/                 # React Native Expo app (THIS)
    ├── app/                    # Expo Router file-based routing
    │   ├── _layout.tsx         # Root layout — providers + URL interception
    │   ├── url-analysis.tsx    # URL Analysis modal screen (intent target)
    │   └── (tabs)/
    │       ├── _layout.tsx     # Bottom tab navigator
    │       ├── index.tsx       # Home tab
    │       └── blocked.tsx     # Blocked URLs tab
    ├── screens/                # Screen components
    │   ├── HomeScreen.tsx
    │   ├── UrlAnalysisScreen.tsx
    │   └── BlockedUrlsScreen.tsx
    ├── components/             # Reusable UI components
    │   ├── GlassCard.tsx
    │   ├── ActionButton.tsx
    │   ├── PredictionBadge.tsx
    │   ├── ConfidenceMeter.tsx
    │   ├── UrlInfoCard.tsx
    │   └── Header.tsx
    ├── context/
    │   └── BlocklistContext.tsx # Global blocklist state (Context API)
    ├── hooks/
    │   ├── useIncomingUrl.ts   # Android URL interception handler
    │   └── useUrlAnalysis.ts   # API call state management
    ├── services/
    │   └── prediction.ts       # FastAPI /predict integration
    ├── storage/
    │   └── blocklist.ts        # AsyncStorage CRUD for blocked URLs
    ├── utils/
    │   └── url.ts              # URL helpers, formatting, color mapping
    ├── types/
    │   └── index.ts            # TypeScript type definitions
    ├── constants/
    │   └── theme.ts            # AEGIS color/spacing/typography tokens
    └── app.json                # Android intent filters configured
```

---

## Prerequisites

| Tool           | Version |
| -------------- | ------- |
| Node.js        | ≥ 18   |
| pnpm           | ≥ 9    |
| Expo CLI       | ≥ 0.22 |
| Android Studio | Latest  |
| JDK            | 17+     |

---

## Setup & Installation

### 1. Clone and install dependencies

```bash
cd mobile-app
pnpm install
```

### 2. Configure the API base URL

Edit `services/prediction.ts`:

```ts
// For Android Emulator (accessing host machine localhost)
const API_BASE_URL = 'http://10.0.2.2:8000';

// For physical device on same Wi-Fi
const API_BASE_URL = 'http://192.168.X.X:8000';  // your machine's local IP
```

### 3. Start the FastAPI backend

```bash
cd ../backend
# Ensure backend is running on port 8000
# The app will POST to: POST /predict
# Body: { "url": "https://example.com" }
# Response: { "prediction": "safe|suspicious|phishing", "confidence": 0.92 }
```

---

## Building for Android (Development Build)

AEGIS requires a **development build** (not Expo Go) because it registers Android intent filters at the native level.

### Step 1: Create a development build

```bash
# Using EAS Build (recommended)
npx eas build --platform android --profile development

# OR build locally (requires Android Studio)
npx expo run:android
```

### Step 2: Install the APK on your device

```bash
adb install path/to/aegis-debug.apk
```

### Step 3: Set AEGIS as default browser (for URL interception)

1. Go to **Settings → Apps → Default Apps → Browser App**
2. Select **AEGIS** from the list

> Alternatively: Open any link from WhatsApp/Gmail/SMS and tap **"AEGIS"** in the app chooser dialog.

---

## Android Intent Filter Configuration

The `app.json` registers the following intent filters:

```json
"intentFilters": [
  {
    "action": "VIEW",
    "autoVerify": true,
    "data": [
      { "scheme": "http" },
      { "scheme": "https" }
    ],
    "category": ["BROWSABLE", "DEFAULT"]
  },
  {
    "action": "VIEW",
    "data": [{ "scheme": "aegis" }],
    "category": ["BROWSABLE", "DEFAULT"]
  }
]
```

This causes Android to offer AEGIS as a handler whenever a user clicks an HTTP or HTTPS URL from any application.

---

## User Flow

```
User clicks URL in WhatsApp/Gmail/SMS/etc.
        ↓
Android shows app chooser → User selects AEGIS
        ↓
AEGIS opens → checks local blocklist
        ↓
  [Blocked?] → Shows "Blocked URL" screen → Override/Cancel
        ↓
  [Not blocked] → POSTs URL to FastAPI /predict
        ↓
  [API error] → Shows error screen → Retry/Open Anyway/Cancel
        ↓
  [Result] → Shows analysis screen:
             - SAFE (teal) → Open URL / Block / Cancel
             - SUSPICIOUS (yellow) → Open with caution / Block / Cancel
             - PHISHING (red) → Block / Cancel (open hidden as override)
```

---

## Deep Link Format

You can also trigger AEGIS programmatically:

```
aegis://analyze?url=https://example.com
```

This is useful for testing without setting AEGIS as the default browser.

---

## Testing the Analysis Screen

From within the app, tap **"Test Analysis"** on the Home screen. This opens the analysis screen with `https://example.com` and runs a live API call.

To test a specific URL via ADB:

```bash
adb shell am start \
  -a android.intent.action.VIEW \
  -d "https://suspicious-example.com" \
  com.aegis.shield
```

---

## API Contract

**Endpoint:** `POST /predict`

**Request:**

```json
{ "url": "https://example.com" }
```

**Response:**

```json
{
  "prediction": "phishing",
  "confidence": 0.92
}
```

Accepted `prediction` values (case-insensitive):

- `safe`, `legitimate`, `benign` → mapped to **SAFE**
- `suspicious` → mapped to **SUSPICIOUS**
- `phishing`, `malicious`, `fraud` → mapped to **PHISHING**

---

## Local Blocklist

- **Storage:** `@react-native-async-storage/async-storage`
- **Key:** `@aegis:blocked_urls`
- **Format:** JSON array of `BlockedUrl` objects
- **Operations:** add, remove, check, clear all
- **Persistence:** survives app restarts

---

## Screens

| Screen       | Route                     | Description                       |
| ------------ | ------------------------- | --------------------------------- |
| Home         | `/(tabs)/`              | Branding, setup guide, stats      |
| Blocked URLs | `/(tabs)/blocked`       | Manage the local blocklist        |
| URL Analysis | `/url-analysis?url=...` | Analysis results + action buttons |

---

## Theme

```
Background Primary:   #0b0f14
Background Secondary: #11161d
Glass overlay:        rgba(255,255,255,0.06)

Text Primary:         #e5e7eb
Text Secondary:       #9ca3af

Accent Teal (SAFE):   #14b8a6
Accent Red (PHISH):   #ef4444
Accent Yellow (WARN): #f59e0b
```

---

## Troubleshooting

| Issue                    | Fix                                                 |
| ------------------------ | --------------------------------------------------- |
| API timeout              | Check backend is running; adjust`API_BASE_URL`    |
| AEGIS not in app chooser | Reinstall after building with`expo run:android`   |
| Links not intercepted    | Ensure intent filters are built into the native APK |
| AsyncStorage error       | Clear app data and retry                            |

> **Note:** Intent filters only work with a **development build** or **production build**. They do NOT work in Expo Go.
