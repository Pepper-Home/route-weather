# 🏍️ Route Weather

Mobile-friendly PWA that shows weather forecasts along motorcycle trip routes, timed to your estimated arrival at each stop. Dual-source (NWS + Open-Meteo/ECMWF) with confidence scoring tuned for rider safety.

**Live:** https://green-dune-082bac91e.7.azurestaticapps.net

---

## Architecture

```
📱 Browser (Phone or PC — same URL)
    │
    ├──→ NWS API (api.weather.gov) ────── Free, no key, US govt GFS model
    ├──→ Open-Meteo API ───────────────── Free, no key, European ECMWF model
    │
    │  /api/distance-matrix (ETAs)
    ▼
☁️ Azure Static Web App (Standard tier, $9/mo)
    │  System-Assigned Managed Identity
    │  App Setting: GOOGLE_MAPS_API_KEY → Key Vault reference
    │
    ├──→ 🔐 Azure Key Vault (RBAC, encrypted at rest)
    │       Secret: GoogleMapsApiKey
    │       MI role: "Key Vault Secrets User" (read-only)
    │
    ▼  Resolves secret → calls Google with decrypted key
🌐 Google Distance Matrix API ─────── Traffic-aware drive times
```

---

## Azure Resources

| Resource | Name | Resource Group | SKU/Tier | Monthly Cost |
|----------|------|---------------|----------|-------------|
| Static Web App | `route-weather-app` | `rg-route-weather` | Standard | $9 |
| Key Vault | `kv-route-weather` | `rg-route-weather` | Standard (RBAC) | ~$0 |
| **Total** | | | | **~$9/mo** |

### Subscription
| Field | Value |
|-------|-------|
| Name | Austins Great Subscription |
| ID | `28b104e8-4125-4d0b-a071-0de96207c6e3` |
| Tenant | `05005ba0-77d6-412f-b9a0-da39e175a8a0` |
| Budget | $150/mo |
| Login | `pepper_home@hotmail.com` |

### Managed Identity (System-Assigned)
| Field | Value |
|-------|-------|
| Type | System-Assigned (tied to `route-weather-app`) |
| Principal ID | `fc13aefa-debe-45bb-8662-950c6a2e264a` |
| Key Vault Role | Key Vault Secrets User (read-only) |
| Scope | `kv-route-weather` only |

### Key Vault
| Field | Value |
|-------|-------|
| Name | `kv-route-weather` |
| URI | `https://kv-route-weather.vault.azure.net/` |
| Authorization | RBAC (not access policies) |
| Secret | `GoogleMapsApiKey` → Google Distance Matrix API key |

### Key Vault RBAC Assignments
| Principal | Role | Purpose |
|-----------|------|---------|
| `pepper_home@hotmail.com` (a41d916a...) | Key Vault Secrets Officer | Admin — create/rotate secrets |
| `route-weather-app` MI (fc13aefa...) | Key Vault Secrets User | App — read-only access to secrets |

### App Settings
| Setting | Value | Notes |
|---------|-------|-------|
| `GOOGLE_MAPS_API_KEY` | `@Microsoft.KeyVault(SecretUri=https://kv-route-weather.vault.azure.net/secrets/GoogleMapsApiKey/...)` | Resolved at runtime via MI — never plain text |

---

## Google Cloud

