# Copilot Instructions for route-weather

## Identity & Authentication

### GitHub
- **Account:** Pepper-Home
- **Git config:** Always set per-repo: `git config user.name "Pepper-Home"` and `git config user.email` with the account email
- **Verify before any git operation:** `gh auth status` → expect `Pepper-Home` as active account

### Azure
- **Subscription:** Austins Great Subscription (see Personal-Account-Reference.md for IDs)
- **Login:** `az login --use-device-code` in private browser
- **Verify:** `az account show` → expect personal account

### Google Cloud
- **Project:** route-weather
- **APIs enabled:** Distance Matrix API, Geocoding API
- **API key:** in Key Vault (`GoogleMapsApiKey`), restricted to static IP + these 2 APIs

### ⚠️ CRITICAL
- **ALWAYS use private browser** for device code auth — work accounts conflict
- **NEVER put API keys in shell commands** — user caught this mistake, key had to be rotated
- **VERIFY identity** before any Azure/GitHub/Google operation

## Project Context

- **App:** Mobile-friendly PWA for motorcycle trip route weather forecasts
- **Stack:** Vue 3 + Vite + Tailwind CSS + vite-plugin-pwa
- **Hosting:** Azure Static Web App (Standard) → linked to Function App (BYOF)
- **Backend:** Azure Function App (Flex Consumption, Node.js 22 LTS) in VNet
- **Secrets:** Key Vault with private endpoint, MI-only access
- **Trip storage:** Azure Blob Storage with private endpoint, MI-only, shared key disabled
- **Outbound IP:** Static 20.115.132.162 via NAT Gateway (Google key restricted to this IP)
- **CI/CD:** GitHub Actions auto-deploy on push to main
- **Working directory:** `C:\Pepper_Home_Dev\route-weather\`
- **Function App code:** `C:\Pepper_Home_Dev\route-weather-func\`
- **Trip data:** Built-in in `/public/trips/`, user trips in Azure Blob Storage
- **Related:** Trip planning docs at `C:\Pepper_Home_Dev\Route 66\`
- **Skills repo:** [Pepper-Home/copilot-skills](https://github.com/Pepper-Home/copilot-skills) (private)

## Golden Rule
**Assumption is bad. Do NOT assume access — verify. Do NOT assume data is correct — verify. VERIFY EVERYTHING.**

## Design Principles
- **Secure:** Private endpoints, MI-only auth, no shared keys, no secrets in code
- **Cost efficient:** ~$60/mo of $150 budget. No unnecessary resources.
- **Offline-first:** PWA with service worker caching. Stale cache served when offline.
- **Mobile-first:** All UI decisions prioritize phone viewport. Touch-friendly.
- **Server-side persistence:** Imported trips stored in Azure Blob Storage, survive Clear Cache
