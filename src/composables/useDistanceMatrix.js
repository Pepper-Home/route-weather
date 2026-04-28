const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours — traffic patterns don't change that fast
const API_PATH = '/api/distance-matrix'

function cacheKey(stops) {
  // Cache by the set of stop coordinates + date (traffic varies by day)
  const today = new Date().toISOString().slice(0, 10)
  const coords = stops.map(s => `${s.lat.toFixed(3)},${s.lon.toFixed(3)}`).join('|')
  return `dm-${today}-${coords}`
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
 * Fetch drive times between consecutive stops using Google Distance Matrix API.
 * Returns an array of cumulative minutes from the first stop.
 * Uses our serverless proxy at /api/distance-matrix to keep the API key server-side.
 */
export async function fetchDriveTimes(stops) {
  if (!stops?.length) return []
  if (stops.length === 1) return [0]

  const key = cacheKey(stops)
  const cached = getCached(key)
  if (cached) return cached

  // Build consecutive pairs: stop0→stop1, stop1→stop2, etc.
  // Google Distance Matrix can handle multiple origins/destinations in one call
  // But for consecutive pairs, we need to batch them
  const origins = stops.slice(0, -1).map(s => `${s.lat},${s.lon}`).join('|')
  const destinations = stops.slice(1).map(s => `${s.lat},${s.lon}`).join('|')

  // Unfortunately Distance Matrix returns a full matrix, not sequential pairs.
  // So we call one pair at a time (still fast — ~8 calls max, all cached for 4hrs)
  const legMinutes = [0] // first stop = 0 cumulative minutes
  let cumulative = 0

  for (let i = 0; i < stops.length - 1; i++) {
    const origin = `${stops[i].lat},${stops[i].lon}`
    const dest = `${stops[i + 1].lat},${stops[i + 1].lon}`

    try {
      const res = await fetch(`${API_PATH}?origins=${origin}&destinations=${dest}&departure_time=now`)
      if (!res.ok) throw new Error(`API ${res.status}`)

      const data = await res.json()
      const element = data.rows?.[0]?.elements?.[0]

      if (element?.status === 'OK') {
        // Prefer duration_in_traffic if available, otherwise duration
        const seconds = element.duration_in_traffic?.value || element.duration?.value || 0
        cumulative += Math.round(seconds / 60)
      } else {
        // Fallback: use the static minutesFromStart from trip data
        cumulative = stops[i + 1].minutesFromStart || cumulative + 60
      }
    } catch {
      // API failed — fall back to static trip data
      cumulative = stops[i + 1].minutesFromStart || cumulative + 60
    }

    legMinutes.push(cumulative)
  }

  setCache(key, legMinutes)
  return legMinutes
}
