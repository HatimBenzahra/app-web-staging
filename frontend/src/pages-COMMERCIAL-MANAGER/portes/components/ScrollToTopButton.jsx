import React, { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

export default function ScrollToTopButton({
  scrollContainerClass = '.portes-scroll-container',
  targetElementRef = null,
  buttonText = 'Étages',
  showThreshold = 300,
}) {
  const [showScrollToTop, setShowScrollToTop] = useState(false)

  // Détecter le scroll pour afficher le bouton
  useEffect(() => {
    const handleScroll = e => {
      const scrollContainer = e.target
      setShowScrollToTop(scrollContainer.scrollTop > showThreshold)
    }

    // Attendre que le DOM soit complètement monté
    const timer = setTimeout(() => {
      const scrollContainer = document.querySelector(scrollContainerClass)
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll)
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      const scrollContainer = document.querySelector(scrollContainerClass)
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [scrollContainerClass, showThreshold])

  const scrollToTarget = () => {
    if (targetElementRef?.current) {
      // Si un élément cible est fourni, scroll vers cet élément
      targetElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      // Sinon, scroll vers le haut du container
      const scrollContainer = document.querySelector(scrollContainerClass)
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  if (!showScrollToTop) return null

  return (
    <button
      onClick={scrollToTarget}
      className="fixed bottom-28 sm:bottom-24 right-4 sm:right-6 z-50 flex flex-col items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-blue-400"
      aria-label="Remonter"
    >
      <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce mb-0.5 sm:mb-1" />
      <span className="font-bold text-[10px] sm:text-xs whitespace-nowrap">{buttonText}</span>
    </button>
  )
}
