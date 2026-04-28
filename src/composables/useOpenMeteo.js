const OM_BASE = 'https://api.open-meteo.com/v1/forecast'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// WMO Weather Code descriptions
const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ slight hail', 99: 'Thunderstorm w/ heavy hail'
}

// Wind direction from degrees
function degToCompass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function cacheKey(lat, lon) {
  return `om-${lat.toFixed(2)},${lon.toFixed(2)}`
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
  } catch { /* storage full */ }
}

/**
 * Fetch hourly forecast from Open-Meteo for a location.
 * Returns normalized periods matching NWS format for easy comparison.
 */
async function fetchOpenMeteoHourly(lat, lon) {
  const key = cacheKey(lat, lon)
  const cached = getCached(key)
  if (cached) return cached

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,weather_code',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '3'
  })

  const res = await fetch(`${OM_BASE}?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = await res.json()

  // Normalize to same shape as NWS for easy comparison
  const periods = data.hourly.time.map((t, i) => ({
    startTime: t,
    temperature: Math.round(data.hourly.temperature_2m[i]),
    temperatureUnit: 'F',
    windSpeed: `${Math.round(data.hourly.wind_speed_10m[i])} mph`,
    windDirection: degToCompass(data.hourly.wind_direction_10m[i]),
    windSpeedNum: Math.round(data.hourly.wind_speed_10m[i]),
    shortForecast: WMO_CODES[data.hourly.weather_code[i]] || 'Unknown',
    probabilityOfPrecipitation: data.hourly.precipitation_probability[i] ?? 0,
    source: 'Open-Meteo (ECMWF)'
  }))

  setCache(key, periods)
  return periods
}

/**
 * Match forecast to target arrival time (same logic as NWS).
 */
function matchToTime(periods, targetDate) {
  if (!periods?.length) return null
  const targetMs = targetDate.getTime()
  let best = periods[0]
  let bestDiff = Infinity
  for (const p of periods) {
    const diff = Math.abs(new Date(p.startTime).getTime() - targetMs)
    if (diff < bestDiff) { bestDiff = diff; best = p }
  }
  return best
}

/**
 * Calculate confidence rating by comparing NWS and Open-Meteo forecasts.
 * Returns { level: 'high'|'medium'|'low', score: 0-100, details: string }
 */
export function calculateConfidence(nws, om) {
  if (!nws || !om) return { level: 'unknown', score: 0, emoji: '❓', details: 'Missing data from one source' }

  // Temperature difference
  const tempDiff = Math.abs((nws.temperature || 0) - (om.temperature || 0))

  // Precipitation difference
  const precipDiff = Math.abs(
    (nws.probabilityOfPrecipitation || 0) - (om.probabilityOfPrecipitation || 0)
  )

  // Wind speed difference
  const nwsWind = parseInt(nws.windSpeed) || 0
  const omWind = om.windSpeedNum || 0
  const windDiff = Math.abs(nwsWind - omWind)

  // Conditions agreement (rough match)
  const nwsDesc = (nws.shortForecast || '').toLowerCase()
  const omDesc = (om.shortForecast || '').toLowerCase()
  const bothRain = (nwsDesc.includes('rain') || nwsDesc.includes('shower')) &&
                   (omDesc.includes('rain') || omDesc.includes('shower'))
  const bothClear = (nwsDesc.includes('clear') || nwsDesc.includes('sunny')) &&
                    (omDesc.includes('clear') || omDesc.includes('sunny'))
  const bothCloudy = nwsDesc.includes('cloud') && omDesc.includes('cloud')
  const conditionsAgree = bothRain || bothClear || bothCloudy

  // Score: start at 100, subtract for disagreements
  let score = 100
  score -= Math.min(tempDiff * 4, 30)       // up to -30 for temp
  score -= Math.min(precipDiff * 0.5, 25)    // up to -25 for precip
  score -= Math.min(windDiff * 2, 20)        // up to -20 for wind
  if (!conditionsAgree) score -= 15          // -15 if conditions don't match
  score = Math.max(0, Math.round(score))

  let level, emoji
  if (score >= 75) { level = 'high'; emoji = '🟢' }
  else if (score >= 50) { level = 'medium'; emoji = '🟡' }
  else { level = 'low'; emoji = '🔴' }

  const details = [
    `Temp: ${tempDiff}°F diff`,
    `Precip: ${precipDiff}% diff`,
    `Wind: ${windDiff}mph diff`,
    conditionsAgree ? 'Conditions agree' : 'Conditions differ'
  ].join(' · ')

  return { level, score, emoji, details }
}

export function useOpenMeteo() {
  async function fetchStopForecast(stop, arrivalDate) {
    try {
      const periods = await fetchOpenMeteoHourly(stop.lat, stop.lon)
      const matched = matchToTime(periods, arrivalDate)
      return matched
    } catch (e) {
      // Try stale cache
      const key = cacheKey(stop.lat, stop.lon)
      const raw = localStorage.getItem(key)
      if (raw) {
        const { data } = JSON.parse(raw)
        return matchToTime(data, arrivalDate)
      }
      return null
    }
  }

  return { fetchStopForecast, calculateConfidence }
}
