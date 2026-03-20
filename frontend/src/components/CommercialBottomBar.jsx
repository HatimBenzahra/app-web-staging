import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { useRole } from '@/contexts/userole'
import { LogOut, X } from 'lucide-react'

export default function CommercialBottomBar({ navigationItems, activeTab, onTabChange }) {
  const { colors, base } = useCommercialTheme()
  const { logout } = useRole()
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      {/* Overlay menu moderne */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-md z-40 animate-in fade-in duration-300"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-xs bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header du menu */}
            <div className="px-5 py-4 border-b border-gray-100/80 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-transparent">
              <h3 className={`font-semibold text-gray-900 ${base.text.primary}`}>Menu</h3>
              <button
                onClick={() => setShowMenu(false)}
                className="p-1.5 hover:bg-gray-100/80 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Fermer"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Actions du menu */}
            <div className="p-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-red-600 hover:bg-red-50/80 transition-all duration-200 active:scale-[0.98] hover:shadow-md hover:shadow-red-100"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-red-50 rounded-full flex items-center justify-center shadow-sm">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">Se déconnecter</p>
                  <p className="text-xs text-red-400/80">Retour à la page de connexion</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar - Design moderne et épuré */}
      <nav
        className={`fixed bottom-0 left-0 right-0 ${base.bg.card} border-t ${base.border.light} z-50 safe-area-inset-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.08)]`}
        role="navigation"
        aria-label="Navigation principale"
      >
        {/* Container avec padding responsive */}
        <div className="max-w-screen-lg mx-auto px-safe">
          <div className="flex items-stretch justify-around h-24 sm:h-20">
            {/* Navigation items */}
            {navigationItems.map(item => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              const showBadge = item.badge > 0

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`
                    relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0
                    transition-all duration-300 ease-out
                    ${isActive ? 'scale-105' : 'active:scale-95 hover:scale-102'}
                    before:absolute before:inset-0 before:content-[''] before:rounded-2xl
                    ${!isActive && 'hover:before:bg-gray-100/50'}
                  `}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div
                      className={`absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-b-full ${colors.primary.bg} animate-in slide-in-from-top-1 duration-300`}
                    />
                  )}

                  {/* Icon avec badge */}
                  <div className="relative">
                    <div
                      className={`
                        p-2 rounded-2xl transition-all duration-300 ease-out
                        ${
                          isActive
                            ? `bg-transparent ${colors.primary.text} shadow-md`
                            : `${base.bg.transparent} ${base.text.muted} hover:${base.bg.muted}/50`
                        }
                        ${isActive ? 'scale-105' : 'hover:scale-105 active:scale-95'}
                      `}
                    >
                      <Icon
                        className={`w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300 ${
                          isActive ? 'scale-110' : ''
                        }`}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                    </div>

                    {/* Badge moderne */}
                    {showBadge && (
                      <Badge
                        className={`
                          absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                          flex items-center justify-center text-[10px] font-bold
                          border-2 border-white shadow-md
                          ${isActive ? 'bg-white text-gray-900' : 'bg-red-500 text-white'}
                          ${isActive && item.badge > 0 ? 'animate-pulse' : ''}
                          transition-all duration-300
                        `}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </Badge>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`
                      text-[11px] sm:text-xs leading-tight text-center max-w-full truncate px-1
                      transition-all duration-300
                      ${
                        isActive
                          ? `${colors.primary.text} font-bold`
                          : `${base.text.muted} font-medium`
                      }
                    `}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}

            {/* Menu button - Design cohérent */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`
                relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0
                transition-all duration-300 ease-out
                ${showMenu ? 'scale-105' : 'active:scale-95 hover:scale-102'}
                before:absolute before:inset-0 before:content-[''] before:rounded-2xl
                ${!showMenu && 'hover:before:bg-gray-100/50'}
              `}
              aria-label="Menu"
              aria-expanded={showMenu}
            >
              {/* Active indicator pour le menu */}
              {showMenu && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-b-full bg-gray-700 animate-in slide-in-from-top-1 duration-300" />
              )}

              <div
                className={`
                  p-2 rounded-2xl transition-all duration-300
                  ${
                    showMenu
                      ? 'bg-gray-700 text-white shadow-md'
                      : `${base.bg.transparent} ${base.text.muted}`
                  }
                `}
              >
                <div className="flex gap-1">
                  <div
                    className={`w-1 h-1 rounded-full bg-current transition-all duration-300 ${showMenu ? 'scale-125' : ''}`}
                  />
                  <div
                    className={`w-1 h-1 rounded-full bg-current transition-all duration-300 ${showMenu ? 'scale-125' : ''}`}
                  />
                  <div
                    className={`w-1 h-1 rounded-full bg-current transition-all duration-300 ${showMenu ? 'scale-125' : ''}`}
                  />
                </div>
              </div>

              <span
                className={`
                  text-[11px] sm:text-xs leading-tight text-center font-medium
                  transition-all duration-300
                  ${showMenu ? 'text-gray-900 font-bold' : base.text.muted}
                `}
              >
                Plus
              </span>
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
