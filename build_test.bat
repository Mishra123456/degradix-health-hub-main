@echo off
echo Testing build locally...
cd "c:\Users\user\Downloads\degradix-health-hub-main-main (2)\degradix-health-hub-main-main"
call npm install
call npm run build > build_output.txt 2>&1
echo Done! Please close this window.
pause
