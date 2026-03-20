import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
    const mainEl = document.querySelector('[data-slot="sidebar-inset"]')
    if (mainEl) mainEl.scrollTop = 0
  }, [pathname])

  return null
}
