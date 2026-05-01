import { ref, shallowRef } from 'vue'

const API_PATH = '/api/user-trips'
const AUTH_ME_PATH = '/.auth/me'
const LOGIN_PATH = '/.auth/login/github'

// Check if user is authenticated via SWA
async function checkAuth() {
  try {
    const res = await fetch(AUTH_ME_PATH)
    if (!res.ok) return null
    const data = await res.json()
    return data?.clientPrincipal || null
  } catch { return null }
}

// Server-side trip storage via Azure Blob Storage
async function fetchUserTrips() {
  try {
    const res = await fetch(API_PATH)
    if (res.status === 401) return { trips: [], authRequired: true }
    if (!res.ok) return { trips: [], authRequired: false }
    const data = await res.json()
    return { trips: data.trips || [], authRequired: false }
  } catch { return { trips: [], authRequired: false } }
}

async function saveUserTripToServer(trip) {
  const res = await fetch(`${API_PATH}/${encodeURIComponent(trip.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip)
  })
  if (!res.ok) throw new Error('Failed to save trip to server')
}

async function deleteUserTripFromServer(tripId) {
  const res = await fetch(`${API_PATH}/${encodeURIComponent(tripId)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`)
}

export function useTrips() {
  const trips = ref([])
  const selectedTrip = shallowRef(null)
  const selectedDay = shallowRef(null)
  const loading = ref(false)
  const authRequired = ref(false)
  const user = ref(null)

  async function init() {
    loading.value = true
    try {
      user.value = await checkAuth()

      // v2: single source of truth — Azure Blob Storage only
      const serverResult = await fetchUserTrips()
      authRequired.value = serverResult.authRequired
      trips.value = serverResult.trips
    } finally {
      loading.value = false
    }
  }

  function selectTrip(trip) {
    selectedTrip.value = trip
    selectedDay.value = null
  }

  function selectDay(day) {
    selectedDay.value = day
  }

  async function importTrip(tripJson) {
    // Validate structure
    if (!tripJson.id || !tripJson.name || !Array.isArray(tripJson.days)) {
      throw new Error('Invalid trip format: requires id, name, and days array')
    }
    for (const day of tripJson.days) {
      if (!day.id || !day.name || !Array.isArray(day.stops)) {
        throw new Error(`Invalid day format in "${day.name || 'unknown'}": requires id, name, and stops array`)
      }
      for (const stop of day.stops) {
        if (typeof stop.lat !== 'number' || typeof stop.lon !== 'number') {
          throw new Error(`Invalid stop "${stop.name || 'unknown'}": requires numeric lat and lon`)
        }
      }
    }

    if (trips.value.some(t => t.id === tripJson.id)) {
      throw new Error(`Trip with ID "${tripJson.id}" already exists`)
    }

    await saveUserTripToServer(tripJson)
    trips.value = [...trips.value, tripJson]
    return tripJson
  }

  async function removeTrip(tripId) {
    await deleteUserTripFromServer(tripId)

    trips.value = trips.value.filter(t => t.id !== tripId)

    if (selectedTrip.value?.id === tripId) {
      selectedTrip.value = null
      selectedDay.value = null
    }
  }

  async function renameTrip(tripId, newName) {
    if (!newName?.trim()) return

    const trip = trips.value.find(t => t.id === tripId)
    if (trip) {
      trip.name = newName.trim()
      trips.value = [...trips.value]
      await saveUserTripToServer(trip).catch(() => {})
    }
  }

  function login() {
    window.location.href = LOGIN_PATH
  }

  return {
    trips,
    selectedTrip,
    selectedDay,
    loading,
    authRequired,
    user,
    init,
    selectTrip,
    selectDay,
    importTrip,
    removeTrip,
    renameTrip,
    login
  }
}
