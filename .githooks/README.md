# Git hooks

These hooks block pushes to `prod` when builds fail.

## Pre-push hook

The `pre-push` hook runs the API, app, and marketing builds before allowing a push to `prod`. If any build fails, the push is aborted.

### Install (required once per clone)

**Linux / macOS / Git Bash (Windows):**
```bash
cp .githooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

**PowerShell (Windows) or npm:**
```powershell
npm run install-githooks
```

### Bypass (emergency only)

To push without running builds, use:
```bash
git push --no-verify origin prod
```

## Branch protection (recommended)

Add the **Build Gate (prod)** GitHub Action as a required status check for the `prod` branch. This blocks merging PRs when builds fail.

**GitHub:** Repo → Settings → Branches → Branch protection rules → Add rule for `prod` → Require status checks to pass → Select "Build Gate (prod)".
