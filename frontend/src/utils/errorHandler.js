import { captureException } from '../config/sentry.js'

/**
 * Gestionnaire d'erreurs global pour l'application
 * Capture toutes les erreurs non gérées et les log
 */

class ErrorHandler {
  constructor() {
    this.errors = []
    this.maxErrors = 50 // Garder les 50 dernières erreurs
    this.listeners = []
    // Sauvegarder les références des handlers bound pour le cleanup
    this.boundHandleError = null
    this.boundHandlePromiseRejection = null
    this.boundHandleResourceError = null
  }

  /**
   * Initialiser les listeners d'erreurs globaux
   */
  init() {
    // Éviter la double initialisation
    if (this.boundHandleError) {
      return
    }

    // Créer et sauvegarder les références bound
    this.boundHandleError = this.handleError.bind(this)
    this.boundHandlePromiseRejection = this.handlePromiseRejection.bind(this)
    this.boundHandleResourceError = event => {
      if (event.target !== window) {
        this.handleResourceError(event)
      }
    }

    // Capturer les erreurs JavaScript non gérées
    window.addEventListener('error', this.boundHandleError)

    // Capturer les promesses rejetées non gérées
    window.addEventListener('unhandledrejection', this.boundHandlePromiseRejection)

    // Capturer les erreurs de chargement de ressources
    window.addEventListener('error', this.boundHandleResourceError, true)

    // Only log in development
    if (import.meta.env.DEV) {
      console.log('✅ ErrorHandler initialisé - Toutes les erreurs seront capturées')
    }
  }

