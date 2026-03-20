import React from 'react'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[9999]">
      <div className="flex flex-col items-center justify-center gap-12">
       

        {/* Points de chargement animés */}
        <div className="flex gap-2 animate-fade-in opacity-0 animation-delay-1000">
          <div className="w-6 h-6 rounded-full bg-primary animate-bounce"></div>
          <div className="w-6 h-6 rounded-full bg-primary animate-bounce animation-delay-200"></div>
          <div className="w-6 h-6 rounded-full bg-primary animate-bounce animation-delay-400"></div>
        </div>
      </div>
    </div>
  )
}
