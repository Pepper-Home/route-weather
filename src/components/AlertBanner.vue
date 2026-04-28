<script setup>
import { ref, watch } from 'vue'
import { useWeather } from '../composables/useWeather'

const props = defineProps({ stops: Array })
const { fetchRouteAlerts } = useWeather()
const alerts = ref([])

watch(() => props.stops, async (stops) => {
  if (!stops?.length) { alerts.value = []; return }
  alerts.value = await fetchRouteAlerts(stops)
}, { immediate: true })

function severityColor(severity) {
  switch (severity) {
    case 'Extreme': return 'bg-red-600 text-white'
    case 'Severe': return 'bg-red-500 text-white'
    case 'Moderate': return 'bg-yellow-500 text-black'
    case 'Minor': return 'bg-yellow-300 text-black'
    default: return 'bg-blue-500 text-white'
  }
}
</script>

<template>
  <div v-if="alerts.length" class="space-y-2">
    <div
      v-for="(alert, i) in alerts"
      :key="i"
      class="rounded-lg px-3 py-2 text-sm"
      :class="severityColor(alert.severity)"
    >
      <div class="font-bold">⚠️ {{ alert.event }}</div>
      <div class="text-xs mt-0.5 opacity-90">{{ alert.headline }}</div>
      <div class="text-xs mt-0.5 opacity-75">Near: {{ alert.nearStop }}</div>
    </div>
  </div>
</template>
