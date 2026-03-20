import { applyPreset } from './presets.js'

/**
 * Configuration des couleurs de l'application
 *
 * Modifiez les valeurs oklch() ici pour changer les couleurs de toute l'application
 * Format oklch: oklch(lightness chroma hue [/ alpha])
 * - lightness: 0 (noir) à 1 (blanc)
 * - chroma: 0 (gris) à ~0.4 (très saturé)
 * - hue: 0 à 360 (angle de couleur)
 *
 * Exemples de couleurs:
 * - Rouge: oklch(0.6 0.25 27)
 * - Orange: oklch(0.7 0.19 70)
 * - Jaune: oklch(0.85 0.19 100)
 * - Vert: oklch(0.6 0.17 145)
 * - Bleu: oklch(0.5 0.20 250)
 * - Violet: oklch(0.5 0.25 300)
 */

export const themeColors = {
  // Mode clair
  light: {
    // Couleurs de base
    background: 'oklch(1 0 0)', // Blanc pur
    foreground: 'oklch(0.145 0 0)', // Noir foncé

    // Cartes et conteneurs
    card: 'oklch(1 0 0)', // Blanc
    cardForeground: 'oklch(0.145 0 0)', // Noir

    // Popovers
    popover: 'oklch(1 0 0)',
    popoverForeground: 'oklch(0.145 0 0)',

    // Couleur primaire (principale de l'app)
    primary: 'oklch(0.205 0 0)', // Noir très foncé - CHANGEZ ICI pour changer la couleur principale
    primaryForeground: 'oklch(0.985 0 0)', // Blanc cassé

    // Couleur secondaire
    secondary: 'oklch(0.97 0 0)', // Gris très clair
    secondaryForeground: 'oklch(0.205 0 0)',

    // Éléments atténués
    muted: 'oklch(0.97 0 0)',
    mutedForeground: 'oklch(0.556 0 0)',

    // Couleur d'accent
    accent: 'oklch(0.97 0 0)',
    accentForeground: 'oklch(0.205 0 0)',

    // Couleur destructive (erreurs, suppressions)
    destructive: 'oklch(0.577 0.245 27.325)', // Rouge
    destructiveForeground: 'oklch(1 0 0)',

    // Bordures et inputs
    border: 'oklch(0.922 0 0)',
    input: 'oklch(0.922 0 0)',
    ring: 'oklch(0.708 0 0)',

    // Couleurs pour les graphiques et data viz
    'chart-1': 'oklch(0.646 0.222 41.116)', // Orange
    'chart-2': 'oklch(0.6 0.118 184.704)', // Vert (utilisé pour success)
    'chart-3': 'oklch(0.398 0.07 227.392)', // Bleu foncé
    'chart-4': 'oklch(0.828 0.189 84.429)', // Jaune-vert
    'chart-5': 'oklch(0.769 0.188 70.08)', // Jaune (utilisé pour warning)

    // Couleurs de la sidebar
    sidebar: 'oklch(0.985 0 0)',
    sidebarForeground: 'oklch(0.145 0 0)',
    sidebarPrimary: 'oklch(0.205 0 0)',
    sidebarPrimaryForeground: 'oklch(0.985 0 0)',
    sidebarAccent: 'oklch(0.97 0 0)',
    sidebarAccentForeground: 'oklch(0.205 0 0)',
    sidebarBorder: 'oklch(0.922 0 0)',
    sidebarRing: 'oklch(0.708 0 0)',
  },

  // Mode sombre
  dark: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',

    card: 'oklch(0.205 0 0)',
    cardForeground: 'oklch(0.985 0 0)',

    popover: 'oklch(0.205 0 0)',
    popoverForeground: 'oklch(0.985 0 0)',

    primary: 'oklch(0.922 0 0)', // CHANGEZ ICI pour le mode sombre
    primaryForeground: 'oklch(0.205 0 0)',

    secondary: 'oklch(0.269 0 0)',
    secondaryForeground: 'oklch(0.985 0 0)',

    muted: 'oklch(0.269 0 0)',
    mutedForeground: 'oklch(0.708 0 0)',

    accent: 'oklch(0.269 0 0)',
    accentForeground: 'oklch(0.985 0 0)',

    destructive: 'oklch(0.704 0.191 22.216)',
    destructiveForeground: 'oklch(1 0 0)',

    border: 'oklch(1 0 0 / 10%)',
    input: 'oklch(1 0 0 / 15%)',
    ring: 'oklch(0.556 0 0)',

    'chart-1': 'oklch(0.488 0.243 264.376)', // Violet
    'chart-2': 'oklch(0.696 0.17 162.48)', // Vert (success)
    'chart-3': 'oklch(0.769 0.188 70.08)', // Jaune-orange
    'chart-4': 'oklch(0.627 0.265 303.9)', // Rose
    'chart-5': 'oklch(0.645 0.246 16.439)', // Rouge-orange (warning)

    sidebar: 'oklch(0.205 0 0)',
    sidebarForeground: 'oklch(0.985 0 0)',
    sidebarPrimary: 'oklch(0.488 0.243 264.376)',
    sidebarPrimaryForeground: 'oklch(0.985 0 0)',
    sidebarAccent: 'oklch(0.269 0 0)',
    sidebarAccentForeground: 'oklch(0.985 0 0)',
    sidebarBorder: 'oklch(1 0 0 / 10%)',
    sidebarRing: 'oklch(0.556 0 0)',
  },

  // Rayon des bordures
  radius: '0.625rem', // Changez ici pour modifier tous les arrondis de l'app
}

/**
 * Applique les couleurs du thème au document
 * Cette fonction met à jour les variables CSS avec les couleurs définies ci-dessus
 */
export const applyTheme = (mode = 'light') => {
  const root = document.documentElement
  const colors = mode === 'dark' ? themeColors.dark : themeColors.light

  // Applique le rayon
  root.style.setProperty('--radius', themeColors.radius)

  // Applique toutes les couleurs
  Object.entries(colors).forEach(([key, value]) => {
    // Convertit camelCase en kebab-case (ex: primaryForeground -> primary-foreground)
    const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(`--${cssVarName}`, value)
  })

  // Applique aussi les variables de couleur Tailwind (--color-*)
  Object.entries(colors).forEach(([key, value]) => {
    const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(`--color-${cssVarName}`, value)
  })
}

/**
 * Initialise le thème au chargement de l'application
 */
export const initTheme = () => {
  // Détecte si l'utilisateur préfère le mode sombre
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const savedTheme = localStorage.getItem('theme')
  const theme = savedTheme || (prefersDark ? 'dark' : 'light')

  // Applique le radius immédiatement
  document.documentElement.style.setProperty('--radius', themeColors.radius)

  // Vérifie s'il y a un preset sauvegardé
  applyPreset('crm', theme)

  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  return theme
}

/**
 * Bascule entre le mode clair et sombre
 */
export const toggleTheme = () => {
  const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark'

  // Applique le radius immédiatement pour éviter tout délai
  document.documentElement.style.setProperty('--radius', themeColors.radius)

  applyPreset('crm', newTheme)

  if (newTheme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  localStorage.setItem('theme', newTheme)

  return newTheme
}
