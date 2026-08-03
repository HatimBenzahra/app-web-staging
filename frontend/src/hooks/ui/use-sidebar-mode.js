import { useCallback, useState } from 'react'

const STORAGE_KEY = 'sidebar-mode'

export const SIDEBAR_MODES = {
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
}

/**
 * Mode d'affichage de la sidebar : `simple` ne montre que l'essentiel, `advanced`
 * toute la navigation.
 *
 * Persisté dans localStorage comme la préférence de thème. C'est donc une préférence
 * par navigateur et non par compte : un même utilisateur peut retrouver un mode
 * différent sur un autre poste. Le lier au profil demanderait un champ backend.
 *
 * Le défaut est `advanced` : on ne retire rien à personne sans action explicite.
 */
export function useSidebarMode() {
  const [mode, setModeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === SIDEBAR_MODES.SIMPLE ? SIDEBAR_MODES.SIMPLE : SIDEBAR_MODES.ADVANCED
  })

  const setMode = useCallback(nextMode => {
    if (nextMode !== SIDEBAR_MODES.SIMPLE && nextMode !== SIDEBAR_MODES.ADVANCED) {
      console.error('Sidebar mode must be "simple" or "advanced"')
      return
    }
    localStorage.setItem(STORAGE_KEY, nextMode)
    setModeState(nextMode)
  }, [])

  return {
    mode,
    setMode,
    isSimple: mode === SIDEBAR_MODES.SIMPLE,
  }
}
