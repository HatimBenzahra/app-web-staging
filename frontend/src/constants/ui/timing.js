/**
 * Constantes de timing pour l'application
 * Centralise tous les timeouts et délais utilisés dans l'app
 */

// =============================================================================
// Audio & Recording
// =============================================================================

export const AUDIO_TIMING = {
  // Délai avant connexion audio automatique (laisser le layout se charger)
  AUTO_CONNECT_DELAY: 2000,

  // Délai avant démarrage enregistrement (attendre stabilisation audio)
  RECORDING_START_DELAY: 2000,

  // Timeout pour connexion LiveKit
  CONNECTION_TIMEOUT: 10000,

  // Intervalle de vérification de qualité audio
  QUALITY_CHECK_INTERVAL: 5000,
}

// =============================================================================
// UI & Navigation
// =============================================================================

export const UI_TIMING = {
  // Délai avant affichage du bouton scroll to top
  SCROLL_TO_TOP_THRESHOLD: 300,

  // Délai pour scroll container setup
  SCROLL_CONTAINER_SETUP_DELAY: 200,

  // Animation duration pour les transitions
  ANIMATION_DURATION: 200,

  // Debounce pour la recherche
  SEARCH_DEBOUNCE: 300,

  // Toast auto-dismiss
  TOAST_DURATION: 4000,
}

// =============================================================================
// API & Cache
// =============================================================================

export const API_TIMING = {
  // Timeout par défaut pour les requêtes
  DEFAULT_TIMEOUT: 10000,

  // Retry delay progression
  RETRY_DELAYS: [1000, 2000, 4000], // 1s, 2s, 4s

  // Cache TTL par namespace (voir api-cache.ts)
  CACHE_TTL: {
    STATISTICS: 30_000,
    ZONES: 10 * 60_000,
    COMMERCIALS: 3 * 60_000,
    IMMEUBLES: 10 * 60_000,
    PORTES: 2 * 60_000,
  },
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convertit les millisecondes en secondes pour l'affichage
 */
export const msToSeconds = ms => Math.round(ms / 1000)

/**
 * Crée un délai avec Promise
 */
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export default {
  AUDIO_TIMING,
  UI_TIMING,
  API_TIMING,
  msToSeconds,
  delay,
}
