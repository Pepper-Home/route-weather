# 🏍️ Route Weather

Mobile-friendly PWA that shows weather forecasts along motorcycle trip routes, timed to your estimated arrival at each stop. Dual-source (NWS + Open-Meteo/ECMWF) with confidence scoring tuned for rider safety.

**Live:** https://green-dune-082bac91e.7.azurestaticapps.net

---

## Architecture

```
📱 Browser (Phone or PC)
    │
    ├──→ NWS API (api.weather.gov) ────── Free, US govt GFS model
    ├──→ Open-Meteo API ───────────────── Free, European ECMWF model
    │
    │  /api/distance-matrix    (Google Distance Matrix — traffic-aware ETAs)
    │  /api/reverse-geocode    (Google Geocoding — city names from lat/lon)
    │  /api/user-trips         (CRUD — server-side trip storage)
    ▼
☁️ Azure Static Web App (Standard, $9/mo)
    │  "Bring Your Own Functions" linked backend
    ▼
⚡ Azure Function App — Flex Consumption (func-route-weather-flex)
    │  System-Assigned Managed Identity
    │  VNet integrated (snet-functions)
    │  Node.js 22 LTS
    │
    ├──→ 🔐 Azure Key Vault (private endpoint, RBAC)
    │       Secret: GoogleMapsApiKey
    │       MI role: Key Vault Secrets User (read-only)
    │
    ├──→ 📦 Azure Blob Storage (private endpoint, MI auth)
    │       Container: user-trips (imported trip JSON files)
    │       MI role: Storage Blob Data Contributor
    │
    └──→ 🌐 Google APIs (Distance Matrix + Geocoding)
            Via NAT Gateway → static IP 20.115.132.162
            Google key restricted to this single IP
```

---

## Azure Resources

| Resource | Name | Purpose | Monthly Cost |
|----------|------|---------|-------------|
| Static Web App | route-weather-app | Frontend hosting + SWA→Function link | $9.00 |
| Function App (Flex) | func-route-weather-flex | API proxy (Google, trips) | ~$0.13 |
| Key Vault | kv-route-weather | API key storage | ~$0.01 |
| Storage Account | strouteweather | Function runtime + user trip blobs | ~$0.05 |
| VNet | vnet-route-weather | Network isolation (10.0.0.0/16) | $0 |
| NAT Gateway | nat-route-weather | Static outbound IP | $32.40 |
| Public IP | pip-nat-route-weather | 20.115.132.162 | $3.65 |
| Private Endpoints | pe-kv-*, pe-sa-* | KV + Storage private access | ~$14.40 |
| Private DNS Zones | privatelink.vault/blob | DNS resolution for PEs | ~$0.50 |
| **Total** | | | **~$60/mo** |

---

## Security

| Control | Implementation |
|---------|---------------|
| API key storage | Key Vault, accessed via MI only — never in code or app settings |
| Google API key restriction | Single static IP (NAT Gateway) + API type restriction |
| Key Vault access | Private endpoint only, public access disabled |
| Storage access | Private endpoint, shared key disabled, MI auth only |
| Function App access | SWA identity provider blocks direct calls; only SWA proxy allowed |
| Network | VNet with dedicated subnets, NAT Gateway for outbound |
| Input validation | Lat/lon regex, max stops, trip size limit, JSON structure validation |
| Rate limiting | 30 req/min per endpoint, 10s dedup cache |
| Error responses | Generic errors only — no secrets or stack traces leaked |
| CSP | base-uri, form-action, frame-ancestors headers |
| Resource lock | CanNotDelete on resource group |
| TLS | 1.2 minimum on storage account |

---

## Features

