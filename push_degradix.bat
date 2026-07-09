@echo off
echo Pushing Degradix Health Hub changes to GitHub...
cd "c:\Users\user\Downloads\degradix-health-hub-main-main (2)\degradix-health-hub-main-main"
git add .
git commit -m "chore: setup Render and Vercel deployment"
git push origin main
echo.
echo Done! Press any key to exit.
pause
