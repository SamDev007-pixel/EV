@echo off
title EV Charging System Launcher
echo ========================================================
echo   Intelligent EV Charging ^& Resource Management System
echo ========================================================
echo.

echo [1/3] Starting FastAPI Backend on port 8000...
start "EV System - Backend (FastAPI)" cmd /k "cd /d %~dp0backend && python run.py"

echo [2/3] Starting Vite Frontend on port 5173...
start "EV System - Frontend (Vite/React)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [3/3] Opening browser at http://localhost:5173/ ...
timeout /t 3 /nobreak >nul
start http://localhost:5173/

echo.
echo ========================================================
echo   System running:
echo   - Web App UI:  http://localhost:5173/
echo   - Backend API: http://127.0.0.1:8000/
echo   - API Docs:    http://127.0.0.1:8000/docs
echo ========================================================
