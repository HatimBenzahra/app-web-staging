import { useState, useEffect } from 'react'
import { applyTheme, toggleTheme as toggleThemeUtil } from '@/config/theme/base'

/**
 * Hook personnalisé pour gérer le thème de l'application
 *
 * Exemple d'utilisation:
 * ```jsx
 * function MyComponent() {
 *   const { theme, toggleTheme, setTheme } = useTheme()
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       Mode: {theme}
 *     </button>
 *   )
 * }
 * ```
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Initialise avec le thème actuel
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? 'dark' : 'light'
  })

  // Toggle entre light et dark
  const toggleTheme = () => {
    const newTheme = toggleThemeUtil()
    setThemeState(newTheme)
  }

  // Définit un thème spécifique
  const setTheme = newTheme => {
    if (newTheme !== 'light' && newTheme !== 'dark') {
      console.error('Theme must be "light" or "dark"')
      return
    }

    applyTheme(newTheme)

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    localStorage.setItem('theme', newTheme)
    setThemeState(newTheme)
  }

  // Écoute les changements de préférence système
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = e => {
      // Ne change le thème automatiquement que si l'utilisateur n'a pas de préférence sauvegardée
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light'
        applyTheme(newTheme)
        setThemeState(newTheme)
      }
    }

    // Écoute aussi les changements de classe 'dark' sur documentElement
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      const currentTheme = isDark ? 'dark' : 'light'
      // Met à jour l'état seulement s'il a changé
      setThemeState(prev => {
        if (prev !== currentTheme) {
          return currentTheme
        }
        return prev
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    mediaQuery.addEventListener('change', handleChange)
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      observer.disconnect()
    }
  }, [])

  return {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  }
}
