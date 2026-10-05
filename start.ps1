Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Intelligent EV Charging & Resource Management System" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

Write-Host "[1/3] Starting FastAPI Backend on port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; python run.py"

Write-Host "[2/3] Starting Vite Frontend on port 5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host "[3/3] Opening browser at http://localhost:5173/ ..." -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173/"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  System running:" -ForegroundColor Yellow
Write-Host "  - Frontend UI: http://localhost:5173/" -ForegroundColor Yellow
Write-Host "  - Backend API: http://127.0.0.1:8000/" -ForegroundColor Yellow
Write-Host "  - API Swagger: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
