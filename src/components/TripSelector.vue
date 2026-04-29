<script setup>
import { ref } from 'vue'
import TripImporter from './TripImporter.vue'

const props = defineProps({
  trips: Array,
  selectedTrip: Object,
  selectedDay: Object
})
const emit = defineEmits(['select-trip', 'select-day', 'import-trip', 'remove-trip', 'rename-trip'])

const showImporter = ref(false)
const showDeleteConfirm = ref(null)
const editingName = ref(false)
const editNameValue = ref('')

function startRename() {
  editNameValue.value = props.selectedTrip?.name || ''
  editingName.value = true
}

function saveRename() {
  if (editNameValue.value.trim()) {
    emit('rename-trip', props.selectedTrip.id, editNameValue.value.trim())
  }
  editingName.value = false
}
</script>

<template>
  <div class="space-y-3">
    <!-- Trip Importer (full panel when open) -->
    <TripImporter
      v-if="showImporter"
      @import-trip="(t) => { emit('import-trip', t); showImporter = false }"
      @close="showImporter = false"
    />

    <!-- Trip picker + manage buttons -->
    <div v-if="!showImporter">
      <div class="flex items-center justify-between mb-1">
        <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">Trip</label>
        <div class="flex gap-2">
          <button
            @click="showImporter = true"
            class="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors"
          >
            ➕ New Trip
          </button>
          <button
            v-if="selectedTrip"
            @click="showDeleteConfirm = selectedTrip.id"
            class="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors"
          >
            🗑️ Remove
          </button>
        </div>
      </div>

      <!-- Delete confirmation -->
      <div v-if="showDeleteConfirm" class="mb-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p class="text-sm text-red-700 dark:text-red-300 font-semibold">Remove "{{ selectedTrip?.name }}"?</p>
        <p class="text-xs text-gray-500 mt-1">This hides the trip. Use Clear Cache to restore built-in trips.</p>
        <div class="flex gap-2 mt-2">
          <button @click="emit('remove-trip', showDeleteConfirm); showDeleteConfirm = null" class="text-xs bg-red-500 text-white px-3 py-1 rounded">Yes, remove</button>
          <button @click="showDeleteConfirm = null" class="text-xs bg-gray-300 text-gray-700 px-3 py-1 rounded">Cancel</button>
        </div>
      </div>

      <!-- Rename inline editor -->
      <div v-if="editingName" class="mb-2 flex gap-2">
        <input
          v-model="editNameValue"
          @keyup.enter="saveRename"
          @keyup.escape="editingName = false"
          class="flex-1 rounded-lg border border-blue-400 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          autofocus
        />
        <button @click="saveRename" class="text-xs bg-blue-500 text-white px-3 py-1 rounded">✓</button>
        <button @click="editingName = false" class="text-xs bg-gray-300 text-gray-700 px-3 py-1 rounded">✕</button>
      </div>

      <div v-if="!editingName" class="flex gap-1">
        <select
          class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm shadow-sm focus:ring-2 focus:ring-blue-500"
          :value="selectedTrip?.id || ''"
          @change="emit('select-trip', trips.find(t => t.id === $event.target.value))"
        >
          <option value="" disabled>Select a trip...</option>
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.name }}</option>
        </select>
        <button
          v-if="selectedTrip"
          @click="startRename"
          class="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Rename trip"
        >✏️</button>
      </div>
    </div>

    <!-- Day picker -->
    <div v-if="selectedTrip && !showImporter">
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
