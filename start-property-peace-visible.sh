#!/usr/bin/env bash
set -euo pipefail

# Open the Property Peace / Brownstone Hub local dev servers in visible Windows Terminal tabs.
# Default: app + API only.
# Optional: pass --with-marketing to also open the marketing site.
#
# Run from WSL:
#   /mnt/c/projects/property-peace/start-property-peace-visible.sh
# Or double-click / run:
#   start-property-peace-visible.cmd

ROOT="/mnt/c/projects/property-peace"
APP_DIR="$ROOT/property-peace-app"
MARKETING_DIR="$ROOT/property-peace-marketing"
API_DIR="$ROOT/property-peace-api"

WITH_MARKETING=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --with-marketing) WITH_MARKETING=true ;;
    --dry-run) DRY_RUN=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--dry-run] [--with-marketing]" >&2
      exit 2
      ;;
  esac
done

WT_EXE="${WT_EXE:-}"
if [[ -z "$WT_EXE" ]]; then
  for candidate in \
    "/mnt/c/Users/thoma/AppData/Local/Microsoft/WindowsApps/wt.exe" \
    "/mnt/c/Users/$USER/AppData/Local/Microsoft/WindowsApps/wt.exe" \
    "/mnt/c/Windows/System32/wt.exe" \
    "wt.exe"; do
    if command -v "$candidate" >/dev/null 2>&1 || [[ -e "$candidate" ]]; then
      WT_EXE="$candidate"
      break
    fi
  done
fi

WSL_EXE="${WSL_EXE:-/mnt/c/Windows/System32/wsl.exe}"
CMD_EXE="${CMD_EXE:-/mnt/c/Windows/System32/cmd.exe}"

if [[ "$DRY_RUN" == true ]]; then
  echo "Windows Terminal: ${WT_EXE:-NOT FOUND}"
  echo "WSL exe: $WSL_EXE"
  echo "Repo root: $ROOT"
  echo "Include marketing: $WITH_MARKETING"
  echo
  echo "Tabs to open:"
  echo "  1. Property Peace App: cd $APP_DIR && npm run start"
  if [[ "$WITH_MARKETING" == true ]]; then
    echo "  2. Property Peace Marketing: sleep 8 && cd $MARKETING_DIR && npm run dev"
    echo "  3. Property Peace API: cd $API_DIR && dotnet watch"
  else
    echo "  2. Property Peace API: cd $API_DIR && dotnet watch"
  fi
  echo "Browser: http://localhost:3000 after 12 seconds"
  exit 0
fi

required_dirs=("$APP_DIR" "$API_DIR")
if [[ "$WITH_MARKETING" == true ]]; then
  required_dirs+=("$MARKETING_DIR")
fi

for required_dir in "${required_dirs[@]}"; do
  if [[ ! -d "$required_dir" ]]; then
    echo "Missing directory: $required_dir" >&2
    exit 1
  fi
done

if [[ -z "$WT_EXE" ]]; then
  echo "Could not find wt.exe / Windows Terminal." >&2
  echo "Install Windows Terminal or set WT_EXE=/mnt/c/path/to/wt.exe and retry." >&2
  exit 1
fi

if [[ ! -e "$WSL_EXE" ]]; then
  echo "Could not find wsl.exe at $WSL_EXE" >&2
  exit 1
fi

# Open browser after the app has a short head start. Ignore failures because the tabs are the main deliverable.
if [[ -e "$CMD_EXE" ]]; then
  (sleep 12; "$CMD_EXE" /C start "" "http://localhost:3000" >/dev/null 2>&1 || true) &
fi

# Start the app first. If marketing is included, it waits briefly so it does not take port 3000 first.
if [[ "$WITH_MARKETING" == true ]]; then
  "$WT_EXE" \
    new-tab --title "PP App :3000" "$WSL_EXE" bash -lc "cd '$APP_DIR' && npm run start; exec bash" \
    \; new-tab --title "PP Marketing" "$WSL_EXE" bash -lc "sleep 8; cd '$MARKETING_DIR' && npm run dev; exec bash" \
    \; new-tab --title "PP API" "$WSL_EXE" bash -lc "export PATH=\"\$HOME/.dotnet:\$PATH\"; cd '$API_DIR' && dotnet watch; exec bash"
else
  "$WT_EXE" \
    new-tab --title "PP App :3000" "$WSL_EXE" bash -lc "cd '$APP_DIR' && npm run start; exec bash" \
    \; new-tab --title "PP API" "$WSL_EXE" bash -lc "export PATH=\"\$HOME/.dotnet:\$PATH\"; cd '$API_DIR' && dotnet watch; exec bash"
fi

echo "Opened Property Peace in Windows Terminal tabs."
echo "App: http://localhost:3000"
echo "API: check the PP API tab for its listening URL"
if [[ "$WITH_MARKETING" == true ]]; then
  echo "Marketing: check the PP Marketing tab for its Vite URL"
fi
