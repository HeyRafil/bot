@echo off
title BotWAUT Local Launcher
echo ===================================================
echo     LAUNCHER BOTWAUT LOKAL (WINDOWS)
echo ===================================================
echo.
echo 1. Menjalankan Backend Bot (Port 5000)...
start "BotWAUT Backend" cmd /k "npm start"

echo.
echo 2. Menjalankan Dashboard Frontend (Port 3000)...
start "BotWAUT Frontend" cmd /k "cd frontend && npm start"

echo.
echo ---------------------------------------------------
echo Sukses! Kedua jendela terminal telah dibuka:
echo - Terminal 1: Backend Server (Port 5000)
echo - Terminal 2: Dashboard Frontend (Port 3000)
echo.
echo Dashboard dapat diakses di: http://localhost:3000
echo ---------------------------------------------------
echo.
pause
