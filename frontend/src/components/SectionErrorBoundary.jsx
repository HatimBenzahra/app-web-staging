import React from 'react'
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react'

function isChunkLoadError(error) {
  if (!error) return false
  const msg = error.message || ''
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Unable to preload CSS') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    error.name === 'ChunkLoadError'
  )
}

const REFRESH_KEY = 'chunk_error_refresh'
const REFRESH_COOLDOWN_MS = 10000

class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, isStaleChunk: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, isStaleChunk: isChunkLoadError(error) }
  }

  componentDidCatch(error, errorInfo) {
    console.error('SectionErrorBoundary caught an error:', error, errorInfo)

    if (isChunkLoadError(error)) {
      const lastRefresh = Number(sessionStorage.getItem(REFRESH_KEY) || 0)
      if (Date.now() - lastRefresh > REFRESH_COOLDOWN_MS) {
        sessionStorage.setItem(REFRESH_KEY, String(Date.now()))
        window.location.reload()
        return
      }
    }
  }

  reset = () => {
    this.setState({ hasError: false, isStaleChunk: false })
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isStaleChunk) {
        return (
          <div className="rounded-xl border border-blue-300/30 bg-blue-50/50 dark:bg-blue-950/20 p-6">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Nouvelle version disponible</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  L'application a été mise à jour. Veuillez rafraîchir la page pour continuer.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Rafraîchir la page
                </button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Erreur sur cette section</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cette vue a rencontré une erreur. Vous pouvez recharger uniquement cette section.
              </p>
              <button
                type="button"
                onClick={this.reset}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <RotateCcw className="h-4 w-4" />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default SectionErrorBoundary
