/**
 * @fileoverview Hook générique pour le lazy loading de données basé sur la pagination
 * Optimise les appels API en chargeant seulement les données visibles
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { mapboxCache } from '@/services/core'

/**
 * Configuration pour un loader de données spécifique
 * @typedef {Object} LazyLoaderConfig
 * @property {string} namespace - Namespace pour le cache (ex: 'mapbox-geocode')
 * @property {Function} fetcher - Fonction async qui charge les données
 * @property {Function} getCacheKey - Fonction qui génère la clé de cache
 * @property {Function} shouldLoad - Fonction qui détermine si on doit charger
 * @property {number} [delay] - Délai entre les appels (défaut: 200ms)
 * @property {number} [maxConcurrent] - Nombre max d'appels simultanés (défaut: 3)
 */

/**
 * Hook pour le lazy loading de données avec gestion de pagination
 * @param {LazyLoaderConfig[]} loaderConfigs - Configurations des loaders
 * @returns {Object}
 */
export function useLazyDataLoader(loaderConfigs = []) {
  const [loadedData, setLoadedData] = useState({})
  const [loadingStates, setLoadingStates] = useState({})
  const loadingQueueRef = useRef(new Map())
  const activeRequestsRef = useRef(new Set())

  // Fonction générique pour charger une donnée spécifique
  const loadData = useCallback(
    async (config, item, identifier) => {
      const { namespace, fetcher, getCacheKey } = config

      // Vérifier si on doit charger
      if (config.shouldLoad && !config.shouldLoad(item, loadedData[identifier])) {
        return
      }

      // Éviter les doublons
      const requestKey = `${namespace}:${identifier}`
      if (activeRequestsRef.current.has(requestKey)) {
        return
      }

      try {
        // Marquer comme en cours de chargement
        setLoadingStates(prev => ({ ...prev, [identifier]: true }))
        activeRequestsRef.current.add(requestKey)

        const isMapboxNamespace = namespace === 'mapbox-geocode'

        const result = isMapboxNamespace
          ? await mapboxCache.fetchWithCache(
              mapboxCache.getKey(
                fetcher,
                getCacheKey ? getCacheKey(item) : [identifier],
                namespace
              ),
              () => fetcher(item)
            )
          : await fetcher(item)

        // Sauvegarder le résultat
        setLoadedData(prev => ({
          ...prev,
          [identifier]: result,
        }))
      } catch (error) {
        console.error(`Erreur lors du chargement ${namespace}:`, error)
      } finally {
        // Nettoyer les états
        setLoadingStates(prev => ({ ...prev, [identifier]: false }))
        activeRequestsRef.current.delete(requestKey)
      }
    },
    [loadedData]
  )

  // Fonction pour charger les données des items visibles avec contrôle de débit
  const loadVisibleData = useCallback(
    async visibleItems => {
      if (!visibleItems || visibleItems.length === 0) return

      for (const config of loaderConfigs) {
        const itemsToLoad = visibleItems.filter(item => {
          const identifier = config.getCacheKey ? config.getCacheKey(item).join(':') : item.id
          return config.shouldLoad ? config.shouldLoad(item, loadedData[identifier]) : true
        })

        // Charger avec délais progressifs pour éviter le spam
        itemsToLoad.forEach((item, index) => {
          const identifier = config.getCacheKey ? config.getCacheKey(item).join(':') : item.id

          setTimeout(
            () => {
              loadData(config, item, identifier)
            },
            index * (config.delay || 200)
          )
        })
      }
    },
    [loaderConfigs, loadData, loadedData]
  )

  // Fonction pour obtenir les données chargées d'un item
  const getLoadedData = useCallback(
    (item, loaderNamespace) => {
      const config = loaderConfigs.find(c => c.namespace === loaderNamespace)
      if (!config) return null

      const identifier = config.getCacheKey ? config.getCacheKey(item).join(':') : item.id
      return loadedData[identifier] || null
    },
    [loaderConfigs, loadedData]
  )

  // Fonction pour vérifier si une donnée est en cours de chargement
  const isLoading = useCallback(
    (item, loaderNamespace) => {
      const config = loaderConfigs.find(c => c.namespace === loaderNamespace)
      if (!config) return false

      const identifier = config.getCacheKey ? config.getCacheKey(item).join(':') : item.id
      return loadingStates[identifier] || false
    },
    [loaderConfigs, loadingStates]
  )

  // Nettoyer les états quand le composant se démonte
  useEffect(() => {
    const activeRequests = activeRequestsRef.current
    const loadingQueue = loadingQueueRef.current
    return () => {
      activeRequests.clear()
      loadingQueue.clear()
    }
  }, [])

  return {
    loadVisibleData,
    getLoadedData,
    isLoading,
    loadedData,
    loadingStates,
  }
}

export default useLazyDataLoader
