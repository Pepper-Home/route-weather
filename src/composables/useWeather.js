import { ref, shallowRef } from 'vue'

const NWS_BASE = 'https://api.weather.gov'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const NWS_HEADERS = { 'User-Agent': 'RouteWeatherApp/1.0 (pepper_home@hotmail.com)', Accept: 'application/geo+json' }

function cacheKey(lat, lon) {
  return `nws-${lat.toFixed(4)},${lon.toFixed(4)}`
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch { return null }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* storage full — ignore */ }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: NWS_HEADERS })
  if (!res.ok) throw new Error(`NWS API ${res.status}: ${res.statusText}`)
  return res.json()
}

/**
 * Get the NWS forecast grid endpoint for a lat/lon point.
 * Cached indefinitely — grid points don't change.
 */
async function getGridPoint(lat, lon) {
  const key = `nws-grid-${lat.toFixed(4)},${lon.toFixed(4)}`
  const cached = localStorage.getItem(key)
  if (cached) return JSON.parse(cached)

  const data = await fetchJson(`${NWS_BASE}/points/${lat.toFixed(4)},${lon.toFixed(4)}`)
  const result = {
    forecastHourly: data.properties.forecastHourly,
    forecast: data.properties.forecast,
    county: data.properties.county,
    forecastZone: data.properties.forecastZone
  }
  localStorage.setItem(key, JSON.stringify(result))
  return result
}

/**
 * Get hourly forecast for a location and match to a target time.
 * Returns the forecast period closest to the target hour.
 */
async function getHourlyForecast(lat, lon) {
  const key = cacheKey(lat, lon)
  const cached = getCached(key)
  if (cached) return cached

  const grid = await getGridPoint(lat, lon)
  const data = await fetchJson(grid.forecastHourly)
  const periods = data.properties.periods.map(p => ({
    startTime: p.startTime,
    temperature: p.temperature,
    temperatureUnit: p.temperatureUnit,
    windSpeed: p.windSpeed,
    windDirection: p.windDirection,
    shortForecast: p.shortForecast,
    icon: p.icon,
    isDaytime: p.isDaytime,
    probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value ?? 0
  }))

  setCache(key, periods)
  return periods
}

/**
 * Match forecast periods to a target arrival time.
 * Returns the period whose start hour is closest to the target.
 */
function matchForecastToTime(periods, targetDate) {
  if (!periods?.length) return null
  const targetMs = targetDate.getTime()

  let best = periods[0]
  let bestDiff = Infinity

  for (const p of periods) {
    const diff = Math.abs(new Date(p.startTime).getTime() - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      best = p
    }
  }
  return best
}

/**
 * Get active alerts for a lat/lon point.
 */
async function getAlerts(lat, lon) {
  const key = `nws-alerts-${lat.toFixed(4)},${lon.toFixed(4)}`
  const cached = getCached(key)
  if (cached) return cached

  try {
    const data = await fetchJson(`${NWS_BASE}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`)
    const alerts = (data.features || []).map(f => ({
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      description: f.properties.description,
      expires: f.properties.expires
    }))
    setCache(key, alerts)
    return alerts
  } catch {
    return []
  }
}

/**
 * Determine weather severity for rider safety.
 * Returns 'good', 'caution', or 'danger'.
 */
function riderSeverity(forecast) {
  if (!forecast) return 'unknown'

  const windMatch = forecast.windSpeed?.match(/(\d+)/)
  const wind = windMatch ? parseInt(windMatch[1]) : 0
  const precip = forecast.probabilityOfPrecipitation ?? 0
  const temp = forecast.temperature ?? 70
  const desc = (forecast.shortForecast || '').toLowerCase()

  // Danger
  if (wind >= 40 || temp <= 32 || temp >= 105 || desc.includes('thunderstorm') || desc.includes('tornado')) {
    return 'danger'
  }
  // Caution
  if (wind >= 20 || precip >= 30 || temp <= 40 || temp >= 100 || desc.includes('rain') || desc.includes('shower')) {
    return 'caution'
  }
  return 'good'
}

export function useWeather() {
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  async function fetchStopForecast(stop, arrivalDate) {
    try {
      const periods = await getHourlyForecast(stop.lat, stop.lon)
      const matched = matchForecastToTime(periods, arrivalDate)
      if (matched) {
        matched.severity = riderSeverity(matched)
      }
      return matched
    } catch (e) {
      // Try to return stale cache
      const key = cacheKey(stop.lat, stop.lon)
      const raw = localStorage.getItem(key)
      if (raw) {
        const { data } = JSON.parse(raw)
        const matched = matchForecastToTime(data, arrivalDate)
        if (matched) matched.severity = riderSeverity(matched)
        return matched
      }
      throw e
    }
  }

  async function fetchRouteForecasts(stops, departureMinutes) {
    loading.value = true
    error.value = null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const results = []

    for (const stop of stops) {
      const arrivalMinutes = departureMinutes + (stop.minutesFromStart || 0)
      const arrivalDate = new Date(today.getTime() + arrivalMinutes * 60 * 1000)

      try {
        const forecast = await fetchStopForecast(stop, arrivalDate)
        results.push({
          stop,
          arrivalTime: arrivalDate,
          forecast,
          error: null
        })
      } catch (e) {
        results.push({
          stop,
          arrivalTime: arrivalDate,
          forecast: null,
          error: e.message
        })
      }

      // Be polite to NWS — 200ms between requests
      await new Promise(r => setTimeout(r, 200))
    }

    loading.value = false
    lastUpdated.value = new Date()
    return results
  }

  async function fetchRouteAlerts(stops) {
    const allAlerts = []
    const seen = new Set()

    for (const stop of stops) {
      const alerts = await getAlerts(stop.lat, stop.lon)
      for (const a of alerts) {
        const key = a.headline
        if (!seen.has(key)) {
          seen.add(key)
          allAlerts.push({ ...a, nearStop: stop.name })
        }
      }
      await new Promise(r => setTimeout(r, 200))
    }

    return allAlerts
  }

  return {
    loading,
    error,
    lastUpdated,
    fetchRouteForecasts,
    fetchRouteAlerts,
    riderSeverity
  }
}
