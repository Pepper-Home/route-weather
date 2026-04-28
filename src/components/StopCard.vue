<script setup>
const props = defineProps({
  stop: Object,
  forecast: Object,
  arrivalTime: Date,
  error: String,
  index: Number
})

const typeIcons = {
  start: '🟢', rest: '🪑', fuel: '⛽', lunch: '🍽️',
  destination: '🏁', planned: '📍', dragon: '🐉'
}

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function severityClasses(severity) {
  switch (severity) {
    case 'danger': return 'border-red-500 bg-red-50 dark:bg-red-900/20'
    case 'caution': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
    case 'good': return 'border-green-500 bg-green-50 dark:bg-green-900/20'
    default: return 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
  }
}

function weatherEmoji(desc) {
  if (!desc) return '❓'
  const d = desc.toLowerCase()
  if (d.includes('thunder')) return '⛈️'
  if (d.includes('rain') || d.includes('shower')) return '🌧️'
  if (d.includes('snow')) return '🌨️'
  if (d.includes('fog')) return '🌫️'
  if (d.includes('cloud') && d.includes('partly')) return '⛅'
  if (d.includes('cloud') || d.includes('overcast')) return '☁️'
  if (d.includes('wind')) return '💨'
  if (d.includes('sun') || d.includes('clear')) return '☀️'
  return '🌤️'
}
</script>

<template>
  <div
    class="rounded-lg border-l-4 px-3 py-2.5 shadow-sm transition-all"
    :class="forecast ? severityClasses(forecast.severity) : 'border-gray-300 bg-white dark:bg-gray-800'"
  >
    <!-- Stop header -->
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-1.5">
          <span class="text-base">{{ typeIcons[stop.type] || '📍' }}</span>
          <span class="font-bold text-sm">{{ stop.name }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          mi {{ stop.mile }} · ETA {{ formatTime(arrivalTime) }}
          <span v-if="stop.notes" class="ml-1">· {{ stop.notes }}</span>
        </div>
      </div>

      <!-- Big temp -->
      <div v-if="forecast" class="text-right">
        <div class="text-2xl font-bold leading-none">
          {{ weatherEmoji(forecast.shortForecast) }}
          {{ forecast.temperature }}°
        </div>
      </div>
    </div>

    <!-- Forecast details -->
    <div v-if="forecast" class="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-300">
      <span>💨 {{ forecast.windSpeed }} {{ forecast.windDirection }}</span>
      <span>💧 {{ forecast.probabilityOfPrecipitation }}%</span>
      <span class="flex-1 text-right italic">{{ forecast.shortForecast }}</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="mt-1 text-xs text-red-500">
      ⚠️ {{ error }}
    </div>

    <!-- Loading state -->
    <div v-else class="mt-1 text-xs text-gray-400 animate-pulse">
      Loading forecast...
    </div>
  </div>
</template>
