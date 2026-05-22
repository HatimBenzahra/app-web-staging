import { RecordingSegmentationService } from './recording-segmentation.service';

const makePrisma = () => {
  const conversationRows: any[] = [];
  const prisma = {
    recordingSegment: {
      findMany: jest.fn(),
    },
    recordingConversationSegment: {
      count: jest.fn(async ({ where }: any) =>
        conversationRows.filter((row) => row.s3KeyOriginal === where.s3KeyOriginal)
          .length,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        conversationRows
          .filter((row) => row.s3KeyOriginal === where.s3KeyOriginal)
          .sort((a, b) => a.startTime - b.startTime),
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        conversationRows.find(
          (row) => row.recordingSegmentId === where.recordingSegmentId,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: conversationRows.length + 1,
          coachingSessionId: null,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        conversationRows.push(row);
        return row;
      }),
      createMany: jest.fn(async ({ data }: any) => {
        for (const item of data) {
          conversationRows.push({
            id: conversationRows.length + 1,
            recordingSegmentId: null,
            coachingSessionId: null,
            porteId: null,
            commercialId: null,
            managerId: null,
            immeubleId: null,
            s3KeySegment: null,
            ...item,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return { count: data.length };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const index = conversationRows.findIndex((row) => row.id === where.id);
        conversationRows[index] = {
          ...conversationRows[index],
          ...data,
          updatedAt: new Date(),
        };
        return conversationRows[index];
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const row of conversationRows) {
          if (
            row.s3KeyOriginal === where.s3KeyOriginal &&
            row.coachingSessionId === where.coachingSessionId
          ) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      }),
    },
  };

  return { prisma, conversationRows };
};

describe('RecordingSegmentationService', () => {
  it('crée des segments canoniques depuis les segments porte enrichis', async () => {
    const { prisma } = makePrisma();
    prisma.recordingSegment.findMany.mockResolvedValue([
      {
        id: 10,
        porteId: 101,
        commercialId: 1,
        managerId: null,
        immeubleId: 5,
        s3KeyOriginal: 'recordings/a.mp4',
        s3KeySegment: 'recordings/a/101.mp4',
        startTime: 3,
        endTime: 33,
        durationSec: 30,
        transcription: 'Bonjour madame, je passe pour la fibre.',
        speechScore: 72,
      },
    ]);

    const service = new RecordingSegmentationService(
      prisma as any,
      { transcribeRecordingFromS3: jest.fn() } as any,
    );

    const result = await service.ensureSegmentsForRecording('recordings/a.mp4');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      recordingSegmentId: 10,
      porteId: 101,
      source: 'MOBILE_DOOR',
      type: 'PROSPECT',
      reviewStatus: 'NOT_REQUIRED',
      confidence: 0.86,
      text: 'Bonjour madame, je passe pour la fibre.',
    });
  });

  it('génère des segments fallback Whisper quand aucune porte n’existe', async () => {
    const { prisma } = makePrisma();
    prisma.recordingSegment.findMany.mockResolvedValue([]);
    const transcriptionService = {
      transcribeRecordingFromS3: jest.fn().mockResolvedValue({
        duration: 80,
        segments: [
          {
            start: 0,
            end: 5,
            text: 'Bonjour.',
            words: [{ word: 'Bonjour', start: 0.5, end: 1.1 }],
          },
          {
            start: 8,
            end: 16,
            text: 'Je vous appelle pour votre contrat.',
            words: [
              { word: 'Je', start: 8.1, end: 8.2 },
              { word: 'contrat', start: 14.8, end: 15.5 },
            ],
          },
          {
            start: 55,
            end: 62,
            text: 'Merci bonne journée.',
            words: [{ word: 'Merci', start: 55.2, end: 55.6 }],
          },
        ],
      }),
    };
    const service = new RecordingSegmentationService(
      prisma as any,
      transcriptionService as any,
    );

    const result = await service.ensureSegmentsForRecording('recordings/b.mp4');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      source: 'AUDIO_TRANSCRIPT',
      type: 'UNKNOWN',
      reviewStatus: 'PENDING',
      confidence: 0.55,
      text: 'Bonjour. Je vous appelle pour votre contrat.',
    });
    expect(result[1].startTime).toBe(55);
    expect(result[0].wordsJson).toEqual([
      { word: 'Bonjour', start: 0.5, end: 1.1 },
      { word: 'Je', start: 8.1, end: 8.2 },
      { word: 'contrat', start: 14.8, end: 15.5 },
    ]);
  });

  it('enrichit les portes mobiles sans transcription depuis Whisper complet', async () => {
    const { prisma } = makePrisma();
    prisma.recordingSegment.findMany.mockResolvedValue([
      {
        id: 11,
        porteId: 201,
        commercialId: 1,
        managerId: null,
        immeubleId: 5,
        s3KeyOriginal: 'recordings/c.mp4',
        s3KeySegment: 'recordings/c/201.mp4',
        startTime: 4,
        endTime: 171,
        durationSec: 167,
        transcription: null,
        speechScore: null,
      },
      {
        id: 12,
        porteId: 202,
        commercialId: 1,
        managerId: null,
        immeubleId: 5,
        s3KeyOriginal: 'recordings/c.mp4',
        s3KeySegment: 'recordings/c/202.mp4',
        startTime: 175,
        endTime: 646,
        durationSec: 471,
        transcription: null,
        speechScore: null,
      },
    ]);
    const transcriptionService = {
      transcribeRecordingFromS3: jest.fn(),
    };
    const service = new RecordingSegmentationService(
      prisma as any,
      transcriptionService as any,
    );

    const result = await service.ensureSegmentsForRecording('recordings/c.mp4', {
      duration: 700,
      segments: [
        {
          start: 30,
          end: 75,
          text: 'Bonjour madame, je viens pour la fibre.',
          words: [
            { word: 'Bonjour', start: 30.2, end: 30.7 },
            { word: 'fibre', start: 70, end: 70.4 },
          ],
        },
        {
          start: 200,
          end: 250,
          text: 'On peut prendre deux minutes ?',
          words: [{ word: 'minutes', start: 220, end: 220.5 }],
        },
        {
          start: 300,
          end: 360,
          text: 'Vous êtes chez quel fournisseur ?',
          words: [{ word: 'fournisseur', start: 330, end: 331 }],
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      recordingSegmentId: 11,
      source: 'MOBILE_DOOR',
      type: 'PROSPECT',
      reviewStatus: 'NOT_REQUIRED',
      confidence: 0.82,
      text: 'Bonjour madame, je viens pour la fibre.',
      sourceTranscriptSegments: [
        { start: 30, end: 75, text: 'Bonjour madame, je viens pour la fibre.' },
      ],
    });
    expect(result[1].text).toBe(
      'On peut prendre deux minutes ? Vous êtes chez quel fournisseur ?',
    );
    expect(result[1].sourceTranscriptSegments).toEqual([
      { start: 200, end: 250, text: 'On peut prendre deux minutes ?' },
      { start: 300, end: 360, text: 'Vous êtes chez quel fournisseur ?' },
    ]);
    expect(result[0].wordsJson).toEqual([
      { word: 'Bonjour', start: 30.2, end: 30.7 },
      { word: 'fibre', start: 70, end: 70.4 },
    ]);
    expect(result[1].wordsJson).toEqual([
      { word: 'minutes', start: 220, end: 220.5 },
      { word: 'fournisseur', start: 330, end: 331 },
    ]);
    expect(transcriptionService.transcribeRecordingFromS3).not.toHaveBeenCalled();
    expect(prisma.recordingConversationSegment.createMany).not.toHaveBeenCalled();
  });

  it('rattache un segment Whisper qui chevauche partiellement une porte', async () => {
    const { prisma } = makePrisma();
    prisma.recordingSegment.findMany.mockResolvedValue([
      {
        id: 13,
        porteId: 203,
        commercialId: 1,
        managerId: null,
        immeubleId: 5,
        s3KeyOriginal: 'recordings/d.mp4',
        s3KeySegment: 'recordings/d/203.mp4',
        startTime: 100,
        endTime: 130,
        durationSec: 30,
        transcription: null,
        speechScore: null,
      },
    ]);
    const service = new RecordingSegmentationService(
      prisma as any,
      { transcribeRecordingFromS3: jest.fn() } as any,
    );

    const result = await service.ensureSegmentsForRecording('recordings/d.mp4', {
      duration: 180,
      segments: [
        {
          start: 95,
          end: 115,
          text: 'Bonjour je suis bien à la bonne adresse.',
          words: [
            { word: 'hors', start: 96, end: 97 },
            { word: 'Bonjour', start: 101, end: 101.4 },
            { word: 'adresse', start: 114, end: 114.6 },
          ],
        },
        { start: 140, end: 150, text: 'Texte hors porte.' },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(
      'Bonjour je suis bien à la bonne adresse.',
    );
    expect(result[0].sourceTranscriptSegments).toEqual([
      { start: 95, end: 115, text: 'Bonjour je suis bien à la bonne adresse.' },
    ]);
    expect(result[0].wordsJson).toEqual([
      { word: 'Bonjour', start: 101, end: 101.4 },
      { word: 'adresse', start: 114, end: 114.6 },
    ]);
    expect(result[0].speechScore).toBe(50);
  });
});
