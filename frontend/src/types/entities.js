/**
 * @fileoverview Central type definitions for all entities
 * Synchronized with backend GraphQL schema
 */

/**
 * @typedef {Object} BaseEntity
 * @property {number} id
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {BaseEntity & Object} Directeur
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {string} numTelephone
 * @property {string} adresse
 */

/**
 * @typedef {BaseEntity & Object} Manager
 * @property {string} nom
 * @property {string} prenom
 * @property {number|null} directeurId
 */

/**
 * @typedef {BaseEntity & Object} Commercial
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {string} numTel
 * @property {number} age
 * @property {number|null} managerId
 * @property {number|null} directeurId
 * @property {Immeuble[]} immeubles
 * @property {Zone[]} zones
 * @property {Statistic[]} statistics
 */

/**
 * @typedef {BaseEntity & Object} Zone
 * @property {string} nom
 * @property {number} rayon
 * @property {number} xOrigin
 * @property {number} yOrigin
 * @property {number|null} directeurId
 * @property {number|null} managerId
 */

/**
 * @typedef {BaseEntity & Object} Immeuble
 * @property {string} adresse
 * @property {number} nbEtages
 * @property {number} nbPortesParEtage
 * @property {boolean} ascenseurPresent
 * @property {string|null} digitalCode
 * @property {number} commercialId
 * @property {Porte[]} portes
 */

/**
 * @typedef {BaseEntity & Object} Porte
 * @property {string} numero
 * @property {number} etage
 * @property {number} immeubleId
 * @property {StatutPorte} statut
 * @property {number} nbRepassages
 * @property {string|null} rdvDate
 * @property {string|null} rdvTime
 * @property {string|null} commentaire
 * @property {string|null} derniereVisite
 */

/**
 * Type des statuts de porte
 * IMPORTANT: Doit être synchronisé avec :
 * - @/constants/domain/porte-status (configuration UI - source de vérité frontend)
 * - backend/src/porte/porte-status.constants.ts (backend)
 * - backend/prisma/schema.prisma (database)
 *
 * @typedef {'NON_VISITE'|'CONTRAT_SIGNE'|'REFUS'|'RENDEZ_VOUS_PRIS'|'ABSENT'|'ARGUMENTE'|'NECESSITE_REPASSAGE'} StatutPorte
 */

/**
 * @typedef {BaseEntity & Object} Statistic
 * @property {number|null} commercialId
 * @property {number|null} immeubleId
 * @property {number|null} zoneId
 * @property {number} contratsSignes
 * @property {number} immeublesVisites
 * @property {number} rendezVousPris
 * @property {number} refus
 * @property {number} nbImmeublesProspectes
 * @property {number} nbPortesProspectes
 */

// Create Input Types
/**
 * @typedef {Object} CreateDirecteurInput
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {string} numTelephone
 * @property {string} adresse
 */

/**
 * @typedef {Object} CreateManagerInput
 * @property {string} nom
 * @property {string} prenom
 * @property {number} [directeurId]
 */

/**
 * @typedef {Object} CreateCommercialInput
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {string} numTel
 * @property {number} age
 * @property {number} [managerId]
 * @property {number} [directeurId]
 */

/**
 * @typedef {Object} CreateZoneInput
 * @property {string} nom
 * @property {number} rayon
 * @property {number} xOrigin
 * @property {number} yOrigin
 * @property {number} [directeurId]
 * @property {number} [managerId]
 */

/**
 * @typedef {Object} CreateImmeubleInput
 * @property {string} adresse
 * @property {number} nbEtages
 * @property {number} nbPortesParEtage
 * @property {boolean} ascenseurPresent
 * @property {string|null} digitalCode
 * @property {number} commercialId
 */

/**
 * @typedef {Object} CreatePorteInput
 * @property {string} numero
 * @property {number} etage
 * @property {number} immeubleId
 * @property {StatutPorte} [statut]
 * @property {number} [nbRepassages]
 * @property {string} [rdvDate]
 * @property {string} [rdvTime]
 * @property {string} [commentaire]
 * @property {string} [derniereVisite]
 */

/**
 * @typedef {Object} UpdatePorteInput
 * @property {number} id
 * @property {string} [numero]
 * @property {number} [etage]
 * @property {StatutPorte} [statut]
 * @property {number} [nbRepassages]
 * @property {string} [rdvDate]
 * @property {string} [rdvTime]
 * @property {string} [commentaire]
 * @property {string} [derniereVisite]
 */

/**
 * @typedef {Object} CreateStatisticInput
 * @property {number} [commercialId]
 * @property {number} [immeubleId]
 * @property {number} [zoneId]
 * @property {number} contratsSignes
 * @property {number} immeublesVisites
 * @property {number} rendezVousPris
 * @property {number} refus
 * @property {number} nbImmeublesProspectes
 * @property {number} nbPortesProspectes
 */

// Update Input Types
/**
 * @typedef {Object} UpdateDirecteurInput
 * @property {number} id
 * @property {string} [nom]
 * @property {string} [prenom]
 * @property {string} [email]
 * @property {string} [numTelephone]
 * @property {string} [adresse]
 */

/**
 * @typedef {Object} UpdateManagerInput
 * @property {number} id
 * @property {string} [nom]
 * @property {string} [prenom]
 * @property {number} [directeurId]
 */

/**
 * @typedef {Object} UpdateCommercialInput
 * @property {number} id
 * @property {string} [nom]
 * @property {string} [prenom]
 * @property {string} [email]
 * @property {string} [numTel]
 * @property {number} [age]
 * @property {number} [managerId]
 * @property {number} [directeurId]
 */

/**
 * @typedef {Object} UpdateZoneInput
 * @property {number} id
 * @property {string} [nom]
 * @property {number} [rayon]
 * @property {number} [xOrigin]
 * @property {number} [yOrigin]
 * @property {number} [directeurId]
 * @property {number} [managerId]
 */

/**
 * @typedef {Object} UpdateImmeubleInput
 * @property {number} id
 * @property {string} [adresse]
 * @property {number} [nbEtages]
 * @property {number} [nbPortesParEtage]
 * @property {boolean} [ascenseurPresent]
 * @property {string|null} [digitalCode]
 */

/**
 * @typedef {Object} UpdateStatisticInput
 * @property {number} id
 * @property {number} [commercialId]
 * @property {number} [immeubleId]
 * @property {number} [zoneId]
 * @property {number} [contratsSignes]
 * @property {number} [immeublesVisites]
 * @property {number} [rendezVousPris]
 * @property {number} [refus]
 * @property {number} [nbImmeublesProspectes]
 * @property {number} [nbPortesProspectes]
 */

export {}
