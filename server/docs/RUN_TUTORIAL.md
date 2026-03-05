# 🚀 RUN TUTORIAL: How to Run MaxMiner Backend

Follow these steps to run the backend either locally or on your VPS.

## 📋 Prerequisites
- Node.js (v18 or higher)
- Redis Server (or Upstash URL)
- PostgreSQL (Supabase recommended)
- Telegram Bot Token (from @BotFather)

---

## 🏠 Local Setup (Development)

1. **Install Dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configure Environment**:
   Edit `.env` and fill in your credentials.
   - Set `DATABASE_URL` and `DIRECT_URL`.
   - Set `TELEGRAM_BOT_TOKEN`.

3. **Generate Database Client**:
   ```bash
   npx prisma generate
   ```

4. **Run in Dev Mode**:
   ```bash
   npm run dev
   ```
   *The server will use `nodemon` and `ts-node` to auto-restart on changes.*

---

## ☁️ VPS Deployment (Production)

1. **Clean Start**:
   If there's an old version, stop it and delete `node_modules`.
   ```bash
   pm2 delete maxminer-backend
   rm -rf node_modules
   ```

2. **Secure Installation**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Build the Project**:
   Compiling TypeScript to JavaScript ensures faster performance.
   ```bash
   npm run build
   ```

4. **Database Sync (Binary Mode)**:
   Highly recommended for EC2/Linux VPS.
   ```bash
   PRISMA_CLI_QUERY_ENGINE_TYPE=binary PRISMA_CLIENT_ENGINE_TYPE=binary npx prisma generate
   ```

5. **Start with PM2**:
   ```bash
   pm2 start dist/index.js --name maxminer-backend
   ```

---

## 🛠 Troubleshooting

- **Server Crash on Startup**: Check `pm2 logs`. Usually caused by a missing `.env` variable or wrong database password.
- **Unauthorized (401)**: Ensure your `TELEGRAM_BOT_TOKEN` in `.env` matches the one used by your bot.
- **High CPU**: Ensure you have removed the `postinstall` script from `package.json`.
- **Database Connection Error**: If using Supabase, make sure your IP is allow-listed or use the connection pooler URL (port 6543).

---

© 2026 MaxMiner Deployment Guide
