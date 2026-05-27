/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_MAPBOX_ACCESS_TOKEN: string
  readonly VITE_KIOSK_API_URL: string
  readonly VITE_KIOSK_API_USER: string
  readonly VITE_KIOSK_API_PASS: string
  // Kiosk secondaire optionnel (ex: staging) — agrégé dans la vue Localisation.
  readonly VITE_KIOSK_API_URL_2?: string
  readonly VITE_KIOSK_API_USER_2?: string
  readonly VITE_KIOSK_API_PASS_2?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
