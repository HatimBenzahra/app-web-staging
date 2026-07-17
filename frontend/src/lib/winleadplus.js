const WINLEADPLUS_BASE = 'https://www.winleadplus.com'

/**
 * Résout l'URL d'un logo d'offre WinLeadPlus. Les logos peuvent être renvoyés
 * en chemin relatif (ex. `/uploads/...`) → on préfixe par la base WinLeadPlus.
 * Renvoie null si absent.
 */
export function getOffreLogoUrl(logoUrl) {
  if (!logoUrl) return null
  if (logoUrl.startsWith('http')) return logoUrl
  return `${WINLEADPLUS_BASE}${logoUrl}`
}
