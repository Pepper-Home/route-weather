import { ref, onMounted, onUnmounted } from 'vue'

export function useOffline() {
  const isOffline = ref(!navigator.onLine)

  function handleOnline() { isOffline.value = false }
  function handleOffline() { isOffline.value = true }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  function getLastUpdated(key) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const { ts } = JSON.parse(raw)
      return new Date(ts)
    } catch { return null }
  }

  return { isOffline, getLastUpdated }
}
