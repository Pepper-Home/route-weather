<script setup>
import { ref, watch } from 'vue'

const API_PATH = '/api/user-trips'
const GUIDE_API = '/api/ride-guides'

const trips = ref([])
const selectedTrip = ref(null)
const selectedDay = ref(null)
const guideHtml = ref(null)
const loading = ref(false)
const guideLoading = ref(false)
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
  selectedDay.value = null
  guideHtml.value = null
  availableGuides.value = []

  if (!trip) return

  // Check which guides exist for this trip
  try {
    const res = await fetch(`${GUIDE_API}/${encodeURIComponent(trip.id)}`)
    if (res.ok) {
      const data = await res.json()
      availableGuides.value = data.guides || []
    }
  } catch { /* ignore — just means no guides badge */ }
}

async function onDaySelected(dayId) {
  const day = selectedTrip.value?.days.find(d => d.id === dayId)
  selectedDay.value = day || null
  guideHtml.value = null
  error.value = null

  if (!day || !selectedTrip.value) return

  guideLoading.value = true
  try {
    const res = await fetch(`${GUIDE_API}/${encodeURIComponent(selectedTrip.value.id)}/${encodeURIComponent(day.id)}`)
    if (res.status === 404) {
      guideHtml.value = null
      error.value = 'No ride guide available for this day yet.'
      return
    }
    if (!res.ok) throw new Error('Failed to load guide')
    const data = await res.json()
    guideHtml.value = data.html
  } catch (e) {
    error.value = e.message
  } finally {
    guideLoading.value = false
  }
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

    <main class="flex-1 px-4 py-4 max-w-4xl mx-auto w-full space-y-4">
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
            @click="onDaySelected(day.id)"
            class="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
            :class="selectedDay?.id === day.id
              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500'
              : 'border-gray-200 bg-white hover:border-blue-300'"
          >
            <div class="flex items-center justify-between">
              <div class="font-semibold">{{ day.name }}</div>
              <span v-if="availableGuides.includes(day.id)" class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">📋 Guide</span>
              <span v-else class="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">No guide</span>
            </div>
            <div class="text-xs text-gray-500">{{ day.totalMiles }} mi · {{ Math.floor(day.totalMinutes / 60) }}h {{ day.totalMinutes % 60 }}m · {{ day.stops.length }} stops</div>
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error && !guideLoading" class="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700">
        {{ error }}
      </div>

      <!-- Guide loading -->
      <div v-if="guideLoading" class="text-center py-8 text-gray-500">Loading ride guide...</div>

      <!-- Guide content in sandboxed iframe -->
      <div v-if="guideHtml && !guideLoading" class="rounded-lg overflow-hidden shadow-lg border border-gray-200">
        <iframe
          :srcdoc="guideHtml"
          sandbox="allow-popups"
          class="w-full border-0"
          style="min-height: 80vh;"
          @load="$event.target.style.height = $event.target.contentDocument?.documentElement?.scrollHeight + 'px'"
        ></iframe>
      </div>
    </main>

    <footer class="text-center text-xs text-gray-400 py-4">
      <a href="/" class="underline">← Back to Route Weather</a>
    </footer>
  </div>
</template>
