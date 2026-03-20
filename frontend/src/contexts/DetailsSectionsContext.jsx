import { createContext, useContext } from 'react'

export const DetailsSectionsContext = createContext()

export function useDetailsSections() {
  const context = useContext(DetailsSectionsContext)
  if (!context) {
    throw new Error('useDetailsSections must be used within a DetailsSectionsProvider')
  }
  return context
}
