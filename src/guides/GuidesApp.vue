<script setup>
import { ref } from 'vue'

const API_PATH = '/api/user-trips'
const GUIDE_API = '/api/ride-guides'

const trips = ref([])
const selectedTrip = ref(null)
const loading = ref(false)
const error = ref(null)
const availableGuides = ref([])

async function loadTrips() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch(API_PATH)
    if (!res.ok) throw new Error('Failed to load trips')
    const data = await res.json()
    trips.value = data.trips || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function onTripSelected(tripId) {
  const trip = trips.value.find(t => t.id === tripId)
  selectedTrip.value = trip || null
  availableGuides.value = []
  error.value = null

  if (!trip) return

  try {
    const res = await fetch(`${GUIDE_API}/${encodeURIComponent(trip.id)}`)
    if (res.ok) {
      const data = await res.json()
      availableGuides.value = data.guides || []
    }
  } catch { /* ignore */ }
}

function openGuide(dayId) {
  window.location.href = `${GUIDE_API}/${encodeURIComponent(selectedTrip.value.id)}/${encodeURIComponent(dayId)}`
}

loadTrips()
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#f5f5f0]">
    <!-- Header -->
    <header class="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-white px-4 py-3 shadow-lg">
      <h1 class="text-xl font-bold tracking-wide">📋 Ride Guides</h1>
      <p class="text-xs opacity-75">Stop plans for your motorcycle trips</p>
    </header>

    <main class="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-8 text-gray-500">Loading trips...</div>

      <!-- Trip selector -->
      <div v-if="!loading">
        <label class="block text-sm font-semibold text-gray-600 mb-1">Trip</label>
        <select
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-blue-500"
          :value="selectedTrip?.id || ''"
          @change="onTripSelected($event.target.value)"
        >
          <option value="" disabled>Select a trip...</option>
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.name }}</option>
        </select>
      </div>

      <!-- Day selector -->
      <div v-if="selectedTrip">
        <label class="block text-sm font-semibold text-gray-600 mb-1">Day</label>
        <div class="grid grid-cols-1 gap-2">
          <button
            v-for="day in selectedTrip.days"
            :key="day.id"
            @click="availableGuides.includes(day.id) && openGuide(day.id)"
            class="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
            :class="availableGuides.includes(day.id)
              ? 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'"
          >
            <div class="flex items-center justify-between">
              <div class="font-semibold">{{ day.name }}</div>
              <span v-if="availableGuides.includes(day.id)" class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">📋 View Guide</span>
              <span v-else class="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">No guide</span>
            </div>
            <div class="text-xs text-gray-500">{{ day.totalMiles }} mi · {{ Math.floor(day.totalMinutes / 60) }}h {{ day.totalMinutes % 60 }}m · {{ day.stops.length }} stops</div>
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700">
        {{ error }}
      </div>
    </main>

    <footer class="text-center text-xs text-gray-400 py-4">
      <a href="/" class="underline">← Back to Route Weather</a>
    </footer>
  </div>
</template>
