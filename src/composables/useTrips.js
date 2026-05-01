import { ref, shallowRef } from 'vue'

const API_PATH = '/api/user-trips'
const LOGIN_PATH = '/.auth/login/github'

// Server-side trip storage via Azure Blob Storage
async function fetchUserTrips() {
  try {
    const res = await fetch(API_PATH)
    if (!res.ok) return []
    const data = await res.json()
    return data.trips || []
  } catch { return [] }
}

async function saveUserTripToServer(trip) {
  const res = await fetch(`${API_PATH}/${encodeURIComponent(trip.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip)
  })
  if (res.status === 401 || res.status === 403) throw new Error('AUTH_REQUIRED')
  if (!res.ok) throw new Error('Failed to save trip to server')
}

async function deleteUserTripFromServer(tripId) {
  const res = await fetch(`${API_PATH}/${encodeURIComponent(tripId)}`, { method: 'DELETE' })
  if (res.status === 401 || res.status === 403) throw new Error('AUTH_REQUIRED')
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`)
}

function handleAuthError(err) {
  if (err?.message === 'AUTH_REQUIRED') {
    if (confirm('Sign in with GitHub to manage trips?')) {
      // Use setTimeout to ensure navigation happens outside the async/catch context
      setTimeout(() => { window.location.href = LOGIN_PATH }, 0)
    }
    return true
  }
  return false
}

export function useTrips() {
  const trips = ref([])
  const selectedTrip = shallowRef(null)
  const selectedDay = shallowRef(null)
  const loading = ref(false)

  async function init() {
    loading.value = true
    try {
      trips.value = await fetchUserTrips()
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

    try {
      await saveUserTripToServer(tripJson)
    } catch (err) {
      if (handleAuthError(err)) return
      throw err
    }
    trips.value = [...trips.value, tripJson]
    return tripJson
  }

  async function removeTrip(tripId) {
    try {
      await deleteUserTripFromServer(tripId)
    } catch (err) {
      if (!handleAuthError(err)) alert('Failed to remove trip')
      return
    }

    trips.value = trips.value.filter(t => t.id !== tripId)

    if (selectedTrip.value?.id === tripId) {
      selectedTrip.value = null
      selectedDay.value = null
    }
  }

  async function renameTrip(tripId, newName) {
    if (!newName?.trim()) return

    const trip = trips.value.find(t => t.id === tripId)
    if (!trip) return

    const oldName = trip.name
    trip.name = newName.trim()
    trips.value = [...trips.value]

    try {
      await saveUserTripToServer(trip)
    } catch (err) {
      if (handleAuthError(err)) return
      trip.name = oldName
      trips.value = [...trips.value]
    }
  }

  return {
    trips,
    selectedTrip,
    selectedDay,
    loading,
    init,
    selectTrip,
    selectDay,
    importTrip,
    removeTrip,
    renameTrip
  }
}
