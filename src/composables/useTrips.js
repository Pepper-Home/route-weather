import { ref, shallowRef } from 'vue'

const TRIPS_PATH = '/trips/'

export function useTrips() {
  const trips = ref([])
  const selectedTrip = shallowRef(null)
  const selectedDay = shallowRef(null)
  const loading = ref(false)

  async function loadTripIndex() {
    // Load the trip index file that lists available trips
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
      const index = await loadTripIndex()
      const loaded = []
      for (const entry of index) {
        try {
          const trip = await loadTrip(entry.file)
          loaded.push(trip)
        } catch (e) {
          console.warn(`Failed to load trip ${entry.file}:`, e)
        }
      }
      trips.value = loaded

      // Restore last selection from localStorage
      const lastTripId = localStorage.getItem('rw-last-trip')
      const lastDayId = localStorage.getItem('rw-last-day')

      if (lastTripId) {
        const trip = loaded.find(t => t.id === lastTripId)
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

  // Auto-init
  init()

  return {
    trips,
    selectedTrip,
    selectedDay,
    loading,
    selectTrip,
    selectDay
  }
}
