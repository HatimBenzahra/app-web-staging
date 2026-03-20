import { useState } from 'react'
import { DetailsSectionsContext } from './DetailsSectionsContext'

export function DetailsSectionsProvider({ children }) {
  const [sections, setSections] = useState([])
  const [focusedSection, setFocusedSection] = useState(null)

  return (
    <DetailsSectionsContext.Provider
      value={{ sections, setSections, focusedSection, setFocusedSection }}
    >
      {children}
    </DetailsSectionsContext.Provider>
  )
}
