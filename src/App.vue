<script setup>
import { ref, onMounted } from 'vue'
import TripSelector from './components/TripSelector.vue'
import DepartureTime from './components/DepartureTime.vue'
import RouteWeather from './components/RouteWeather.vue'
import AlertBanner from './components/AlertBanner.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import { useTrips } from './composables/useTrips'

const { trips, selectedTrip, selectedDay, init, selectTrip, selectDay, importTrip, removeTrip, renameTrip } = useTrips()
const departureMinutes = ref(480) // 8:00 AM default (minutes since midnight)

onMounted(() => init())

async function clearAndReload() {
  // Nuke service worker caches (weather, ETAs, etc.)
  if ('caches' in window) {
    const names = await caches.keys()
    await Promise.all(names.map(n => caches.delete(n)))
  }

  // Unregister service worker so it re-fetches everything
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map(r => r.unregister()))
  }

  // Hard reload — like first visit
  window.location.reload()
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
        @import-trip="importTrip"
        @remove-trip="removeTrip"
        @rename-trip="renameTrip"
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

    <footer class="text-center text-xs text-gray-400 dark:text-gray-600 py-4 space-y-3">
      <div>Powered by <a href="https://www.weather.gov" class="underline">NWS API</a> · No tracking · Works offline</div>
      <button
        @click="clearAndReload"
        class="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg shadow-md transition-all"
      >
        🗑️ Clear Cache &amp; Reload
      </button>
      <br>
      <a
        href="/guides.html"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block bg-[#16213e] hover:bg-[#0f172a] active:bg-[#0a0f1a] text-white font-semibold text-sm px-6 py-2.5 rounded-lg shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-95 no-underline"
      >
        📋 Ride Guides
      </a>
    </footer>
  </div>
</template>
