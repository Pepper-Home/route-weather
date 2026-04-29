import { ref, shallowRef } from 'vue'

const TRIPS_PATH = '/trips/'
const USER_TRIPS_KEY = 'rw-user-trips'
const DELETED_TRIPS_KEY = 'rw-deleted-trips'

function getUserTrips() {
  try {
    return JSON.parse(localStorage.getItem(USER_TRIPS_KEY)) || []
  } catch { return [] }
}

function saveUserTrips(trips) {
  localStorage.setItem(USER_TRIPS_KEY, JSON.stringify(trips))
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
      // Load built-in trips from server
      const index = await loadTripIndex()
      const results = await Promise.allSettled(index.map(entry => loadTrip(entry.file)))
      const builtIn = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

      // Load user-imported trips from localStorage
      const userTrips = getUserTrips()

      // Filter out deleted trips
      const deletedIds = getDeletedTripIds()
      const allTrips = [...builtIn, ...userTrips].filter(t => !deletedIds.includes(t.id))

      // Apply saved renames to built-in trips
      try {
        const renames = JSON.parse(localStorage.getItem('rw-trip-renames')) || {}
        for (const trip of allTrips) {
          if (renames[trip.id]) trip.name = renames[trip.id]
        }
      } catch { /* ignore */ }

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

  function importTrip(tripJson) {
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

    // Save to user trips
    const userTrips = getUserTrips()
    userTrips.push(tripJson)
    saveUserTrips(userTrips)

    // Un-delete if it was previously deleted
    const deletedIds = getDeletedTripIds()
    saveDeletedTripIds(deletedIds.filter(id => id !== tripJson.id))

    // Add to active list
    trips.value = [...trips.value, tripJson]

    return tripJson
  }

  function removeTrip(tripId) {
    // Remove from user trips if it's user-imported
    const userTrips = getUserTrips()
    saveUserTrips(userTrips.filter(t => t.id !== tripId))

    // Add to deleted list (handles built-in trips too)
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

  function renameTrip(tripId, newName) {
    if (!newName?.trim()) return

    // Update in user trips localStorage
    const userTrips = getUserTrips()
    const userTrip = userTrips.find(t => t.id === tripId)
    if (userTrip) {
      userTrip.name = newName.trim()
      saveUserTrips(userTrips)
    }

    // Also store rename overrides for built-in trips
    const RENAME_KEY = 'rw-trip-renames'
    try {
      const renames = JSON.parse(localStorage.getItem(RENAME_KEY)) || {}
      renames[tripId] = newName.trim()
      localStorage.setItem(RENAME_KEY, JSON.stringify(renames))
    } catch { /* ignore */ }

    // Update in active list
    const trip = trips.value.find(t => t.id === tripId)
    if (trip) {
      trip.name = newName.trim()
      trips.value = [...trips.value] // trigger reactivity
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
