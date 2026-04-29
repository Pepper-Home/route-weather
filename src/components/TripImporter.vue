<script setup>
import { ref, computed } from 'vue'
import { parseGpx, generateStops, enrichStopNames, buildTripDay } from '../utils/gpxParser.js'

const emit = defineEmits(['import-trip', 'close'])

const tripName = ref('')
const days = ref([]) // array of { dayName, stops, totalMiles, fileName }
const loading = ref(false)
const error = ref('')
const step = ref('upload') // 'upload' | 'preview'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function handleFile(event) {
  const file = event.target.files[0]
  if (!file) return
  error.value = ''
  loading.value = true

  try {
    const text = await file.text()
    const isJson = file.name.endsWith('.json')

    if (isJson) {
      // Direct trip JSON import (from Ride Planning Skill output)
      const json = JSON.parse(text)
      if (!json.name || !json.days?.length) {
        throw new Error('Invalid trip JSON: must have "name" and "days" array')
      }
      tripName.value = json.name
      for (const day of json.days) {
        if (!day.stops?.length) continue
        days.value.push({
          dayName: day.name || `Day ${days.value.length + 1}`,
          stops: day.stops,
          totalMiles: day.totalMiles || 0,
          fileName: file.name
        })
      }
    } else {
      // GPX import
      const parsed = parseGpx(text)
      if (!tripName.value) tripName.value = parsed.routeName
      let stops = generateStops(parsed)
      stops = await enrichStopNames(stops, API_BASE)
      const startName = stops[0]?.name || 'Start'
      const endName = stops[stops.length - 1]?.name || 'End'
      const dayNum = days.value.length + 1
      days.value.push({
        dayName: `Day ${dayNum}: ${startName} → ${endName}`,
        stops,
        totalMiles: parsed.totalMiles,
        fileName: file.name
      })
    }

    step.value = 'preview'
  } catch (e) {
    error.value = e.message || 'Failed to parse GPX file'
  } finally {
    loading.value = false
    event.target.value = '' // reset file input for re-upload
  }
}

function removeDay(index) {
  days.value.splice(index, 1)
  if (days.value.length === 0) step.value = 'upload'
}

function saveTrip() {
  if (!tripName.value.trim() || days.value.length === 0) return

  const tripId = slugify(tripName.value) + '-' + Date.now()
  const trip = {
    id: tripId,
    name: tripName.value.trim(),
    days: days.value.map((d, i) => buildTripDay(
      `${tripId}-day${i + 1}`,
      d.dayName,
      d.stops,
      d.totalMiles
    ))
  }

  emit('import-trip', trip)
  reset()
}

function reset() {
  tripName.value = ''
  days.value = []
  error.value = ''
  step.value = 'upload'
  emit('close')
}

const canSave = computed(() => tripName.value.trim() && days.value.length > 0)
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-lg">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">➕ New Trip from GPX</h3>
      <button @click="reset" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
    </div>

    <!-- Trip Name -->
    <div class="mb-3">
      <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Trip Name</label>
      <input
        v-model="tripName"
        type="text"
        placeholder="e.g., Route 66 Return Trip"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- Upload GPX -->
    <div class="mb-3">
      <label class="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
        Add Day from File
        <span class="font-normal text-xs text-gray-400">(.gpx from HD Ride Planner or .json from Ride Planning Skill)</span>
      </label>
      <input
        type="file"
        accept=".gpx,.json"
        @change="handleFile"
        :disabled="loading"
        class="text-sm w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:text-xs file:cursor-pointer hover:file:bg-blue-600"
      />
      <p v-if="loading" class="text-xs text-blue-500 mt-1">⏳ Parsing & geocoding stops...</p>
      <p v-if="error" class="text-xs text-red-500 mt-1">❌ {{ error }}</p>
    </div>

    <!-- Days Preview -->
    <div v-if="days.length > 0" class="space-y-3 mb-3">
      <div v-for="(day, dIdx) in days" :key="dIdx" class="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <input
            v-model="day.dayName"
            class="flex-1 text-sm font-semibold bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none px-1 py-0.5"
          />
          <button @click="removeDay(dIdx)" class="text-red-400 hover:text-red-600 text-xs ml-2">✕ Remove</button>
        </div>
        <div class="text-xs text-gray-500 mb-2">{{ day.totalMiles }} mi · {{ day.stops.length }} stops · {{ day.fileName }}</div>

        <!-- Stop preview table -->
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-left text-gray-500 border-b">
                <th class="py-1 pr-2">Mile</th>
                <th class="py-1 pr-2">Type</th>
                <th class="py-1">Name</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(stop, sIdx) in day.stops" :key="sIdx" class="border-b border-gray-100 dark:border-gray-700">
                <td class="py-1 pr-2 tabular-nums">{{ stop.mile }}</td>
                <td class="py-1 pr-2">
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                    :class="{
                      'bg-green-100 text-green-700': stop.type === 'start',
                      'bg-orange-100 text-orange-700': stop.type === 'fuel',
                      'bg-blue-100 text-blue-700': stop.type === 'rest',
                      'bg-red-100 text-red-700': stop.type === 'destination'
                    }"
                  >{{ stop.type }}</span>
                </td>
                <td class="py-1">{{ stop.name }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-xs text-gray-400">Upload another GPX to add more days to this trip.</p>
    </div>

    <!-- Actions -->
    <div class="flex gap-2">
      <button
        @click="saveTrip"
        :disabled="!canSave"
        class="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
        :class="canSave ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'"
      >
        ✅ Save Trip
      </button>
      <button @click="reset" class="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
        Cancel
      </button>
    </div>
  </div>
</template>
