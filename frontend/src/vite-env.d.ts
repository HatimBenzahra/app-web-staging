/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_MAPBOX_ACCESS_TOKEN: string
  readonly VITE_KIOSK_API_URL: string
  readonly VITE_KIOSK_API_USER: string
  readonly VITE_KIOSK_API_PASS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
