const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours — traffic patterns don't change that fast
const API_PATH = '/api/distance-matrix'

function cacheKey(stops) {
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
 * Fetch drive times between consecutive stops using a SINGLE Google Distance Matrix API call.
 * Sends origins (stops 0..N-2) and destinations (stops 1..N-1), extracts the diagonal
 * (row[i].elements[i]) for consecutive-pair durations.
 * Returns an array of cumulative minutes from the first stop.
 */
export async function fetchDriveTimes(stops, signal) {
  if (!stops?.length) return []
  if (stops.length === 1) return [0]

  const key = cacheKey(stops)
  const cached = getCached(key)
  if (cached) return cached

  // Build pipe-delimited coordinate strings for one batched call
  const origins = stops.slice(0, -1).map(s => `${s.lat},${s.lon}`).join('|')
  const destinations = stops.slice(1).map(s => `${s.lat},${s.lon}`).join('|')

  const res = await fetch(
    `${API_PATH}?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&departure_time=now`,
    signal ? { signal } : {}
  )
  if (!res.ok) throw new Error(`API ${res.status}`)

  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`Google status: ${data.status}`)

  // Extract diagonal: row[i].elements[i] = consecutive pair duration
  const legMinutes = [0]
  let cumulative = 0

  for (let i = 0; i < stops.length - 1; i++) {
    const element = data.rows?.[i]?.elements?.[i]

    if (element?.status === 'OK') {
      const seconds = element.duration_in_traffic?.value || element.duration?.value || 0
      cumulative += Math.round(seconds / 60)
    } else {
      // Fallback to static data for this leg
      const staticDelta = (stops[i + 1].minutesFromStart || 0) - (stops[i].minutesFromStart || 0)
      cumulative += staticDelta || 60
    }

    legMinutes.push(cumulative)
  }

  setCache(key, legMinutes)
  return legMinutes
}
