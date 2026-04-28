# Copilot Instructions for route-weather

## Identity & Authentication

### GitHub
- **Account:** Pepper-Home
- **Git config:** Always set per-repo: `git config user.name "Pepper-Home"` and `git config user.email` with the account email
- **Verify before any git operation:** `gh auth status` → expect `Pepper-Home` as active account
- **Device code auth link:** [https://github.com/login/device](https://github.com/login/device)

### Azure
- **Subscription:** Austins Great Subscription (see Personal-Account-Reference.md for IDs)
- **Login:** `az login --use-device-code`
- **Device code auth link:** [https://login.microsoft.com/device](https://login.microsoft.com/device)
- **After login:** set subscription (see Personal-Account-Reference.md for ID)
- **Verify:** `az account show` → expect personal account

### ⚠️ CRITICAL: Private Browser Sessions
- **ALWAYS provide clickable links** for device code auth flows — user needs to open in a private/incognito browser
- **NEVER assume** the current az/gh session is the personal account — VERIFY FIRST
- Work accounts will conflict if not in private session

## Project Context

- **App:** Mobile-friendly PWA for motorcycle trip route weather forecasts
- **Stack:** Vue 3 + Vite + Tailwind CSS + vite-plugin-pwa
- **API:** NWS api.weather.gov (free, no key, CORS-friendly)
- **Hosting:** Azure Static Web App (Free tier) in resource group `rg-route-weather`
- **CI/CD:** GitHub Actions auto-deploy on push to main
- **Working directory:** `C:\Pepper_Home_Dev\route-weather\`
- **Trip data:** `/public/trips/` — JSON configs with waypoints (lat/lon, mile, minutesFromStart)
- **Related files:** Trip planning docs at `C:\Pepper_Home_Dev\Route 66\`

## Golden Rule
**Assumption is bad. Do NOT assume access — verify. Do NOT assume data is correct — verify. VERIFY EVERYTHING.**

## Design Principles
- **Cost efficient:** Stay on Free tiers. $0/month target for this app.
- **Secure:** No secrets in code. NWS API needs no key. Azure deployment token is a GitHub secret (auto-managed).
- **Offline-first:** PWA with service worker caching. Forecasts cached in LocalStorage (1hr TTL). Stale cache served when offline.
- **Mobile-first:** All UI decisions prioritize phone viewport. Touch-friendly. Readable in sunlight.
- **Multi-trip:** Trip configs are JSON files in `/public/trips/`. Drop a new JSON = new trip. No code changes needed.
