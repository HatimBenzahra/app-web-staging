import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding de la base de données...');

  // Nettoyer les données existantes
  console.log('🧹 Nettoyage des données existantes...');
  await prisma.statistic.deleteMany();
  await prisma.immeuble.deleteMany();
  await prisma.commercial.deleteMany();
  await prisma.manager.deleteMany();
  await prisma.directeur.deleteMany();
  await prisma.zone.deleteMany();

  // Créer des directeurs
  console.log('👔 Création des directeurs...');
  const directeur1 = await prisma.directeur.create({
    data: {
      nom: 'Gharbi',
      prenom: 'Fatma',
      email: 'fatma.gharbi@company.com',
      numTelephone: '+216 20 123 456',
      adresse: '123 Avenue Habib Bourguiba, Tunis',
    },
  });

  const directeur2 = await prisma.directeur.create({
    data: {
      nom: 'Triki',
      prenom: 'Mohamed',
      email: 'mohamed.triki@company.com',
      numTelephone: '+216 25 987 654',
      adresse: '456 Rue de la République, Sfax',
    },
  });

  // Créer des managers
  console.log('👨‍💼 Création des managers...');
  const manager1 = await prisma.manager.create({
    data: {
      nom: 'Ben Salem',
      prenom: 'Ahmed',
      directeurId: directeur1.id,
    },
  });

  const manager2 = await prisma.manager.create({
    data: {
      nom: 'Khelifi',
      prenom: 'Sarra',
      directeurId: directeur2.id,
    },
  });

  // Créer des zones
  console.log('🗺️ Création des zones...');
  // Zone 1: Assignée directement au directeur1
  const zone1 = await prisma.zone.create({
    data: {
      nom: 'Tunis Centre',
      xOrigin: 36.8065,
      yOrigin: 10.1815,
      rayon: 5.0,
      directeurId: directeur1.id,
    },
  });

  // Zone 2: Assignée directement au manager2
  const zone2 = await prisma.zone.create({
    data: {
      nom: 'Sfax',
      xOrigin: 34.7406,
      yOrigin: 10.7603,
      rayon: 8.0,
      managerId: manager2.id,
    },
  });

  // Zone 3: Non assignée directement, seulement via commerciaux
  const zone3 = await prisma.zone.create({
    data: {
      nom: 'Sousse',
      xOrigin: 35.8256,
      yOrigin: 10.6369,
      rayon: 6.0,
    },
  });

  // Zone 4: Assignée au manager1
  const zone4 = await prisma.zone.create({
    data: {
      nom: 'Ariana',
      xOrigin: 36.8625,
      yOrigin: 10.1956,
      rayon: 4.5,
      managerId: manager1.id,
    },
  });

  // Zone 5: Assignée au directeur2
  const zone5 = await prisma.zone.create({
    data: {
      nom: 'Monastir',
      xOrigin: 35.7643,
      yOrigin: 10.8263,
      rayon: 5.5,
      directeurId: directeur2.id,
    },
  });

  // Créer des commerciaux
  console.log('💼 Création des commerciaux...');
  const commercial1 = await prisma.commercial.create({
    data: {
      nom: 'Ben Ali',
      prenom: 'Ahmed',
      email: 'ahmed.benali@company.com',
      numTel: '+216 20 111 222',
      age: 28,
      managerId: manager1.id,
      directeurId: directeur1.id,
    },
  });

  const commercial2 = await prisma.commercial.create({
    data: {
      nom: 'Mejri',
      prenom: 'Sarra',
      email: 'sarra.mejri@company.com',
      numTel: '+216 25 333 444',
      age: 32,
      managerId: manager2.id,
      directeurId: directeur2.id,
    },
  });

  const commercial3 = await prisma.commercial.create({
    data: {
      nom: 'Ouali',
      prenom: 'Karim',
      email: 'karim.ouali@company.com',
      numTel: '+216 22 555 666',
      age: 26,
      managerId: manager1.id,
      directeurId: directeur1.id,
    },
  });

  const commercial4 = await prisma.commercial.create({
    data: {
      nom: 'Hamdi',
      prenom: 'Leila',
      email: 'leila.hamdi@company.com',
      numTel: '+216 23 777 888',
      age: 30,
      managerId: manager2.id,
      directeurId: directeur2.id,
    },
  });

  const commercial5 = await prisma.commercial.create({
    data: {
      nom: 'Jebali',
      prenom: 'Yassine',
      email: 'yassine.jebali@company.com',
      numTel: '+216 21 999 000',
      age: 27,
      managerId: manager1.id,
      directeurId: directeur1.id,
    },
  });

  // Créer des immeubles
  console.log('🏢 Création des immeubles...');
  await prisma.immeuble.createMany({
    data: [
      {
        adresse: '10 Rue de la Liberté, Tunis',
        nbEtages: 5,
        nbPortesParEtage: 4,
        commercialId: commercial1.id,
      },
      {
        adresse: '25 Avenue Habib Bourguiba, Tunis',
        nbEtages: 8,
        nbPortesParEtage: 6,
        commercialId: commercial1.id,
      },
      {
        adresse: '15 Rue Ali Bach Hamba, Sfax',
        nbEtages: 6,
        nbPortesParEtage: 5,
        commercialId: commercial2.id,
      },
      {
        adresse: '30 Avenue Farhat Hached, Sousse',
        nbEtages: 4,
        nbPortesParEtage: 3,
        commercialId: commercial3.id,
      },
      {
        adresse: '42 Rue Mongi Slim, Monastir',
        nbEtages: 7,
        nbPortesParEtage: 4,
        commercialId: commercial4.id,
      },
      {
        adresse: '88 Avenue de la Liberté, Sfax',
        nbEtages: 5,
        nbPortesParEtage: 5,
        commercialId: commercial4.id,
      },
      {
        adresse: '55 Rue Ibn Khaldoun, Ariana',
        nbEtages: 6,
        nbPortesParEtage: 6,
        commercialId: commercial5.id,
      },
    ],
  });

  // Assigner des zones aux commerciaux via ZoneEnCours
  console.log('🔗 Attribution des zones aux commerciaux...');
  // Note: Un commercial ne peut avoir qu'une seule zone active à la fois avec ZoneEnCours
  await prisma.zoneEnCours.createMany({
    data: [
      // Commercial1 travaille sur zone1 (Tunis Centre - directeur1)
      { userId: commercial1.id, zoneId: zone1.id, userType: 'COMMERCIAL' },
      // Commercial2 travaille sur zone2 (Sfax - manager2)
      { userId: commercial2.id, zoneId: zone2.id, userType: 'COMMERCIAL' },
      // Commercial3 travaille sur zone3 (Sousse - non assignée)
      { userId: commercial3.id, zoneId: zone3.id, userType: 'COMMERCIAL' },
      // Commercial4 travaille sur zone2 (Sfax - manager2) - Changé à zone4 car zone2 déjà assignée
      { userId: commercial4.id, zoneId: zone4.id, userType: 'COMMERCIAL' },
      // Commercial5 travaille sur zone5 (Monastir - directeur2)
      { userId: commercial5.id, zoneId: zone5.id, userType: 'COMMERCIAL' },
    ],
  });

  // Récupérer les immeubles créés pour les statistiques
  const immeubles = await prisma.immeuble.findMany();

  // Créer des statistiques
  console.log('📊 Création des statistiques...');
  await prisma.statistic.createMany({
    data: [
      // Statistiques pour Commercial1 - Zone1 (Tunis Centre)
      {
        commercialId: commercial1.id,
        zoneId: zone1.id,
        immeubleId: immeubles[0].id,
        contratsSignes: 28,
        immeublesVisites: 45,
        rendezVousPris: 32,
        refus: 12,
        nbImmeublesProspectes: 38,
        nbPortesProspectes: 152,
      },
      // Statistiques pour Commercial1 - Zone4 (Ariana)
      {
        commercialId: commercial1.id,
        zoneId: zone4.id,
        contratsSignes: 22,
        immeublesVisites: 38,
        rendezVousPris: 28,
        refus: 8,
        nbImmeublesProspectes: 32,
        nbPortesProspectes: 128,
      },
      // Statistiques pour Commercial2 - Zone2 (Sfax)
      {
        commercialId: commercial2.id,
        zoneId: zone2.id,
        immeubleId: immeubles[2].id,
        contratsSignes: 35,
        immeublesVisites: 52,
        rendezVousPris: 41,
        refus: 15,
        nbImmeublesProspectes: 45,
        nbPortesProspectes: 225,
      },
      // Statistiques pour Commercial2 - Zone5 (Monastir)
      {
        commercialId: commercial2.id,
        zoneId: zone5.id,
        contratsSignes: 42,
        immeublesVisites: 58,
        rendezVousPris: 48,
        refus: 18,
        nbImmeublesProspectes: 50,
        nbPortesProspectes: 250,
      },
      // Statistiques pour Commercial3 - Zone3 (Sousse)
      {
        commercialId: commercial3.id,
        zoneId: zone3.id,
        immeubleId: immeubles[3].id,
        contratsSignes: 15,
        immeublesVisites: 28,
        rendezVousPris: 22,
        refus: 9,
        nbImmeublesProspectes: 24,
        nbPortesProspectes: 96,
      },
      // Statistiques pour Commercial3 - Zone4 (Ariana)
      {
        commercialId: commercial3.id,
        zoneId: zone4.id,
        contratsSignes: 18,
        immeublesVisites: 32,
        rendezVousPris: 25,
        refus: 11,
        nbImmeublesProspectes: 28,
        nbPortesProspectes: 112,
      },
      // Statistiques pour Commercial4 - Zone2 (Sfax)
      {
        commercialId: commercial4.id,
        zoneId: zone2.id,
        immeubleId: immeubles[4].id,
        contratsSignes: 31,
        immeublesVisites: 47,
        rendezVousPris: 36,
        refus: 13,
        nbImmeublesProspectes: 41,
        nbPortesProspectes: 164,
      },
      // Statistiques pour Commercial4 - Zone5 (Monastir)
      {
        commercialId: commercial4.id,
        zoneId: zone5.id,
        immeubleId: immeubles[5].id,
        contratsSignes: 25,
        immeublesVisites: 39,
        rendezVousPris: 30,
        refus: 10,
        nbImmeublesProspectes: 35,
        nbPortesProspectes: 140,
      },
      // Statistiques pour Commercial5 - Zone1 (Tunis Centre)
      {
        commercialId: commercial5.id,
        zoneId: zone1.id,
        immeubleId: immeubles[6].id,
        contratsSignes: 33,
        immeublesVisites: 51,
        rendezVousPris: 39,
        refus: 14,
        nbImmeublesProspectes: 44,
        nbPortesProspectes: 176,
      },
      // Statistiques pour Commercial5 - Zone4 (Ariana)
      {
        commercialId: commercial5.id,
        zoneId: zone4.id,
        contratsSignes: 20,
        immeublesVisites: 35,
        rendezVousPris: 27,
        refus: 9,
        nbImmeublesProspectes: 30,
        nbPortesProspectes: 120,
      },
    ],
  });

  console.log('✅ Seeding terminé avec succès !');
  console.log(`📊 Créé :
    - ${2} directeurs
    - ${2} managers
    - ${5} commerciaux
    - ${5} zones (2 assignées à directeurs, 2 à managers, 1 non assignée)
    - ${7} immeubles
    - ${10} relations zone-commercial
    - ${10} statistiques complètes`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
