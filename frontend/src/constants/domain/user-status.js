export const UserStatus = {
  ACTIF: 'ACTIF',
  CONTRAT_FINIE: 'CONTRAT_FINIE',
  UTILISATEUR_TEST: 'UTILISATEUR_TEST',
}

export const USER_STATUS_CONFIG = [
  {
    value: UserStatus.ACTIF,
    label: 'Actif',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    value: UserStatus.CONTRAT_FINIE,
    label: 'Contrat fini',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    value: UserStatus.UTILISATEUR_TEST,
    label: 'Utilisateur test',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
]

const UNKNOWN_STATUS = {
  label: 'Inconnu',
  badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
}

export function getStatusMeta(status) {
  if (!status) return UNKNOWN_STATUS
  return USER_STATUS_CONFIG.find(option => option.value === status) || {
    label: status,
    badgeClass: UNKNOWN_STATUS.badgeClass,
  }
}

export function getStatusFilterOptions() {
  return USER_STATUS_CONFIG.map(option => ({
    value: option.value,
    label: option.label,
  }))
}
