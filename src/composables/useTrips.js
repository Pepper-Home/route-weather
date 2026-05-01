import { ref, shallowRef } from 'vue'

const TRIPS_PATH = '/trips/'
const API_PATH = '/api/user-trips'
const DELETED_TRIPS_KEY = 'rw-deleted-trips'
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
  await fetch(`${API_PATH}/${encodeURIComponent(tripId)}`, { method: 'DELETE' })
}

function getDeletedTripIds() {
  try {
    return JSON.parse(localStorage.getItem(DELETED_TRIPS_KEY)) || []
  } catch { return [] }
}

function saveDeletedTripIds(ids) {
  localStorage.setItem(DELETED_TRIPS_KEY, JSON.stringify(ids))
}

export function useTrips() {
  const trips = ref([])
  const selectedTrip = shallowRef(null)
  const selectedDay = shallowRef(null)
  const loading = ref(false)
  const authRequired = ref(false)
  const user = ref(null)

  async function loadTripIndex() {
    try {
      const res = await fetch(`${TRIPS_PATH}index.json`)
      if (!res.ok) throw new Error('Failed to load trip index')
      const index = await res.json()
      return index.trips || []
    } catch {
      return []
    }
  }

  async function loadTrip(tripFile) {
    const res = await fetch(`${TRIPS_PATH}${tripFile}`)
    if (!res.ok) throw new Error(`Failed to load trip: ${tripFile}`)
    return res.json()
  }

  async function init() {
    loading.value = true
    try {
      // Check authentication status
      user.value = await checkAuth()

      // Load built-in trips from static files
      const index = await loadTripIndex()
      const results = await Promise.allSettled(index.map(entry => loadTrip(entry.file)))
      const builtIn = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

      // Load user trips from server (Azure Blob Storage) — requires auth
      const serverResult = await fetchUserTrips()
      authRequired.value = serverResult.authRequired
      const userTrips = serverResult.trips

      // Filter out deleted built-in trips
      const deletedIds = getDeletedTripIds()
      const allTrips = [
        ...builtIn.filter(t => !deletedIds.includes(t.id)),
        ...userTrips
      ]

      trips.value = allTrips

      // Restore last selection
      const lastTripId = localStorage.getItem('rw-last-trip')
      const lastDayId = localStorage.getItem('rw-last-day')

      if (lastTripId) {
        const trip = allTrips.find(t => t.id === lastTripId)
        if (trip) {
          selectedTrip.value = trip
          if (lastDayId) {
            const day = trip.days.find(d => d.id === lastDayId)
            if (day) selectedDay.value = day
          }
        }
      }
    } finally {
      loading.value = false
    }
  }

  function selectTrip(trip) {
    selectedTrip.value = trip
    selectedDay.value = null
    localStorage.setItem('rw-last-trip', trip.id)
    localStorage.removeItem('rw-last-day')
  }

  function selectDay(day) {
    selectedDay.value = day
    localStorage.setItem('rw-last-day', day.id)
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

    // Check for duplicate ID
    if (trips.value.some(t => t.id === tripJson.id)) {
      throw new Error(`Trip with ID "${tripJson.id}" already exists`)
    }

    // Save to server
    await saveUserTripToServer(tripJson)

    // Un-delete if it was previously deleted
    const deletedIds = getDeletedTripIds()
    saveDeletedTripIds(deletedIds.filter(id => id !== tripJson.id))

    // Add to active list
    trips.value = [...trips.value, tripJson]

    return tripJson
  }

  async function removeTrip(tripId) {
    // Try to delete from server (works for user trips, no-op for built-in)
    await deleteUserTripFromServer(tripId)

    // Add to deleted list (handles built-in trips that can't be deleted from server)
    const deletedIds = getDeletedTripIds()
    if (!deletedIds.includes(tripId)) {
      deletedIds.push(tripId)
      saveDeletedTripIds(deletedIds)
    }

    // Remove from active list
    trips.value = trips.value.filter(t => t.id !== tripId)

    // Clear selection if deleted trip was selected
    if (selectedTrip.value?.id === tripId) {
      selectedTrip.value = null
      selectedDay.value = null
      localStorage.removeItem('rw-last-trip')
      localStorage.removeItem('rw-last-day')
    }
  }

  async function renameTrip(tripId, newName) {
    if (!newName?.trim()) return

    // Update in active list
    const trip = trips.value.find(t => t.id === tripId)
    if (trip) {
      trip.name = newName.trim()
      trips.value = [...trips.value] // trigger reactivity

      // If it's a server-side trip, save the updated version
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
