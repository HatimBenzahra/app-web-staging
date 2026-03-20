export const isDev = import.meta.env.DEV
export const isProd = import.meta.env.PROD
export const isTest = import.meta.env.MODE === 'test'

// Use this instead of checking import.meta.env.DEV everywhere
export const shouldLog = isDev
