@echo off
cd /d "%~dp0emerald-forest"
node scripts\start-v3.cjs
if errorlevel 1 pause
