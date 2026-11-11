Write-Host "Starting TIP Media Intelligence Backend API on port 8001..." -ForegroundColor Cyan
& ".\backend\venv\Scripts\uvicorn.exe" backend.app.main:app --reload --host 127.0.0.1 --port 8001
