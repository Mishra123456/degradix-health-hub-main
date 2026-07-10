@echo off
echo Pushing Degradix Health Hub changes to GitHub...
cd "c:\Users\user\Downloads\degradix-health-hub-main-main (2)\degradix-health-hub-main-main"
git add .
git commit -m "feat: validate CSV upload, remove contact & training logs sections"
git push origin main
echo.
echo Done! Press any key to exit.
pause