- **Dual-source forecasts** — NWS (GFS) and Open-Meteo (ECMWF) side-by-side per stop
- **Confidence scoring** — tuned for motorcycle riders (wind weighted heaviest)
- **Google Distance Matrix ETAs** — traffic-aware drive times, not static estimates
- **NWS active alerts** — severe weather warnings for your route
- **Stale forecast warning** — red banner if forecast is >2 hours off your ETA
- **GPX import** — upload HD Ride Planner GPX files, auto-generates stops
- **Trip JSON import** — upload trip files from the Ride Planning Copilot skill
- **Server-side trip storage** — imported trips persist in Azure Blob Storage (survive Clear Cache)
- **Trip management** — rename (✏️), remove (🗑️), import (➕) trips
- **Google reverse geocoding** — GPX stops get real city/state names
- **Departure time picker** — adjusts all ETAs, debounced
- **Clear Cache** — big red button nukes weather/ETA caches, hard reloads (trips survive)
- **PWA** — installable, offline cached forecasts for dead zones
- **Dark mode ready** — readable in any lighting

---

## Project Structure

```
route-weather/                        ← Frontend (Vue 3 PWA)
├── src/
│   ├── components/
│   │   ├── AlertBanner.vue           # NWS active alerts
│   │   ├── DepartureTime.vue         # Departure time picker
│   │   ├── OfflineBanner.vue         # "Using cached data" indicator
│   │   ├── RouteWeather.vue          # Main forecast orchestrator
│   │   ├── StopCard.vue              # Dual-source stop card + confidence
│   │   ├── TripImporter.vue          # GPX/JSON import UI
│   │   └── TripSelector.vue          # Trip/day picker + rename/remove
│   ├── composables/
│   │   ├── useDistanceMatrix.js      # Google Distance Matrix client
│   │   ├── useOffline.js             # Online/offline detection
│   │   ├── useOpenMeteo.js           # Open-Meteo API + confidence scoring
│   │   ├── useTrips.js               # Trip CRUD (server-side blob storage)
│   │   └── useWeather.js             # NWS API + caching + alerts
│   ├── guides/
│   │   ├── GuidesApp.vue             # Ride Guides viewer (trip/day selector)
│   │   └── main.js                   # Guides entry point
│   ├── utils/
│   │   └── gpxParser.js              # HD Ride Planner GPX → stops
│   └── App.vue
├── guides.html                       # Second Vite entry — Ride Guides page
└── staticwebapp.config.json          # SPA routing + CSP headers

route-weather-func/                   ← Backend (Azure Functions)
└── src/functions/
    ├── distanceMatrix.js             # MI → KV → Google Distance Matrix
    ├── rideGuides.js                 # MI → Blob Storage ride guide HTML
    └── userTrips.js                  # MI → Blob Storage trip CRUD
```

---

## Trip Management

All trips are stored server-side in Azure Blob Storage. No local/built-in trips.

### Import trips (GPX)
1. Tap **➕ New Trip** in the app
2. Pick a `.gpx` file from HD Ride Planner
3. Name the trip and days
4. Preview auto-generated stops
5. Save — stored in Azure Blob Storage

### Import trips (JSON from Ride Planning Skill)
1. Tap **➕ New Trip**
2. Pick the `.json` file the skill generated
3. Save — stored in Azure Blob Storage

### Ride Guides
HTML stop plans viewable in the app via **📋 Ride Guides** button. Stored in `ride-guides` blob container, keyed by `{tripId}/{dayId}.html`.

### Ride Planning Copilot Skill
Say: *"Using Ride Planning Skill, create me a plan for this ride"* then paste turn-by-turn directions. The skill researches verified fuel/rest/lunch stops and outputs trip JSON + HTML ride guide, then uploads both to the app.

Repo: [Pepper-Home/copilot-skills](https://github.com/Pepper-Home/copilot-skills) (private)

---

## Common Operations

### Deploy (automatic)
```bash
git push  # GitHub Actions auto-deploys frontend to SWA
```

### Deploy Function App
```powershell
cd C:\Pepper_Home_Dev\route-weather-func
func azure functionapp publish func-route-weather-flex --javascript
```

### Run Locally
```powershell
cd C:\Pepper_Home_Dev\route-weather
npm install && npm run dev  # http://localhost:5173
```

---

*Built April 2026 for the HOG Rally motorcycle trip — Seattle → Milwaukee → Amarillo → Seattle*
