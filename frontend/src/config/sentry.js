/**
 * Configuration Sentry pour le monitoring des erreurs
 * Documentation: https://docs.sentry.io/platforms/javascript/guides/react/
 */

import * as Sentry from '@sentry/react'

/**
 * Initialise Sentry pour le monitoring des erreurs
 */
export const initSentry = () => {
  const sentryDSN = import.meta.env.VITE_SENTRY_DSN

  // Si pas de DSN configuré, ne pas initialiser Sentry
  if (!sentryDSN) {
    console.info('ℹ️ Sentry non configuré (VITE_SENTRY_DSN manquant)')
    return
  }

  try {
    Sentry.init({
      dsn: sentryDSN,

      // Envoyer les données PII par défaut (IP, user-agent, etc.)
      sendDefaultPii: true,

      // Environnement (development ou production)
      environment: import.meta.env.MODE,

      // Intégrations pour le tracking des performances et replay
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],

      // Taux d'échantillonnage des traces de performance
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

      // Taux d'échantillonnage des replays de session
      replaysSessionSampleRate: 0.1, // 10% des sessions normales
      replaysOnErrorSampleRate: 1.0, // 100% des sessions avec erreurs

      // Ignorer certaines erreurs communes
      ignoreErrors: [
        'Network request failed',
        'NetworkError',
        'Failed to fetch',
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
      ],

      // Filtrer les données sensibles avant envoi
      beforeSend(event) {
        // Supprimer les données sensibles
        if (event.request) {
          delete event.request.cookies
          delete event.request.headers
        }
        return event
      },
    })

    console.info('✅ Sentry initialisé avec succès')
  } catch (error) {
    console.warn("⚠️ Erreur lors de l'initialisation de Sentry:", error)
  }
}

/**
 * Capture une exception dans Sentry
 */
export const captureException = (error, context = {}) => {
  try {
    Sentry.captureException(error, {
      extra: context,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Capture un message dans Sentry
 */
export const captureMessage = (message, level = 'info', context = {}) => {
  try {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Définir l'utilisateur courant pour Sentry
 */
export const setUser = user => {
  try {
    if (user === null) {
      Sentry.setUser(null)
    } else {
      Sentry.setUser({
        id: user?.id?.toString(),
        username: user?.nom || user?.role,
        role: user?.role,
      })
    }
  } catch {
    // Sentry non disponible
  }
}

/**
 * Ajouter un breadcrumb (fil d'Ariane) pour le contexte
 */
export const addBreadcrumb = (category, message, data = {}) => {
  try {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: 'info',
    })
  } catch {
    // Sentry non disponible
  }
}

export { Sentry }
export default Sentry
