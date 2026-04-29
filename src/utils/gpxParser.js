/**
 * GPX Parser for Harley-Davidson Ride Planner exports.
 * Parses GPX XML → route stops for the weather app.
 *
 * HD Ride Planner GPX structure:
 *   <wpt> — start/end waypoints with addresses + lat/lon
 *   <rte> — route with name
 *     <rtept> — route points (start/end) containing:
 *       <gpxs:rteSoftPt> — intermediate turn/maneuver points with lat/lon + road names
 */

const GPXS_NS = 'https://www.nng.com/routing/xmlschemas/gpxext/v1'
const AVG_SPEED_MPH = 55 // motorcycle touring average
const FUEL_INTERVAL_MI = 150
const REST_INTERVAL_MIN = 60
const MIN_STOP_SEPARATION_MI = 20

/**
 * Haversine distance between two lat/lon points in miles.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Parse a GPX file string into a structured route object.
 * @param {string} gpxString - raw GPX XML content
 * @returns {{ routeName: string, waypoints: Array, points: Array, totalMiles: number }}
 */
export function parseGpx(gpxString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(gpxString, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Invalid GPX file: XML parse error')
  }

  const rteEl = doc.getElementsByTagName('rte')[0]
  const routeName = rteEl?.getElementsByTagName('name')[0]?.textContent || 'Unnamed Route'

  // Waypoints (start/end with full addresses)
  const wptEls = doc.getElementsByTagName('wpt')
  const waypoints = []
  for (let i = 0; i < wptEls.length; i++) {
    waypoints.push({
      lat: parseFloat(wptEls[i].getAttribute('lat')),
      lon: parseFloat(wptEls[i].getAttribute('lon')),
      name: wptEls[i].getElementsByTagName('name')[0]?.textContent || '',
      desc: wptEls[i].getElementsByTagName('desc')[0]?.textContent || ''
    })
  }

  if (waypoints.length < 2) {
    throw new Error('GPX must have at least 2 waypoints (start and end)')
  }

  // Build full point chain: start rtept → all softPts → end rtept
  const rteptEls = doc.getElementsByTagName('rtept')
  const points = []

  points.push({
    lat: parseFloat(rteptEls[0].getAttribute('lat')),
    lon: parseFloat(rteptEls[0].getAttribute('lon')),
    road: null
  })

  const softPts = doc.getElementsByTagNameNS(GPXS_NS, 'rteSoftPt')
  for (let i = 0; i < softPts.length; i++) {
    const roadEl = softPts[i].getElementsByTagNameNS(GPXS_NS, 'roadName')[0]
    points.push({
      lat: parseFloat(softPts[i].getAttribute('lat')),
      lon: parseFloat(softPts[i].getAttribute('lon')),
      road: roadEl?.textContent || null
    })
  }

  if (rteptEls.length > 1) {
    points.push({
      lat: parseFloat(rteptEls[rteptEls.length - 1].getAttribute('lat')),
      lon: parseFloat(rteptEls[rteptEls.length - 1].getAttribute('lon')),
      road: null
    })
  }

  // Cumulative distances
  let totalMiles = 0
  const cumDist = [0]
  for (let i = 1; i < points.length; i++) {
    totalMiles += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon)
    cumDist.push(totalMiles)
  }
  points.forEach((p, i) => { p.mile = Math.round(cumDist[i]) })

  return { routeName, waypoints, points, totalMiles: Math.round(totalMiles) }
}

/**
 * Find the point nearest to a target mile marker.
 */
function nearestPoint(points, targetMile) {
  let best = points[0]
  let bestDiff = Math.abs(points[0].mile - targetMile)
  for (const p of points) {
    const diff = Math.abs(p.mile - targetMile)
    if (diff < bestDiff) { best = p; bestDiff = diff }
  }
  return best
}

function tooCloseToExisting(stops, candidateMile) {
  return stops.some(s => Math.abs(s.mile - candidateMile) < MIN_STOP_SEPARATION_MI)
}

/**
 * Extract city name from a full address string.
 * e.g. "350 SE 6th Ave, Amarillo, TX 79101-2461, United States" → "Amarillo, TX"
 */
