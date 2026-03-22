/**
 * @fileoverview Core Logic for API Hooks
 * Provides reusable hooks with loading states, error handling, and caching
 */

import { useState, useCallback, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CACHE_INVALIDATION_MAP, offlineQueue } from '../../../services/core'

// =============================================================================
// Base Hook Types
// =============================================================================

export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface UseApiListState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

export interface UseApiActions {
  refetch: () => Promise<void>
}

export interface UseApiMutation<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput>
  loading: boolean
  error: string | null
}

// =============================================================================
// Generic Hooks
// =============================================================================

export function useApiCall<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = [],
  namespace?: string,
  options?: { enabled?: boolean }
): UseApiState<T> & UseApiActions {
  const queryKey = ['api', namespace || 'global', ...dependencies]

  const query = useQuery({
    queryKey,
    queryFn: apiCall,
    retry: 1,
    enabled: options?.enabled ?? true,
  })

  const refetch = useCallback(async () => {
    await query.refetch()
  }, [query])

  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? 'Unknown error occurred'
        : null

  return {
    data: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: errorMessage,
    refetch,
  }
}

type MutateOptions<TOutput, TOptimistic> = {
  onSuccess?: (result: TOutput) => void
  onError?: (message: string, raw: unknown) => void
  optimisticUpdate?: (draft?: TOptimistic) => () => void // renvoie un rollback
}

export function useApiMutation<TInput, TOutput, TOptimistic = unknown>(
  mutationFn: (input: TInput, signal?: AbortSignal) => Promise<TOutput>,
  entityType?: string,
  offlineType?: string // Type for offline queue
) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const callIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const mutationFnRef = useRef(mutationFn)
  mutationFnRef.current = mutationFn

  const mutation = useMutation({
    mutationFn: async ({ input, signal }: { input: TInput; signal?: AbortSignal }) =>
      mutationFnRef.current(input, signal),
  })

  const mutate = useCallback(
    async (input: TInput, opts?: MutateOptions<TOutput, TOptimistic>): Promise<TOutput> => {
      const myId = ++callIdRef.current
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setError(null)

      if (offlineType && !navigator.onLine) {
        offlineQueue.enqueue(offlineType, input)

        const optimisticResult = input as unknown as TOutput
        opts?.onSuccess?.(optimisticResult)
        return optimisticResult
      }

      let rollback: (() => void) | undefined
      try {
        if (opts?.optimisticUpdate) {
          rollback = opts.optimisticUpdate()
        }

        const result = await mutation.mutateAsync({
          input,
          signal: controller.signal,
        })

        if (entityType) {
          const namespaces = CACHE_INVALIDATION_MAP[entityType] || [entityType]
          await Promise.all(
            namespaces.map(namespace =>
              queryClient.invalidateQueries({
                predicate: query =>
                  Array.isArray(query.queryKey) &&
                  query.queryKey[0] === 'api' &&
                  query.queryKey[1] === namespace,
              })
            )
          )
        }

        if (callIdRef.current === myId) {
          opts?.onSuccess?.(result)
        }

        return result
      } catch (err) {
        let message = 'Unknown error occurred'
        if (err instanceof Error) {
          message = err.message
        } else if (typeof err === 'object' && err !== null) {
          if ('message' in err && typeof err.message === 'string') {
            message = err.message
          }
        }

        try {
          rollback?.()
        } catch {}

        if (callIdRef.current === myId) {
          setError(message)
          opts?.onError?.(message, err)
        }
        throw err
      }
    },
    [entityType, mutation, offlineType, queryClient]
  )

  return { mutate, loading: mutation.isPending, error }
}
