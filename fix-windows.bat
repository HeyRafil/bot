@echo off
echo === BotWAUT Windows Database ^& Build Fixer ===
echo Aplikasi ini akan mensinkronisasikan database, melakukan generate client, dan mengompilasi ulang source code.
echo.

echo [1/3] Mensinkronisasikan skema Prisma ke database SQLite...
call npx prisma db push

echo [2/3] Membuat ulang Prisma Client...
call npx prisma generate

echo [3/3] Mengompilasi ulang source code backend...
call npm run build

echo.
echo === Perbaikan Selesai! Silakan restart terminal running bot Anda ===
pause
