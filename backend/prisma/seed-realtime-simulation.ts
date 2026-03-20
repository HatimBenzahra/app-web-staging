import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const prisma = new PrismaClient();
const BACKEND_URL = 'https://localhost:3000/graphql';
const AUDIO_FILE = '/tmp/simulation_60s.m4a';

async function graphql(query: string, variables: Record<string, any> = {}, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BACKEND_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function main() {
  console.log('🎬 SIMULATION TEMPS RÉEL — 60s audio, 6 segments, 6 statuts\n');

  const immeuble = await prisma.immeuble.findFirst({
    where: { portes: { some: {} } },
    select: { id: true, adresse: true },
    orderBy: { portes: { _count: 'desc' } },
  });
  if (!immeuble) { console.log('❌ Aucun immeuble avec portes'); process.exit(1); }

  let portes = await prisma.porte.findMany({
    where: { immeubleId: immeuble.id },
    select: { id: true, numero: true, etage: true },
    orderBy: [{ etage: 'asc' }, { numero: 'asc' }],
    take: 6,
  });

  if (portes.length < 6) {
    console.log(`⚠️  ${portes.length} portes disponibles, on crée celles qui manquent...`);
    const needed = 6 - portes.length;
    for (let i = 0; i < needed; i++) {
      const num = `${300 + i + 1}`;
      await prisma.porte.upsert({
        where: { immeubleId_numero: { immeubleId: immeuble.id, numero: num } },
        update: {},
        create: { immeubleId: immeuble.id, numero: num, etage: 3 },
      });
    }
    portes = await prisma.porte.findMany({
      where: { immeubleId: immeuble.id },
      select: { id: true, numero: true, etage: true },
      orderBy: [{ etage: 'asc' }, { numero: 'asc' }],
      take: 6,
    });
  }

  console.log(`🏢 Immeuble #${immeuble.id}: ${immeuble.adresse}`);
  console.log(`🚪 ${portes.length} portes\n`);

  type StatutPorte = 'CONTRAT_SIGNE' | 'REFUS' | 'RENDEZ_VOUS_PRIS' | 'ABSENT' | 'ARGUMENTE' | 'NECESSITE_REPASSAGE';

  const scenarios: Array<{ statut: StatutPorte; journey: StatutPorte[]; comment: string }> = [
    { statut: 'CONTRAT_SIGNE', journey: ['ABSENT', 'ARGUMENTE', 'RENDEZ_VOUS_PRIS', 'CONTRAT_SIGNE'], comment: 'Contrat fibre signé après 4 visites' },
    { statut: 'REFUS', journey: ['ABSENT', 'REFUS'], comment: 'Client pas intéressé' },
    { statut: 'RENDEZ_VOUS_PRIS', journey: ['ABSENT', 'ARGUMENTE', 'RENDEZ_VOUS_PRIS'], comment: 'RDV confirmé pour mardi 14h30' },
    { statut: 'ABSENT', journey: ['ABSENT', 'ABSENT', 'ABSENT'], comment: 'Personne à 3 reprises' },
    { statut: 'ARGUMENTE', journey: ['ABSENT', 'ARGUMENTE'], comment: 'Bon échange mais hésite sur le prix' },
    { statut: 'NECESSITE_REPASSAGE', journey: ['ABSENT', 'NECESSITE_REPASSAGE'], comment: 'Client demande de revenir samedi' },
  ];

  await prisma.recordingSegment.deleteMany({});
  await prisma.statusHistorique.deleteMany({ where: { porte: { immeubleId: immeuble.id } } });

  const now = new Date();
  const commercials = await prisma.commercial.findMany({ take: 3, select: { id: true } });
  const commercialId = commercials[0]?.id ?? null;

  console.log('📋 Application des statuts et historique...\n');

  for (let i = 0; i < portes.length; i++) {
    const porte = portes[i];
    const scenario = scenarios[i];

    await prisma.porte.update({
      where: { id: porte.id },
      data: {
        statut: scenario.statut,
        derniereVisite: now,
        commentaire: scenario.comment,
        rdvDate: scenario.statut === 'RENDEZ_VOUS_PRIS' ? new Date(now.getTime() + 3 * 86400000) : null,
        rdvTime: scenario.statut === 'RENDEZ_VOUS_PRIS' ? '14:30' : null,
      },
    });

    const histEntries = scenario.journey.map((statut, v) => ({
      porteId: porte.id,
      commercialId,
      statut,
      commentaire: v === scenario.journey.length - 1 ? scenario.comment : null,
      rdvDate: statut === 'RENDEZ_VOUS_PRIS' ? new Date(now.getTime() + 3 * 86400000) : null,
      rdvTime: statut === 'RENDEZ_VOUS_PRIS' ? '14:30' : null,
      createdAt: new Date(now.getTime() - (scenario.journey.length - v) * 2 * 86400000),
    }));

    await prisma.statusHistorique.createMany({ data: histEntries });

    const emoji = scenario.statut === 'CONTRAT_SIGNE' ? '✅' :
                  scenario.statut === 'REFUS' ? '❌' :
                  scenario.statut === 'RENDEZ_VOUS_PRIS' ? '📅' :
                  scenario.statut === 'ABSENT' ? '🏠' :
                  scenario.statut === 'ARGUMENTE' ? '💬' : '🔄';
    console.log(`  ${emoji} Porte ${porte.numero} (étage ${porte.etage}) → ${scenario.statut} (${scenario.journey.length} visites)`);
  }

  console.log('\n🔐 Login...');
  const data = await graphql('mutation { login(loginInput: { username: "s.bachellier", password: "AZhk1234$" }) { access_token } }');
  const token = data.login.access_token;

  console.log('📤 Upload 60s audio réel...');
  const reqData = await graphql(`
    mutation($input: RequestRecordingUploadInput!) {
      requestRecordingUpload(input: $input) { uploadUrl s3Key }
    }
  `, { input: { roomName: 'room:commercial:1', immeubleId: immeuble.id, mimeType: 'audio/mp4', duration: 60 } }, token);

  const { uploadUrl, s3Key } = reqData.requestRecordingUpload;
  const audioBuffer = fs.readFileSync(AUDIO_FILE);
  await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'audio/mp4' }, body: audioBuffer });
  console.log('✅ Audio uploadé');

  const segDuration = 60 / portes.length;
  const doorSegments = portes.map((p, i) => ({
    porteId: p.id,
    numero: p.numero,
    etage: p.etage,
    startTime: i * segDuration,
    endTime: (i + 1) * segDuration,
    statut: scenarios[i].statut,
  }));

  console.log(`\n📎 Envoi de ${doorSegments.length} segments avec statuts...\n`);
  for (const seg of doorSegments) {
    const start = `${Math.floor(seg.startTime / 60)}:${String(Math.floor(seg.startTime % 60)).padStart(2, '0')}`;
    const end = `${Math.floor(seg.endTime / 60)}:${String(Math.floor(seg.endTime % 60)).padStart(2, '0')}`;
    console.log(`  🔊 Porte ${seg.numero} [${start} → ${end}] — ${seg.statut}`);
  }

  await graphql(`
    mutation($input: ConfirmRecordingUploadInput!) {
      confirmRecordingUpload(input: $input) { key }
    }
  `, { input: { s3Key, duration: 60, doorSegments } }, token);

  console.log('\n\n╔══════════════════════════════════════════════╗');
  console.log('║        🎉 SIMULATION TERMINÉE               ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║                                              ║');
  console.log('║  6 portes × 6 statuts × audio réel          ║');
  console.log('║  + historique complet (2-4 visites/porte)    ║');
  console.log('║                                              ║');
  console.log(`║  👉 https://localhost:5173/immeubles/${immeuble.id}      ║`);
  console.log('║                                              ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