function extractCity(desc) {
  if (!desc) return null
  const parts = desc.split(',').map(p => p.trim())
  if (parts.length >= 3) {
    const city = parts[1]
    const stateZip = parts[2].replace(/\d{5}(-\d{4})?/, '').trim()
    return `${city}, ${stateZip}`
  }
  return null
}

/**
 * Generate weather-app stops from parsed GPX data.
 * City names are placeholders — call enrichStopNames() after for Google geocoded names.
 */
export function generateStops(parsed) {
  const { waypoints, points, totalMiles } = parsed
  const stops = []

  // Start
  stops.push({
    name: extractCity(waypoints[0].desc) || 'Start',
    lat: waypoints[0].lat,
    lon: waypoints[0].lon,
    mile: 0,
    minutesFromStart: 0,
    type: 'start',
    notes: waypoints[0].desc || ''
  })

  // Fuel stops at ~150mi intervals
  const fuelCount = Math.floor(totalMiles / FUEL_INTERVAL_MI)
  for (let i = 1; i <= fuelCount; i++) {
    const targetMile = i * FUEL_INTERVAL_MI
    if (targetMile >= totalMiles - 30) break
    const pt = nearestPoint(points, targetMile)
    if (!tooCloseToExisting(stops, pt.mile)) {
      stops.push({
        name: pt.road ? `Fuel Stop (${pt.road})` : `Fuel Stop ~Mile ${pt.mile}`,
        lat: pt.lat,
        lon: pt.lon,
        mile: pt.mile,
        minutesFromStart: Math.round(pt.mile / AVG_SPEED_MPH * 60),
        type: 'fuel',
        notes: 'Auto-generated fuel stop'
      })
    }
  }

  // Rest stops at ~60min intervals (skip if near existing stop)
  const restInterval = AVG_SPEED_MPH // ~55mi per hour
  const restCount = Math.floor(totalMiles / restInterval)
  for (let i = 1; i <= restCount; i++) {
    const targetMile = i * restInterval
    if (targetMile >= totalMiles - 30) break
    if (!tooCloseToExisting(stops, targetMile)) {
      const pt = nearestPoint(points, targetMile)
      stops.push({
        name: pt.road ? `Rest (${pt.road})` : `Rest Stop ~Mile ${pt.mile}`,
        lat: pt.lat,
        lon: pt.lon,
        mile: pt.mile,
        minutesFromStart: Math.round(pt.mile / AVG_SPEED_MPH * 60),
        type: 'rest',
        notes: 'Auto-generated rest stop'
      })
    }
  }

  // Destination
  const lastWpt = waypoints[waypoints.length - 1]
  stops.push({
    name: extractCity(lastWpt.desc) || 'Destination',
    lat: lastWpt.lat,
    lon: lastWpt.lon,
    mile: totalMiles,
    minutesFromStart: Math.round(totalMiles / AVG_SPEED_MPH * 60),
    type: 'destination',
    notes: lastWpt.desc || ''
  })

  stops.sort((a, b) => a.mile - b.mile)
  return stops
}

/**
 * Enrich stop names using Google Reverse Geocoding via Function App proxy.
 */
export async function enrichStopNames(stops, apiBase) {
  const toGeocode = stops.filter(s => s.type === 'fuel' || s.type === 'rest')
  if (toGeocode.length === 0) return stops

  const latlng = toGeocode.map(s => `${s.lat},${s.lon}`).join('|')
  try {
    const res = await fetch(`${apiBase}/api/reverse-geocode?latlng=${encodeURIComponent(latlng)}`)
    if (!res.ok) return stops

    const data = await res.json()
    if (!data.results) return stops

    toGeocode.forEach((stop, i) => {
      const geo = data.results[i]
      if (geo?.city && geo?.state) {
        const prefix = stop.type === 'fuel' ? 'Fuel' : 'Rest'
        stop.name = `${prefix} — ${geo.city}, ${geo.state}`
        if (geo.road) stop.notes = geo.road
      }
    })
  } catch {
    // Geocoding failed — keep original names
  }

  return stops
}

/**
 * Build a trip day object ready for the trip JSON.
 */
export function buildTripDay(dayId, dayName, stops, totalMiles) {
  return {
    id: dayId,
    name: dayName,
    totalMiles,
    totalMinutes: Math.round(totalMiles / AVG_SPEED_MPH * 60),
    stops
  }
}
