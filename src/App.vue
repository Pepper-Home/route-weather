<script setup>
import { ref, onMounted } from 'vue'
import TripSelector from './components/TripSelector.vue'
import DepartureTime from './components/DepartureTime.vue'
import RouteWeather from './components/RouteWeather.vue'
import AlertBanner from './components/AlertBanner.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import { useTrips } from './composables/useTrips'

const { trips, selectedTrip, selectedDay, init, selectTrip, selectDay } = useTrips()
const departureMinutes = ref(480) // 8:00 AM default (minutes since midnight)
const showClearConfirm = ref(false)
const clearDone = ref(false)

onMounted(() => init())

async function clearAllCaches() {
  // Clear localStorage
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key.startsWith('nws-') || key.startsWith('om-') || key.startsWith('dm-') || key.startsWith('rw-')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))

  // Clear service worker caches
  if ('caches' in window) {
    const names = await caches.keys()
    await Promise.all(names.map(n => caches.delete(n)))
  }

  showClearConfirm.value = false
  clearDone.value = true
  setTimeout(() => { clearDone.value = false }, 2000)

  // Re-init trips and reload weather
  await init()
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-white px-4 py-3 sticky top-0 z-50 shadow-lg">
      <h1 class="text-xl font-bold tracking-wide">🏍️ Route Weather</h1>
      <p class="text-xs opacity-75">Forecast along your ride</p>
    </header>

    <OfflineBanner />

    <main class="flex-1 px-4 py-4 max-w-lg mx-auto w-full space-y-4">
      <TripSelector
        :trips="trips"
        :selectedTrip="selectedTrip"
        :selectedDay="selectedDay"
        @select-trip="selectTrip"
        @select-day="selectDay"
      />

      <DepartureTime v-model="departureMinutes" />

      <AlertBanner
        v-if="selectedDay"
        :stops="selectedDay?.stops || []"
      />

      <RouteWeather
        v-if="selectedDay"
        :day="selectedDay"
        :departureMinutes="departureMinutes"
      />
    </main>

    <footer class="text-center text-xs text-gray-400 dark:text-gray-600 py-4 space-y-2">
      <div>Powered by <a href="https://www.weather.gov" class="underline">NWS API</a> · No tracking · Works offline</div>

      <!-- Clear cache -->
      <div v-if="clearDone" class="text-green-600 font-semibold">✅ All caches cleared!</div>
      <div v-else-if="showClearConfirm" class="space-x-2">
        <span class="text-red-500">Clear all cached data?</span>
        <button @click="clearAllCaches" class="bg-red-500 text-white text-xs px-2 py-0.5 rounded">Yes, clear</button>
        <button @click="showClearConfirm = false" class="bg-gray-300 text-gray-700 text-xs px-2 py-0.5 rounded">Cancel</button>
      </div>
      <button v-else @click="showClearConfirm = true" class="text-gray-400 hover:text-red-500 text-xs underline transition-colors">
        🗑️ Clear cache
      </button>
    </footer>
  </div>
</template>
