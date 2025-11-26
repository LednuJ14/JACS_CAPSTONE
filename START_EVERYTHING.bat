@echo off
echo ============================================================
echo 🚀 JACS Property Management - Complete System Startup
echo ============================================================
echo.

echo 📋 This script will start both your backend and frontend servers
echo.

echo ⚠️  IMPORTANT: Make sure you've configured your hosts file first!
echo    See HOSTS_SETUP_INSTRUCTIONS.md for details
echo.

pause

echo 🔧 Starting Main-Domain Backend Server...
echo.
start "JACS Main Backend" cmd /k "cd /d %~dp0main-domain\backend && .\venv\Scripts\Activate.ps1 && python app.py"

echo ⏳ Waiting for main backend to start...
timeout /t 3 /nobreak > nul

echo 🎨 Starting Main-Domain Frontend Server...
echo.
start "JACS Main Frontend" cmd /k "cd /d %~dp0main-domain\frontend && npm start"

echo.
echo 🔧 Starting Sub-Domain Backend Server (port 5001)...
start "JACS Sub Backend" cmd /k "cd /d %~dp0sub-domain\backend && set PORT=5001 && python run.py"

echo ⏳ Waiting for sub backend to start...
timeout /t 2 /nobreak > nul

echo 🎨 Starting Sub-Domain Frontend (Vite on 8080)...
start "JACS Sub Frontend" cmd /k "cd /d %~dp0sub-domain\frontend && npm run dev"

echo.
echo ============================================================
echo ✅ Both servers are starting up!
echo ============================================================
echo.
echo 🌐 Your Property Portal URLs:
echo.
echo   • Modern 2BR IT Park:    http://modern-2br-itpark.localhost:3000
echo   • Cozy Studio Ayala:     http://cozy-studio-ayala.localhost:3000
echo   • Family House Banilad:  http://family-house-banilad.localhost:3000
echo   • Luxury Condo Marco:    http://luxury-condo-marco.localhost:3000
echo   • Student Boarding USC:  http://student-boarding-usc.localhost:3000
echo.
echo 🔧 Main Application:         http://localhost:3000
echo 🔧 API Server (Main):        http://localhost:5000
echo 🔧 Sub Application (Vite):   http://localhost:8080
echo 🔧 API Server (Sub):         http://localhost:5001
echo.
echo ============================================================
echo 🔑 Test Accounts:
echo.
echo   👤 Admin:   admin@jacs-cebu.com / Admin123!
echo   🏢 Manager: manager@example.com / Manager123!
echo   🏠 Tenant:  tenant@example.com / Tenant123!
echo.
echo ============================================================
echo 🎉 Your complete property subdomain system is ready!
echo.
echo Press any key to close this window...
pause > nul
