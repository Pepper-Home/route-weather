<script setup>
const props = defineProps({
  stop: Object,
  nws: Object,
  om: Object,
  confidence: Object,
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

function confidenceBorder(level) {
  switch (level) {
    case 'high': return 'border-green-500'
    case 'medium': return 'border-yellow-500'
    case 'low': return 'border-red-500'
    default: return 'border-gray-300 dark:border-gray-600'
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
  if (d.includes('clear') || d.includes('sun')) return '☀️'
  return '🌤️'
}
</script>

<template>
  <div
    class="rounded-lg border-l-4 shadow-sm bg-white dark:bg-gray-800 overflow-hidden"
    :class="confidenceBorder(confidence?.level)"
  >
    <!-- Stop header -->
    <div class="px-3 py-2 bg-gray-50 dark:bg-gray-750">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="text-base">{{ typeIcons[stop.type] || '📍' }}</span>
          <span class="font-bold text-sm">{{ stop.name }}</span>
        </div>
        <!-- Confidence badge -->
        <span
          v-if="confidence && confidence.level !== 'unknown'"
          class="text-xs font-bold px-2 py-0.5 rounded-full"
          :class="{
            'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300': confidence.level === 'high',
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300': confidence.level === 'medium',
            'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300': confidence.level === 'low'
          }"
        >
          {{ confidence.emoji }} {{ confidence.score }}%
        </span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        mi {{ stop.mile }} · ETA {{ formatTime(arrivalTime) }} <span v-if="stop.tz" class="text-yellow-600 dark:text-yellow-400">({{ stop.tz }})</span>
        <span v-if="stop.notes" class="ml-1">· {{ stop.notes }}</span>
      </div>
    </div>

    <!-- Dual forecast comparison -->
    <div v-if="nws || om" class="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
      <!-- NWS Column -->
      <div class="px-3 py-2">
        <div class="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">NWS (GFS)</div>
        <template v-if="nws">
          <div class="text-xl font-bold">{{ weatherEmoji(nws.shortForecast) }} {{ nws.temperature }}°</div>
          <div class="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-0.5">
            <div>💨 {{ nws.windSpeed }} {{ nws.windDirection }}</div>
            <div>💧 {{ nws.probabilityOfPrecipitation }}%</div>
            <div class="italic text-gray-500">{{ nws.shortForecast }}</div>
          </div>
        </template>
        <div v-else class="text-xs text-gray-400 italic">Unavailable</div>
      </div>

      <!-- Open-Meteo Column -->
      <div class="px-3 py-2">
        <div class="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">ECMWF (EU)</div>
        <template v-if="om">
          <div class="text-xl font-bold">{{ weatherEmoji(om.shortForecast) }} {{ om.temperature }}°</div>
          <div class="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-0.5">
            <div>💨 {{ om.windSpeed }} {{ om.windDirection }}</div>
            <div>💧 {{ om.probabilityOfPrecipitation }}%</div>
            <div class="italic text-gray-500">{{ om.shortForecast }}</div>
          </div>
        </template>
        <div v-else class="text-xs text-gray-400 italic">Unavailable</div>
      </div>
    </div>

    <!-- Confidence detail bar -->
    <div
      v-if="confidence && confidence.level !== 'unknown'"
      class="px-3 py-1.5 text-[10px] border-t border-gray-200 dark:border-gray-700"
      :class="{
        'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400': confidence.level === 'high',
        'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400': confidence.level === 'medium',
        'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400': confidence.level === 'low'
      }"
    >
      {{ confidence.emoji }} Confidence: <strong>{{ confidence.level.toUpperCase() }}</strong> · {{ confidence.details }}
    </div>

    <!-- Stale forecast warning -->
    <div
      v-if="nws?.staleWarning || om?.staleWarning"
      class="px-3 py-1.5 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-t border-red-200"
    >
      ⚠️ Forecast may be inaccurate — closest available data is {{ nws?.staleDeltaHrs || om?.staleDeltaHrs }}+ hours from your ETA
    </div>

    <!-- Error state -->
    <div v-if="error" class="px-3 py-2 text-xs text-red-500">
      ⚠️ {{ error }}
    </div>

    <!-- Loading state -->
    <div v-if="!nws && !om && !error" class="px-3 py-2 text-xs text-gray-400 animate-pulse">
      Loading forecasts...
    </div>
  </div>
</template>
