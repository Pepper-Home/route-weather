<script setup>
import { useOffline } from '../composables/useOffline'
const { isOffline } = useOffline()
</script>

<template>
  <div
    v-if="isOffline"
    class="bg-yellow-500 text-black text-center text-xs py-1.5 font-semibold"
  >
    📡 You're offline — showing cached forecasts
  </div>
</template>
