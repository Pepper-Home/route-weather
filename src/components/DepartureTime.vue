<script setup>
import { computed } from 'vue'

const model = defineModel({ type: Number, default: 480 })

const timeString = computed({
  get: () => {
    const h = Math.floor(model.value / 60)
    const m = model.value % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  },
  set: (val) => {
    const [h, m] = val.split(':').map(Number)
    model.value = h * 60 + m
  }
})

const displayTime = computed(() => {
  const h = Math.floor(model.value / 60)
  const m = model.value % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
})
</script>

<template>
  <div class="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 shadow-sm">
    <span class="text-lg">🕐</span>
    <div class="flex-1">
      <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400">Departure</label>
      <span class="text-sm font-bold">{{ displayTime }}</span>
    </div>
    <input
      type="time"
      :value="timeString"
      @input="timeString = $event.target.value"
      class="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-sm border-0"
    />
  </div>
</template>
