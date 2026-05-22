import {
  buildFallbackSegmentationBlocks,
  buildTranscriptChunks,
  TRANSCRIPT_CLEANER_MAX_CHUNK_SEC,
} from './transcription-chunking.utils';

describe('transcription chunking', () => {
  const transcript = Array.from({ length: 8 }, (_, index) => {
    const start = index * 30;
    const end = start + 20;
    const mmStart = String(Math.floor(start / 60)).padStart(2, '0');
    const ssStart = String(start % 60).padStart(2, '0');
    const mmEnd = String(Math.floor(end / 60)).padStart(2, '0');
    const ssEnd = String(end % 60).padStart(2, '0');
    return `[${mmStart}:${ssStart} → ${mmEnd}:${ssEnd}] Segment ${index + 1}`;
  }).join('\n');

  it('découpe une longue fenêtre en chunks courts', () => {
    const chunks = buildTranscriptChunks({
      transcriptText: transcript,
      startTime: 0,
      endTime: 240,
      idPrefix: 'test',
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.every(
        (chunk) => chunk.endTime - chunk.startTime <= TRANSCRIPT_CLEANER_MAX_CHUNK_SEC,
      ),
    ).toBe(true);
  });

  it('produit des blocs fallback UNCERTAIN nettoyables', () => {
    const blocks = buildFallbackSegmentationBlocks({
      transcriptText: transcript,
      startTime: 0,
      endTime: 240,
    });

    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((block) => block.type === 'UNCERTAIN')).toBe(true);
    expect(blocks.every((block) => block.shouldClean)).toBe(true);
  });
});
