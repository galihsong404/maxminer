# 🏗️ Max Miner Technical Architecture

## 🚄 Overview
Max Miner is a high-performance Watch-to-Earn (W2E) Telegram Mini App (TMA). It uses a hybrid architecture of a traditional REST API (Express) and Web3 interactions (EVM).

## 🛠️ Tech Stack
- **Monorepo**: Managed via npm workspaces.
- **Frontend**: Vite + React 19 + Tailwind CSS 4 + Framer Motion.
- **Backend**: Express.js + Prisma (PostgreSQL).
- **Caching**: Redis (S2S Ad callback sessions, Rate limiting).
- **Security**: JWT-based authentication via Telegram WebApp `initData` validation.

## 🔄 Core Loops

### 1. Mining Cycle
1. Client starts `syncMining` loop (every 10s).
2. Backend calculates gold increment based on `minerLevel` and `activeBoosts`.
3. State is persisted in PostgreSQL.

### 2. Ad-Reward-Refuel (W2E)
1. Client requests an ad session (`/ad/request`).
2. Backend creates a unique `sessionId` in Redis with an expiry.
3. Ad Network sends S2S (Server-to-Server) callback to `/ad/callback`.
4. Backend validates `HMAC` from Ad Network.
5. If valid, Backend grants rewards (Fuel/Gold/Tokens) and updates the session in Redis.
6. Client polls for session completion and updates UI.

## 🔐 Security Audit Measures
- **Rate Limiting**: Implemented on `/auth` and `/mine/sync` endpoints.
- **Payload Validation**: All inputs are checked against a 10kb limit to prevent DoS.
- **Signed Callbacks**: Ad rewards are only granted via verified S2S HMAC signatures.
- **initData Validation**: Backend re-validates the Telegram hash on every session.