| Field | Value |
|-------|-------|
| Account | `aumager@gmail.com` |
| Project | `route-weather` |
| API Enabled | Distance Matrix API |
| API Key Restrictions | HTTP referrer: `green-dune-082bac91e.7.azurestaticapps.net/*` + `localhost:*/*` |
| API Restrictions | Distance Matrix API only |
| Free Tier | 10,000 requests/mo (we use ~200) |
| Console | [console.cloud.google.com](https://console.cloud.google.com) |

---

## GitHub

| Field | Value |
|-------|-------|
| Account | Pepper-Home |
| Email | `pepper_home@hotmail.com` |
| Repo | [Pepper-Home/route-weather](https://github.com/Pepper-Home/route-weather) |
| CI/CD | GitHub Actions → Azure Static Web App (auto-deploy on push to main) |
| Git Identity | Per-repo: `Pepper-Home` / `pepper_home@hotmail.com` |

---

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | Vue 3 + Composition API | Lightweight, fast, good mobile UX |
| Build | Vite | Fast builds, great PWA plugin |
| PWA | vite-plugin-pwa + Workbox | Service worker, offline cache, installable |
| CSS | Tailwind CSS | Utility-first, responsive, small bundle |
| Weather API 1 | NWS api.weather.gov | Free, no key, US govt GFS model |
| Weather API 2 | Open-Meteo | Free, no key, European ECMWF model |
| ETA API | Google Distance Matrix | Traffic-aware drive times, key in Key Vault |
| Hosting | Azure Static Web App | Standard tier, GitHub Actions CI/CD |
| Secrets | Azure Key Vault + MI | Encrypted, RBAC, access-logged, rotatable |

---

## Features

- **Dual-source forecasts** — NWS (GFS) and Open-Meteo (ECMWF) side-by-side per stop
- **Confidence scoring** — tuned for motorcycle riders (wind weighted heaviest)
  - 🟢 75-100%: Sources agree — ride with confidence
  - 🟡 50-74%: Some disagreement — plan for variability
  - 🔴 0-49%: Significant disagreement — pack for everything
- **NWS active alerts** — severe weather warnings for your route
- **Stale forecast warning** — red banner if matched forecast is >2 hours from your ETA
- **Departure time picker** — adjusts all ETAs, debounced to avoid API storms
- **Offline/PWA** — cached forecasts for dead zones, installable on phone home screen
- **Multi-trip** — drop new JSON in `/public/trips/` for future rides
- **Content-Security-Policy** — XSS protection
- **Dark mode** — readable in any lighting

---

## Project Structure

```
route-weather/
├── .github/
│   ├── copilot-instructions.md      # Copilot context for this repo
│   └── workflows/
│       └── azure-static-web-apps-*.yml  # CI/CD pipeline
├── api/
│   ├── distance-matrix/
│   │   └── index.js                 # Serverless proxy for Google API (key from KV)
│   ├── host.json
│   └── package.json
├── public/
│   └── trips/
│       ├── index.json               # Trip index (auto-discovery)
│       └── route66-east-2026.json   # Trip waypoints (lat/lon, miles, minutes)
├── src/
│   ├── components/
│   │   ├── AlertBanner.vue          # NWS active alerts
│   │   ├── DepartureTime.vue        # Departure time picker (default 8:00 AM)
│   │   ├── OfflineBanner.vue        # "Using cached data" indicator
│   │   ├── RouteWeather.vue         # Main forecast display + fetch orchestration
│   │   ├── StopCard.vue             # Dual-source stop card with confidence
│   │   └── TripSelector.vue         # Trip/day picker
│   ├── composables/
│   │   ├── useOffline.js            # Online/offline detection
│   │   ├── useOpenMeteo.js          # Open-Meteo API + confidence scoring
│   │   ├── useTrips.js              # Trip config loader
│   │   └── useWeather.js            # NWS API + caching + rider severity
│   ├── App.vue
│   ├── assets/main.css
│   └── main.js
├── staticwebapp.config.json         # SPA routing + API proxy config
├── index.html
├── vite.config.js                   # Build config + PWA + Tailwind
├── package.json
└── .npmrc                           # legacy-peer-deps for CI
```

---

## Authentication Cheat Sheet

### ⚠️ ALWAYS use a PRIVATE/INCOGNITO browser for device code flows

**Azure CLI:**
```powershell
az login --use-device-code
# Link: https://login.microsoft.com/device
# Sign in as: pepper_home@hotmail.com
az account set --subscription "28b104e8-4125-4d0b-a071-0de96207c6e3"
az account show  # verify: pepper_home@hotmail.com / Austins Great Subscription
```

**GitHub CLI:**
```powershell
gh auth status  # verify: Pepper-Home is active
# If device code needed:
# Link: https://github.com/login/device
```

**Google Cloud:**
```
# Link: https://console.cloud.google.com
# Sign in as: aumager@gmail.com
# Project: route-weather
```

---

## Common Operations

### Deploy (automatic)
```bash
git push  # GitHub Actions auto-deploys to Azure
```

### Rotate Google API Key
```powershell
# 1. Generate new key in Google Cloud Console
# 2. Update Key Vault secret:
az keyvault secret set --vault-name kv-route-weather --name GoogleMapsApiKey --value "NEW_KEY_HERE"
# 3. Restart the Static Web App to pick up new secret (or wait ~24hrs for auto-refresh)
```

### Add a New Trip
1. Create a JSON file following the schema in `route66-east-2026.json`
2. Add it to `/public/trips/`
3. Add an entry to `/public/trips/index.json`
4. Push to main

### Run Locally
```powershell
cd C:\Pepper_Home_Dev\route-weather
npm install
npm run dev  # http://localhost:5173
```

---

## Related Files

| File | Location | Purpose |
|------|----------|---------|
| Route stop plans (HTML) | `C:\Pepper_Home_Dev\Route 66\Rally-*.html` | Printable fuel/rest/lunch stop plans for each day |
| Turn-by-turn source data | `C:\Pepper_Home_Dev\Route 66\Turn-by-Turn-Source-Data.md` | Original H-D Ride Planner directions |
| Session notes | `C:\Pepper_Home_Dev\Route 66\Session-Notes.md` | Full planning session documentation |
| App plan | `C:\Pepper_Home_Dev\Route 66\Route-Weather-App-Plan.md` | Original app architecture plan |
| Personal account reference | `C:\Pepper_Home_Dev\Personal-Account-Reference.md` | All personal account details |

---

## Security Notes

1. **API key is NEVER in source code** — stored in Azure Key Vault, accessed via Managed Identity
2. **Key Vault uses RBAC** — not access policies. MI has read-only (Secrets User), you have admin (Secrets Officer)
3. **Google API key is restricted** — domain referrer + Distance Matrix API only
4. **CSP header** blocks unauthorized scripts from accessing localStorage (which caches location data)
5. **Home address removed** — trip JSON uses city-center approximation, not exact address
6. **Personal email removed** — User-Agent header uses GitHub repo URL, not email
7. **Forecast safety check** — forecasts >2 hours off target ETA show a red warning banner
8. **Service worker** caches NWS and Open-Meteo responses (1hr TTL) but NOT trip JSON files

---

*Built April 2026 for the Route 66 East HOG Rally motorcycle trip*
