import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { initTheme } from './config/theme/base'
import { initSentry } from './config/sentry'
import ScrollToTop from './components/ScrollToTop'
import './utils/errorHandler' // Initialiser le gestionnaire d'erreurs global

// Initialise Sentry pour le monitoring des erreurs
initSentry()

// Initialise le thème avant le rendu de l'application
initTheme()

// Créer une instance de QueryClient avec configuration optimisée POUR LA PAGE GESTION
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
