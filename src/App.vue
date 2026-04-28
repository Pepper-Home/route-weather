<script setup>
import { ref } from 'vue'
import TripSelector from './components/TripSelector.vue'
import DepartureTime from './components/DepartureTime.vue'
import RouteWeather from './components/RouteWeather.vue'
import AlertBanner from './components/AlertBanner.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import { useTrips } from './composables/useTrips'

const { trips, selectedTrip, selectedDay, selectTrip, selectDay } = useTrips()
const departureMinutes = ref(480) // 8:00 AM default (minutes since midnight)
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

    <footer class="text-center text-xs text-gray-400 dark:text-gray-600 py-4">
      Powered by <a href="https://www.weather.gov" class="underline">NWS API</a> · No tracking · Works offline
    </footer>
  </div>
</template>
