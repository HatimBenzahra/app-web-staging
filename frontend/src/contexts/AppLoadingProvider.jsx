import { useState, useEffect } from 'react'
import { AppLoadingContext } from './AppLoadingContext'

export function AppLoadingProvider({ children }) {
  const [isAppReady, setIsAppReady] = useState(false)
  const [hasCheckedCache, setHasCheckedCache] = useState(false)

  useEffect(() => {
    const checkCache = () => {
      setIsAppReady(true)

      setHasCheckedCache(true)
    }

    const timer = setTimeout(checkCache, 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AppLoadingContext.Provider value={{ isAppReady, setAppReady: setIsAppReady, hasCheckedCache }}>
      {children}
    </AppLoadingContext.Provider>
  )
}