  /**
   * Gérer les erreurs JavaScript
   */
  handleError(event) {
    const error = {
      type: 'javascript',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    this.logError(error)
    this.notifyListeners(error)

    // Ne pas empêcher le comportement par défaut pour que l'erreur soit toujours visible en console
    return false
  }

  /**
   * Gérer les promesses rejetées non gérées
   */
  handlePromiseRejection(event) {
    // S'assurer que message est toujours une string utile
    let message = 'Promise rejection'

    if (event.reason) {
      if (typeof event.reason === 'string') {
        message = event.reason
      } else if (event.reason instanceof Error) {
        // Si c'est une Error, utiliser son message
        message = event.reason.message || event.reason.toString()
      } else if (event.reason instanceof Event) {
        // Si c'est un Event DOM, décrire l'événement
        message = `Event: ${event.reason.type || 'unknown'} on ${event.reason.target?.tagName || 'unknown'}`
      } else if (event.reason.message && typeof event.reason.message === 'string') {
        // Si l'objet a une propriété message string
        message = event.reason.message
      } else {
        // Pour les autres objets, essayer de les sérialiser de manière utile
        try {
          const stringified = JSON.stringify(event.reason)
          // Éviter les "[object Object]" inutiles
          if (stringified && stringified !== '{}' && stringified !== '[object Object]') {
            message = stringified
          } else {
            message = `Promise rejection (${typeof event.reason})`
          }
        } catch {
          message = `Promise rejection (non-serializable ${typeof event.reason})`
        }
      }
    }

    const error = {
      type: 'promise',
      message,
      reason: event.reason,
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    this.logError(error)
    this.notifyListeners(error)

    // Empêcher l'erreur d'être affichée dans la console (déjà loggée)
    event.preventDefault()
  }

  /**
   * Gérer les erreurs de chargement de ressources (images, scripts, etc.)
   */
  handleResourceError(event) {
    const error = {
      type: 'resource',
      message: `Failed to load resource: ${event.target.src || event.target.href}`,
      resource: event.target.tagName,
      src: event.target.src || event.target.href,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    }

    this.logError(error)
    this.notifyListeners(error)
  }

  /**
   * Logger une erreur manuellement
   */
  logError(error) {
    // Ajouter à la liste des erreurs
    this.errors.push(error)

    // Garder seulement les N dernières erreurs
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    // Logger en console en développement
    if (import.meta.env.DEV) {
      console.group(`🔴 ${error.type.toUpperCase()} ERROR`)
      console.error('Message:', error.message)
      if (error.stack) console.error('Stack:', error.stack)
      console.error('Details:', error)
      console.groupEnd()
    }

    // Always send to monitoring in production
    this.sendToMonitoring(error)
  }

  /**
   * Envoyer l'erreur à un service de monitoring externe
   */
  sendToMonitoring(error) {
    // Convertir message et stack en string pour éviter les erreurs .includes()
    const messageStr = typeof error.message === 'string' ? error.message : String(error.message || '')
    const stackStr = typeof error.stack === 'string' ? error.stack : ''

    // Éviter les boucles infinies : ne pas envoyer les erreurs Sentry à Sentry
    if (messageStr.includes('Sentry') || stackStr.includes('Sentry')) {
      return
    }

    // Ignorer les erreurs de ressources non critiques (images, fonts, etc.)
    if (error.type === 'resource') {
      // Ne pas polluer Sentry avec des erreurs de ressources externes
      return
    }

    // Ignorer les erreurs LiveKit non critiques (déconnexions normales)
    const liveKitNormalErrors = [
      'websocket closed',
      'peerconnection failed',
      'signal disconnected',
      'datachannel',
      'connection state changed',
      'ICE connection',
      'event: error on websocket',
      'event: close on websocket',
    ]

    if (liveKitNormalErrors.some(pattern =>
      messageStr.toLowerCase().includes(pattern.toLowerCase()) ||
      stackStr.toLowerCase().includes(pattern.toLowerCase())
    )) {
      // Ces erreurs sont normales avec LiveKit (déconnexions réseau, fermeture page, etc.)
      return
    }

    // Ignorer les promise rejections de type Event (souvent liées à LiveKit)
    if (error.type === 'promise' && error.reason instanceof Event) {
      // Ces Event objects sont généralement des déconnexions WebSocket/WebRTC normales
      return
    }

    try {
      // Créer une vraie Error si ce n'est pas déjà le cas
      let errorToSend = error.error

      if (!errorToSend || !(errorToSend instanceof Error)) {
        errorToSend = new Error(error.message || 'Unknown error')
        errorToSend.name = error.type || 'UnknownError'
        // Copier la stack si elle existe
        if (error.stack && typeof error.stack === 'string') {
          errorToSend.stack = error.stack
        }
      }

      // Capturer l'exception dans Sentry (si configuré)
      // Inclure toutes les métadonnées pertinentes selon le type d'erreur
      const extra = {
        type: error.type,
        url: error.url,
        timestamp: error.timestamp,
      }

      // Ajouter les données spécifiques selon le type
      if (error.type === 'javascript') {
        extra.filename = error.filename
        extra.lineno = error.lineno
        extra.colno = error.colno
      } else if (error.type === 'promise') {
        // Convertir reason en string pour éviter les objets circulaires
        extra.reason = typeof error.reason === 'object'
          ? JSON.stringify(error.reason, null, 2)
          : String(error.reason)
      }

      captureException(errorToSend, { extra })

      // Only log success in development
      if (import.meta.env.DEV) {
        console.log('📤 Erreur envoyée à Sentry')
      }
    } catch (sentryError) {
      // Ne surtout PAS logger cette erreur pour éviter la boucle infinie
      // Silent fail en production
      if (import.meta.env.DEV) {
        console.warn('⚠️ Échec envoi Sentry (ignoré):', sentryError.message)
      }
    }
  }

  /**
   * Ajouter un listener qui sera notifié de chaque erreur
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  /**
   * Notifier tous les listeners
   */
  notifyListeners(error) {
    this.listeners.forEach(callback => {
      try {
        callback(error)
      } catch (err) {
        console.error('Error in error listener:', err)
      }
    })
  }

  /**
   * Récupérer toutes les erreurs
   */
  getErrors() {
    return this.errors
  }

  /**
   * Nettoyer toutes les erreurs
   */
  clearErrors() {
    this.errors = []
  }

  /**
   * Nettoyer les listeners
   */
  cleanup() {
    if (this.boundHandleError) {
      window.removeEventListener('error', this.boundHandleError)
      this.boundHandleError = null
    }
    if (this.boundHandlePromiseRejection) {
      window.removeEventListener('unhandledrejection', this.boundHandlePromiseRejection)
      this.boundHandlePromiseRejection = null
    }
    if (this.boundHandleResourceError) {
      window.removeEventListener('error', this.boundHandleResourceError, true)
      this.boundHandleResourceError = null
    }
    this.listeners = []
  }
}

// Instance singleton
export const errorHandler = new ErrorHandler()

// Auto-initialiser
if (typeof window !== 'undefined') {
  errorHandler.init()
}
