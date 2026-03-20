export type KioskErrorType = 'network' | 'auth' | 'server' | 'config' | 'unknown'

export class KioskApiError extends Error {
  public type: KioskErrorType

  constructor(
    message: string,
    public statusCode: number,
    type?: KioskErrorType,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = 'KioskApiError'
    this.type = type || KioskApiError.inferType(statusCode)
  }

  private static inferType(statusCode: number): KioskErrorType {
    if (statusCode === 0) return 'network'
    if (statusCode === 401 || statusCode === 403) return 'auth'
    if (statusCode >= 500) return 'server'
    return 'unknown'
  }

  get isNetworkError() { return this.type === 'network' }
  get isAuthError() { return this.type === 'auth' }
  get isServerError() { return this.type === 'server' }
  get isConfigError() { return this.type === 'config' }
}

export function classifyKioskError(error: unknown): KioskApiError {
  if (error instanceof KioskApiError) return error

  const msg = error instanceof Error ? error.message.toLowerCase() : ''
  const isNetworkError = error instanceof TypeError && (
    msg.includes('fetch') || msg.includes('network') || msg.includes('failed') || msg.includes('load') || msg.includes('cors') || msg.includes('timeout')
  )

  if (isNetworkError) {
    return new KioskApiError(
      'Le serveur OTA Kiosk est inaccessible. Vérifiez que le serveur est en ligne.',
      0,
      'network'
    )
  }

  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NetworkError')) {
    return new KioskApiError('La requête a expiré ou le réseau est indisponible.', 0, 'network')
  }

  if (error instanceof Error) {
    return new KioskApiError(error.message, 0, 'unknown')
  }

  return new KioskApiError('Erreur inconnue.', 0, 'unknown')
}

class KioskApiClient {
  private baseUrl: string
  private authHeader: string

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '')
    this.authHeader = username && password
      ? `Basic ${btoa(`${username}:${password}`)}`
      : ''
  }

  get isConfigured(): boolean {
    return Boolean(this.baseUrl)
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value))
        }
      }
    }
    return url.toString()
  }

  private getHeaders(isJson = true): HeadersInit {
    const headers: Record<string, string> = {}
    if (this.authHeader) {
      headers['Authorization'] = this.authHeader
    }
    if (isJson) {
      headers['Content-Type'] = 'application/json'
    }
    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let body: unknown
      try {
        body = await response.json()
      } catch {
        body = await response.text().catch(() => null)
      }
      const message = typeof body === 'object' && body && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : `HTTP ${response.status}: ${response.statusText}`
      throw new KioskApiError(message, response.status, undefined, body)
    }
    return response.json() as Promise<T>
  }

  private assertConfigured(): void {
    if (!this.baseUrl) {
      throw new KioskApiError(
        'URL du serveur Kiosk non configurée. Ajoutez VITE_KIOSK_API_URL dans le fichier .env.',
        0,
        'config'
      )
    }
  }

  private async request<T>(fn: () => Promise<T>): Promise<T> {
    this.assertConfigured()
    try {
      return await fn()
    } catch (error) {
      throw classifyKioskError(error)
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request(async () => {
      const url = this.buildUrl(endpoint, params)
      const response = await fetch(url, { method: 'GET', headers: this.getHeaders() })
      return this.handleResponse<T>(response)
    })
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request(async () => {
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'POST',
        headers: this.getHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      return this.handleResponse<T>(response)
    })
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request(async () => {
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      })
      return this.handleResponse<T>(response)
    })
  }

  async del<T>(endpoint: string): Promise<T> {
    return this.request(async () => {
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'DELETE',
        headers: this.getHeaders(),
      })
      return this.handleResponse<T>(response)
    })
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request(async () => {
      const headers: Record<string, string> = {}
      if (this.authHeader) {
        headers['Authorization'] = this.authHeader
      }
      const response = await fetch(this.buildUrl(endpoint), {
        method: 'POST',
        headers,
        body: formData,
      })
      return this.handleResponse<T>(response)
    })
  }
}

export const kioskClient = new KioskApiClient(
  import.meta.env.VITE_KIOSK_API_URL || '',
  import.meta.env.VITE_KIOSK_API_USER || '',
  import.meta.env.VITE_KIOSK_API_PASS || ''
)
