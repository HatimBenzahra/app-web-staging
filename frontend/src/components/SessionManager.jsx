import { useEffect, useRef } from 'react'
import { authService } from '@/services/auth'
import { useRole } from '@/contexts/userole'

const IDLE_TIMEOUT = 24 * 60 * 60 * 1000 // 24 heures
const CHECK_INTERVAL = 60 * 1000 // 1 minute
const REFRESH_THRESHOLD = 5 * 60 * 1000 // 5 minutes

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

    const checkSession = async () => {
      if (!authService.isAuthenticated()) return

      const now = Date.now()
      const idleTime = now - lastActivityRef.current

      // 1. Check Inactivity
      if (idleTime >= IDLE_TIMEOUT) {
        logout()
        return
      }

      // 2. Check Token Expiration
      const exp = authService.getTokenExpiration()
      if (exp) {
        const timeUntilExp = exp * 1000 - now
        if (timeUntilExp < REFRESH_THRESHOLD) {
          const success = await authService.refreshToken()
          if (!success) {
            logout()
          }
        }
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
