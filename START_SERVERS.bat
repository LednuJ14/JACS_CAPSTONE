@echo off
echo Starting JACS Property Management System...

echo.
echo Starting Main-Domain Backend Server...
start "Main Backend" cmd /k "cd /d %~dp0main-domain\backend && call venv\Scripts\activate.bat && python app.py"

echo.
echo Starting Main-Domain Frontend Server...
start "Main Frontend" cmd /k "cd /d %~dp0main-domain\frontend && npm start"

echo.
echo Starting Sub-Domain Backend Server on port 5001...
start "Sub Backend" cmd /k "cd /d %~dp0sub-domain\backend && set PORT=5001 && python run.py"

echo.
echo Starting Sub-Domain Frontend (Vite) on port 8080...
start "Sub Frontend" cmd /k "cd /d %~dp0sub-domain\frontend && npm run dev"

echo.
echo Both servers are starting...
echo Main Backend:   http://localhost:5000
echo Main Frontend:  http://localhost:3000
echo Sub Backend:    http://localhost:5001
echo Sub Frontend:   http://localhost:8080
echo.
echo Press any key to close this window...
pause > nul
