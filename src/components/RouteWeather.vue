<script setup>
import { ref, watch } from 'vue'
import StopCard from './StopCard.vue'
import { useWeather } from '../composables/useWeather'

const props = defineProps({
  day: Object,
  departureMinutes: Number
})

const { loading, lastUpdated, fetchRouteForecasts } = useWeather()
const forecasts = ref([])

async function refresh() {
  if (!props.day?.stops?.length) return
  forecasts.value = await fetchRouteForecasts(props.day.stops, props.departureMinutes)
}

watch(() => [props.day?.id, props.departureMinutes], refresh, { immediate: true })

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
      :forecast="item.forecast"
      :arrivalTime="item.arrivalTime"
      :error="item.error"
      :index="i"
    />
  </div>
</template>
