import { CoachingRecordingCatalogService } from './coaching-recording-catalog.service';
import { CoachingRecordingPeriodDto } from '../coaching.dto';

const currentUser = { id: 10, role: 'admin' };

const makeService = ({
  commercials = [
    {
      id: 1,
      prenom: 'Alice',
      nom: 'Martin',
      email: 'alice@example.test',
      directeurId: 10,
    },
    {
      id: 2,
      prenom: 'Brahim',
      nom: 'Durand',
      email: 'brahim@example.test',
      directeurId: 10,
    },
  ],
  recordings = [],
  speechScores = [],
  latestSessions = [],
}: {
  commercials?: any[];
  recordings?: any[];
  speechScores?: any[];
  latestSessions?: any[];
}) => {
  const prisma = {
    commercial: {
      findMany: jest.fn().mockResolvedValue(commercials),
    },
    coachingSession: {
      findMany: jest.fn().mockResolvedValue(latestSessions),
    },
  };

  const recordingService = {
    listAllRecordings: jest.fn().mockResolvedValue({
      items: recordings,
      totalCount: recordings.length,
    }),
    getSpeechScores: jest.fn().mockReturnValue(speechScores),
  };

  return {
    service: new CoachingRecordingCatalogService(
      prisma as any,
      recordingService as any,
    ),
    prisma,
    recordingService,
  };
};

describe('CoachingRecordingCatalogService', () => {
  it('renvoie un catalogue enrichi et exclut les fichiers non exploitables par défaut', async () => {
    const alphaKey = 'recordings/room_commercial_1/alpha.mp4';
    const betaKey = 'recordings/room_commercial_2/beta.mp4';
    const { service, recordingService } = makeService({
      recordings: [
        {
          key: alphaKey,
          size: 1024,
          lastModified: new Date('2026-05-10T10:00:00Z'),
        },
        {
          key: 'recordings/room_commercial_1/alpha_conv.mp4',
          size: 512,
          lastModified: new Date('2026-05-10T10:00:00Z'),
        },
        {
          key: 'recordings/room_commercial_1/readme.txt',
          size: 128,
          lastModified: new Date('2026-05-10T10:00:00Z'),
        },
        {
          key: betaKey,
          size: 2048,
          lastModified: new Date('2026-05-09T10:00:00Z'),
        },
      ],
      speechScores: [
        {
          key: alphaKey,
          status: 'ready',
          score: 72,
          totalDurationSec: 360,
          speechDurationSec: 240,
        },
        {
          key: betaKey,
          status: 'ready',
          score: 20,
          totalDurationSec: 180,
          speechDurationSec: 45,
        },
      ],
    });

    const result = await service.getRecordingCandidates(
      { period: CoachingRecordingPeriodDto.ALL, includeLowValue: false },
      currentUser,
    );

    expect(recordingService.listAllRecordings).toHaveBeenCalledWith(
      ['room:commercial:1', 'room:commercial:2'],
      currentUser,
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      key: alphaKey,
      commercialId: 1,
      commercialNom: 'Alice Martin',
      speechScore: 72,
      exploitabilityStatus: 'PRIORITY',
    });
  });

  it('applique les filtres recherche, commercial, statut analyse et niveau de parole', async () => {
    const betaKey = 'recordings/room_commercial_2/beta.mp4';
    const { service } = makeService({
      recordings: [
        {
          key: 'recordings/room_commercial_1/alpha.mp4',
          size: 1024,
          lastModified: new Date('2026-05-10T10:00:00Z'),
        },
        {
          key: betaKey,
          size: 2048,
          lastModified: new Date('2026-05-09T10:00:00Z'),
        },
      ],
      speechScores: [
        {
          key: betaKey,
          status: 'ready',
          score: 30,
          totalDurationSec: 240,
          speechDurationSec: 100,
        },
      ],
      latestSessions: [
        {
          id: 42,
          s3KeyOriginal: betaKey,
          status: 'FAILED',
          analysisJobs: [
            {
              id: 100,
              status: 'PROCESSING',
              queuedAt: new Date('2026-05-09T10:01:00Z'),
              startedAt: new Date('2026-05-09T10:02:00Z'),
            },
          ],
        },
      ],
    });

    const result = await service.getRecordingCandidates(
      {
        period: CoachingRecordingPeriodDto.ALL,
        search: 'beta',
        commercialId: 2,
        analysisStatus: 'PROCESSING',
        speechLevel: 'LOW',
        includeLowValue: true,
      },
      currentUser,
    );

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      key: betaKey,
      latestSessionId: 42,
      latestSessionStatus: 'FAILED',
      analysisJobId: 100,
      analysisJobStatus: 'PROCESSING',
      exploitabilityStatus: 'REVIEW',
    });
  });
});
