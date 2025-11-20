## **Project Overview**


**Aegis a** **privacy-focused, ML-powered Chrome extension** designed to detect and block phishing URLs instantly.

Built with modern backend, frontend, and machine learning technologies, ensuring **zero-knowledge architecture** and strong user privacy.

---

## **Tech Stack**

### **Backend: FastAPI**

* FastAPI (async APIs, automatic documentation)
* Argon2-cffi (secure password hashing)
* PyJWT (JWT authentication)
* Pydantic (validation & parsing)
* FastAPI-Mail (OTP system)
* Tortoise ORM + SQLite

### **Frontend: React (Monorepo) (under construction)**

* React (TSX)
* React Router
* Tailwind CSS 
* pnpm (workspace monorepo)
* SubtleCrypto API (AES-GCM, PBKDF2)
* Chrome Extension APIs (Manifest v3)
* Background worker for API proxying

### **Machine Learning**

* Scikit-Learn
* pandas
* Ensemble Stacking Classifier
* Logistic Regression, Extra Trees, Random Forest, CatBoost
* Dataset: LegitPhish (100k+ URLs)

### Enviornment

* Frontend : Node js 22+ , pnpm
* Backend : uv python

---

## **Key Features**

* **Zero-Knowledge Architecture**

  All sensitive data encrypted using **AES-GCM** in-browser before transmission.
* **ML-Driven Phishing Detection**

  High-accuracy ensemble model predicting URL legitimacy instantly.
* **URL Blocking & Auto-Sync**

  Block suspicious URLs and sync blocklists for logged-in users.
* **OTP Authentication**

  Secure onboarding with Argon2 hashed passwords and JWT tokens.
* **Background Worker**

  Central layer for storage handling, API calls, and improved security.
