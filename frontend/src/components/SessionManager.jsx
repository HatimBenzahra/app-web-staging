import { useEffect, useRef } from 'react'
import { authService } from '@/services/auth'
import { useRole } from '@/contexts/userole'

const IDLE_TIMEOUT = 24 * 60 * 60 * 1000 // 24 heures
const CHECK_INTERVAL = 60 * 1000 // 1 minute

export function SessionManager() {
  const { logout } = useRole()
  const lastActivityRef = useRef(Date.now())
  const throttleTimeoutRef = useRef(null)

  useEffect(() => {
    // Initialize activity time on mount
    lastActivityRef.current = Date.now()

    // Throttled update to avoid too many updates
    const updateActivity = () => {
      // Clear existing timeout
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }

      // Update immediately
      lastActivityRef.current = Date.now()

      // Set a small throttle to avoid rapid consecutive updates
      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null
      }, 1000) // Throttle updates to max once per second
    }

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }))

    const checkSession = () => {
      if (!authService.isAuthenticated()) return

      const idleTime = Date.now() - lastActivityRef.current

      if (idleTime >= IDLE_TIMEOUT) {
        logout()
      }
    }

    // Run first check immediately
    checkSession()

    // Then run periodically
    const intervalId = setInterval(checkSession, CHECK_INTERVAL)

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity))
      clearInterval(intervalId)
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
    }
  }, [logout])

  return null
}

export default SessionManager
