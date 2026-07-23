#!/bin/bash

echo "=== BotWAUT VPS Database & Build Fixer ==="
echo "Aplikasi ini akan menghentikan bot, mensinkronisasikan database, melakukan build ulang, dan menyalakan kembali bot."
echo ""

# 1. Hentikan dan bersihkan proses PM2 lama untuk menghindari lock file dan tabrakan port
echo "[1/5] Menghentikan dan membersihkan proses PM2 lama..."
pm2 delete bot-back 2>/dev/null || true
pm2 delete bot-backend 2>/dev/null || true
pm2 delete bot-frontend 2>/dev/null || true

# 1.5 Jalankan instalasi library baru
echo "[1.5/5] Menginstal library baru jika ada (npm install)..."
npm install

# 2. Sinkronisasikan skema Prisma ke database SQLite
echo "[2/5] Mensinkronisasikan skema Prisma ke database..."
npx prisma db push

# 3. Generate ulang Prisma Client
echo "[3/5] Membuat ulang Prisma Client..."
npx prisma generate

# 4. Build ulang file TypeScript backend
echo "[4/5] Mengompilasi ulang source code backend..."
npm run build

# 4.5 Build ulang frontend Next.js
if [ -d "./frontend" ]; then
  echo "Mengompilasi ulang Next.js frontend..."
  cd frontend
  npm run build
  cd ..
fi


# 5. Jalankan kembali bot & dashboard menggunakan ecosystem.config.cjs
echo "[5/5] Menyalakan kembali bot & dashboard di PM2..."
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=== Perbaikan Selesai! silakan coba jalankan perintah .listuser di WhatsApp ==="
pm2 status
