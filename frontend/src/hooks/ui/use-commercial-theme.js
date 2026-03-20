/**
 * Hook personnalisé pour la gestion des couleurs de l'espace commercial
 * CENTRALISE TOUS LES STYLES - modifier ici pour changer tout le thème
 * Sépare le système de couleurs de l'interface admin/manager/directeur
 * L'espace commercial est toujours en light mode (forcé via le wrapper)
 */

export function useCommercialTheme() {
  // ========================================
  // DESIGN TOKENS - Couleurs de base
  // ========================================

  // Couleurs de statut
  const colors = {
    primary: {
      bg: 'bg-blue-600',
      bgHover: 'hover:bg-blue-700',
      bgLight: 'bg-blue-50',
      text: 'text-blue-700',
      textLight: 'text-blue-600',
      textOnBg: 'text-white',
      border: 'border-blue-500',
    },
    success: {
      bg: 'bg-green-600',
      bgHover: 'hover:bg-green-700',
      bgLight: 'bg-green-50',
      text: 'text-green-700',
      textLight: 'text-green-600',
      textOnBg: 'text-white',
      border: 'border-green-500',
    },
    warning: {
      bg: 'bg-orange-600',
      bgHover: 'hover:bg-orange-700',
      bgLight: 'bg-orange-50',
      text: 'text-orange-700',
      textLight: 'text-orange-600',
      textOnBg: 'text-white',
      border: 'border-orange-300',
    },
    danger: {
      bg: 'bg-red-600',
      bgHover: 'hover:bg-red-700',
      bgLight: 'bg-red-50',
      text: 'text-red-700',
      textLight: 'text-red-600',
      textOnBg: 'text-white',
      border: 'border-red-500',
    },
    neutral: {
      bg: 'bg-gray-600',
      bgHover: 'hover:bg-gray-700',
      bgLight: 'bg-gray-50',
      text: 'text-gray-700',
      textLight: 'text-gray-600',
      textOnBg: 'text-white',
      border: 'border-gray-500',
    },
    info: {
      bg: 'bg-yellow-600',
      bgHover: 'hover:bg-yellow-700',
      bgLight: 'bg-yellow-50',
      text: 'text-yellow-800',
      textLight: 'text-yellow-700',
      textOnBg: 'text-white',
      border: 'border-yellow-500',
    },
    black: {
      text: 'text-black',
    },
    primaryLight: {
      bg: 'bg-blue-500',
      text: 'text-blue-600',
    },
  }

  // ========================================
  // Couleurs de base de l'interface
  // ========================================
  const base = {
    // Backgrounds
    bg: {
      page: 'bg-gray-50',
      card: 'bg-white',
      hover: 'hover:bg-gray-100',
      muted: 'bg-gray-50',
      input: 'bg-white',
    },
    // Textes
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-700',
      muted: 'text-gray-600',
      placeholder: 'placeholder:text-gray-500',
      white: 'text-white',
    },
    // Bordures
    border: {
      default: 'border-gray-200',
      light: 'border-gray-300',
      input: 'border-gray-300',
      card: 'border-gray-200',
    },
    // Icons
    icon: {
      default: 'text-gray-600',
      muted: 'text-gray-500',
    },
  }

  // ========================================
  // Composants pré-stylés
  // ========================================
  const components = {
    // Cards
    card: {
      base: `${base.bg.card} ${base.border.card}`,
      hover: 'hover:shadow-md transition-shadow duration-200',
      content: 'p-4',
    },
    // Inputs
    input: {
      base: `${base.bg.input} ${base.border.input} ${base.text.primary} ${base.text.placeholder}`,
      search: 'pl-10',
    },
    // Buttons
    button: {
      primary: `${colors.primary.bg} ${colors.primary.bgHover} ${colors.primary.textOnBg}`,
      outline: `bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900`,
    },
    // Stats cards
    statCard: {
      value: `text-2xl font-bold ${base.text.primary}`,
      label: `text-xs ${base.text.muted}`,
      icon: `p-2.5 rounded-lg border ${base.border.default} ${base.bg.muted}`,
    },
    // Loading
    loading: {
      spinner: 'animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full',
      text: base.text.muted,
      container: `flex-1 flex items-center justify-center pb-20 ${base.bg.page}`,
    },
    // Badge
    badge: {
      default: 'bg-blue-600 text-white border-blue-700',
      outline: 'border-gray-300 text-gray-700',
    },
  }

  // Variantes de composants pour l'espace commercial
  const cardVariants = {
    stats: {
      contracts: `${colors.success.bgLight} ${colors.success.textLight}`,
      visits: `${colors.primary.bgLight} ${colors.primary.textLight}`,
      appointments: `${colors.warning.bgLight} ${colors.warning.textLight}`,
      refusals: `${colors.danger.bgLight} ${colors.danger.textLight}`,
    },
  }

  // Navigation bottom bar - couleurs spécifiques tablette (light mode uniquement)
  const navigationTheme = {
    active: {
      bg: 'bg-blue-600',
      text: 'text-white',
      icon: 'text-white',
    },
    inactive: {
      bg: 'hover:bg-gray-100',
      text: 'text-gray-700 hover:text-gray-900',
      icon: 'text-gray-700 hover:text-gray-900',
    },
    badge: {
      active: 'bg-white text-blue-600 border-2 border-blue-200',
      inactive: 'bg-blue-600 text-white border-2 border-blue-700',
    },
    container: 'bg-white border-gray-200',
  }

  // Fonction pour obtenir les classes de navigation
  const getNavClasses = isActive => {
    return isActive ? navigationTheme.active : navigationTheme.inactive
  }

  const getBadgeClasses = isActive => {
    return isActive ? navigationTheme.badge.active : navigationTheme.badge.inactive
  }

  // ========================================
  // Helpers
  // ========================================

  // Pour obtenir toutes les classes d'une card
  const getCardClasses = (variant = 'default') => {
    const variants = {
      default: `${components.card.base} ${components.card.hover}`,
      stats: `${components.card.base}`,
    }
    return variants[variant] || variants.default
  }

  // Pour obtenir les classes d'un bouton
  const getButtonClasses = (variant = 'primary') => {
    return components.button[variant] || components.button.primary
  }

  // Pour obtenir les classes d'un input
  const getInputClasses = (hasIcon = false) => {
    return hasIcon ? `${components.input.base} ${components.input.search}` : components.input.base
  }

  return {
    // Couleurs brutes
    colors,
    base,
    components,

    // Navigation (existant)
    cardVariants,
    navigationTheme,
    getNavClasses,
    getBadgeClasses,

    // Nouveaux helpers
    getCardClasses,
    getButtonClasses,
    getInputClasses,
  }
}
