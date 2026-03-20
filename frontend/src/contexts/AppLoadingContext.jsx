/**
 * Contexte pour gérer le chargement global de l'application
 * Attend que les données critiques soient chargées avant de masquer le LoadingScreen
 */
import { createContext, useContext } from 'react'

export const AppLoadingContext = createContext({
  isAppReady: false,
  setAppReady: () => {},
})

export const useAppLoading = () => useContext(AppLoadingContext)
