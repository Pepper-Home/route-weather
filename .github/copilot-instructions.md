# Copilot Instructions for route-weather

## Identity & Authentication

### GitHub
- **Account:** Pepper-Home / pepper_home@hotmail.com
- **Git config:** Always set per-repo: `git config user.name "Pepper-Home"` and `git config user.email "pepper_home@hotmail.com"`
- **Verify before any git operation:** `gh auth status` → expect `Pepper-Home` as active account
- **Device code auth link:** [https://github.com/login/device](https://github.com/login/device)

### Azure
- **Account:** pepper_home@hotmail.com
- **Subscription:** Austins Great Subscription / `28b104e8-4125-4d0b-a071-0de96207c6e3`
- **Tenant:** `05005ba0-77d6-412f-b9a0-da39e175a8a0`
- **Budget:** $150/month — use Free tiers wherever possible
- **Login:** `az login --use-device-code`
- **Device code auth link:** [https://login.microsoft.com/device](https://login.microsoft.com/device)
- **After login:** `az account set --subscription "28b104e8-4125-4d0b-a071-0de96207c6e3"`
- **Verify:** `az account show` → expect `pepper_home@hotmail.com`

### ⚠️ CRITICAL: Private Browser Sessions
- **ALWAYS provide clickable links** for device code auth flows — user needs to open in a private/incognito browser
- **NEVER assume** the current az/gh session is the personal account — VERIFY FIRST
- Work accounts (amager@microsoft.com / amager_microsoft) will conflict if not in private session

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
