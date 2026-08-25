import { NotFoundException } from '@nestjs/common';
import { CoachingService } from './coaching.service';

/**
 * Relancer une analyse doit la rejouer sur le plan de vente ACTIF.
 *
 * Vu en production : une analyse créée du temps du plan énergie (v1) restait
 * épinglée à cette version en la relançant. Ses clés produit (`telecom`,
 * `conciergerie`) ne correspondaient à aucune fiche, donc aucune conformité
 * produit n'était jugée — sans erreur, sans message.
 */
describe('relaunch — version de plan', () => {
  const active = { id: 10, version: 10 };

  const build = (analysis: any, existing: any = null) => {
    const updated: any[] = [];
    const created: any[] = [];
    const prisma: any = {
      coachingAnalysis: {
        findUnique: jest.fn(({ where }) =>
          where.id ? analysis : existing,
        ),
        update: jest.fn((args) => {
          updated.push(args);
          return args;
        }),
        create: jest.fn((args) => {
          created.push(args);
          return { id: 999 };
        }),
      },
    };
    const query: any = { getAnalysis: jest.fn((id: number) => ({ id })) };
    const salesPlans: any = { getActiveVersion: jest.fn(() => active) };
    const service = new CoachingService(
      prisma,
      salesPlans,
      { isConfigured: () => true } as any, // llm
      {} as any, // config
      query,
    );
    return { service, prisma, updated, created };
  };

  const base = {
    id: 1,
    s3KeyOriginal: 'rec/a.mp4',
    salesPlanVersionId: 1,
    recordingId: 5,
    porteId: 7,
    commercialId: 3,
    managerId: null,
    statutPorte: 'ARGUMENTE',
    transcript: 'bonjour, on est France Téléphone',
    transcriptDurationSec: 120,
  };

  it('crée une analyse sur le plan actif quand la ligne est sur une version périmée', async () => {
    const { service, created } = build(base);
    const res = await service.relaunch(1);

    expect(created).toHaveLength(1);
    expect(created[0].data.salesPlanVersionId).toBe(active.id);
    expect(created[0].data.status).toBe('PENDING');
    // Le transcript est repris : l'audio n'a pas changé, inutile de re-payer Whisper.
    expect(created[0].data.transcript).toBe(base.transcript);
    expect(created[0].data.manual).toBe(true);
    expect(res.id).toBe(999);
  });

  it('ne touche pas la ligne d’origine — elle reste l’historique de son référentiel', async () => {
    const { service, updated } = build(base);
    await service.relaunch(1);
    expect(updated).toHaveLength(0);
  });

  it('remet simplement en file quand la ligne est déjà sur le plan actif', async () => {
    const { service, updated, created } = build({
      ...base,
      salesPlanVersionId: active.id,
    });
    await service.relaunch(1);

    expect(created).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0].where.id).toBe(1);
    expect(updated[0].data.status).toBe('PENDING');
    expect(updated[0].data.attempts).toBe(0);
  });

  it('préserve le transcript de la cible quand elle en a déjà un', async () => {
    const { service, updated } = build(base, {
      id: 42,
      transcript: 'transcript plus récent',
    });
    await service.relaunch(1);

    expect(updated).toHaveLength(1);
    expect(updated[0].where.id).toBe(42);
    expect(updated[0].data.transcript).toBeUndefined();
  });

  it('refuse de relancer sans plan de vente actif', async () => {
    const { service } = build(base);
    (service as any).salesPlans.getActiveVersion = jest.fn(() => null);
    await expect(service.relaunch(1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
