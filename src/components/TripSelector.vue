<script setup>
defineProps({
  trips: Array,
  selectedTrip: Object,
  selectedDay: Object
})
const emit = defineEmits(['select-trip', 'select-day'])
</script>

<template>
  <div class="space-y-3">
    <!-- Trip picker -->
    <div>
      <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Trip</label>
      <select
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-blue-500"
        :value="selectedTrip?.id || ''"
        @change="emit('select-trip', trips.find(t => t.id === $event.target.value))"
      >
        <option value="" disabled>Select a trip...</option>
        <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.name }}</option>
      </select>
    </div>

    <!-- Day picker -->
    <div v-if="selectedTrip">
      <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Day</label>
      <div class="grid grid-cols-1 gap-2">
        <button
          v-for="day in selectedTrip.days"
          :key="day.id"
          @click="emit('select-day', day)"
          class="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
          :class="selectedDay?.id === day.id
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'"
        >
          <div class="font-semibold">{{ day.name }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ day.totalMiles }} mi · {{ Math.floor(day.totalMinutes / 60) }}h {{ day.totalMinutes % 60 }}m · {{ day.stops.length }} stops</div>
        </button>
      </div>
    </div>
  </div>
</template>
