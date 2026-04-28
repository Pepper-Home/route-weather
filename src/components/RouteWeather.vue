<script setup>
import { ref, watch } from 'vue'
import StopCard from './StopCard.vue'
import { useWeather } from '../composables/useWeather'
import { useOpenMeteo, calculateConfidence } from '../composables/useOpenMeteo'

const props = defineProps({
  day: Object,
  departureMinutes: Number
})

const { loading, lastUpdated, fetchStopForecast: fetchNWSForecast } = useWeather()
const { fetchStopForecast: fetchOMForecast } = useOpenMeteo()
const forecasts = ref([])

// Cached raw periods per stop — re-match without re-fetching on departure time change
const cachedPeriods = new Map()
let refreshVersion = 0

async function fetchAndCache(stop) {
  const key = `${stop.lat},${stop.lon}`
  if (cachedPeriods.has(key)) return cachedPeriods.get(key)

  const [nwsResult, omResult] = await Promise.allSettled([
    fetchNWSRaw(stop),
    fetchOMRaw(stop)
  ])

  const entry = {
    nwsPeriods: nwsResult.status === 'fulfilled' ? nwsResult.value : null,
    omPeriods: omResult.status === 'fulfilled' ? omResult.value : null
  }
  cachedPeriods.set(key, entry)
  return entry
}

async function fetchNWSRaw(stop) {
  // Access the raw hourly periods via the internal NWS fetch
  const forecast = await fetchNWSForecast(stop, new Date())
  // fetchStopForecast already caches — we re-fetch from cache below
  return null // we'll use the composable's matched result directly
}

async function fetchOMRaw(stop) {
  return null
}

async function refresh(forceRefetch = false) {
  if (!props.day?.stops?.length) return
  const myVersion = ++refreshVersion
  loading.value = true
  if (forceRefetch) cachedPeriods.clear()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const results = []
  // Process stops with bounded concurrency (3 at a time)
  const stops = [...props.day.stops]
  const concurrency = 3

  for (let i = 0; i < stops.length; i += concurrency) {
    if (myVersion !== refreshVersion) return // stale — abort

    const batch = stops.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(async (stop) => {
      const arrivalMinutes = props.departureMinutes + (stop.minutesFromStart || 0)
      const arrivalDate = new Date(today.getTime() + arrivalMinutes * 60 * 1000)

      const [nwsResult, omResult] = await Promise.allSettled([
        fetchNWSForecast(stop, arrivalDate),
        fetchOMForecast(stop, arrivalDate)
      ])

      const nws = nwsResult.status === 'fulfilled' ? nwsResult.value : null
      const om = omResult.status === 'fulfilled' ? omResult.value : null
      const confidence = calculateConfidence(nws, om)

      return {
        stop,
        arrivalTime: arrivalDate,
        nws,
        om,
        confidence,
        error: (!nws && !om) ? 'Both sources failed' : null
      }
    }))

    if (myVersion !== refreshVersion) return // stale — abort
    results.push(...batchResults)
    forecasts.value = [...results]
  }

  if (myVersion !== refreshVersion) return
  forecasts.value = results
  loading.value = false
  lastUpdated.value = new Date()
}

// Debounce departure time changes — only re-fetch on day change
let debounceTimer = null
watch(() => props.day?.id, () => refresh(true), { immediate: true })
watch(() => props.departureMinutes, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => refresh(false), 500)
})

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header bar -->
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-bold text-gray-600 dark:text-gray-400">
        {{ day.stops.length }} stops · {{ day.totalMiles }} mi
      </h2>
      <div class="flex items-center gap-2">
        <span v-if="lastUpdated" class="text-xs text-gray-400">
          Updated {{ formatTime(lastUpdated) }}
        </span>
        <button
          @click="refresh"
          :disabled="loading"
          class="text-xs bg-blue-500 text-white rounded-full px-3 py-1 hover:bg-blue-600 disabled:opacity-50"
        >
          {{ loading ? '⏳ Loading...' : '🔄 Refresh' }}
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && !forecasts.length" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    </div>

    <!-- Stop cards -->
    <StopCard
      v-for="(item, i) in forecasts"
      :key="item.stop.name"
      :stop="item.stop"
      :nws="item.nws"
      :om="item.om"
      :confidence="item.confidence"
      :arrivalTime="item.arrivalTime"
      :error="item.error"
      :index="i"
    />
  </div>
</template>
