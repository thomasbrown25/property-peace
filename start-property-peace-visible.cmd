@echo off
REM Open Property Peace / Brownstone Hub app + API in visible Windows Terminal tabs.
REM Run this from Windows, or double-click it.
REM To include marketing too, run from WSL:
REM   /mnt/c/projects/property-peace/start-property-peace-visible.sh --with-marketing

wsl.exe bash -lc "cd /mnt/c/projects/property-peace && chmod +x ./start-property-peace-visible.sh && ./start-property-peace-visible.sh"

if errorlevel 1 (
  echo.
  echo Failed to start Property Peace visible terminal launcher.
  pause
)
