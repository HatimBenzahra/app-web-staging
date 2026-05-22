import {
  normalizeTranscriptWords,
  resolveExcerptTimeRangeFromWords,
} from './transcript-word-timing.utils';

describe('transcript-word-timing utils', () => {
  const words = [
    { word: 'Bonjour', start: 10, end: 10.4 },
    { word: 'madame', start: 10.45, end: 10.9 },
    { word: 'je', start: 11, end: 11.1 },
    { word: 'passe', start: 11.15, end: 11.45 },
    { word: 'pour', start: 11.5, end: 11.7 },
    { word: "l'électricité", start: 11.75, end: 12.4 },
  ];

  it('résout un verbatim exact avec padding audio', () => {
    expect(resolveExcerptTimeRangeFromWords(words, 'je passe pour')).toEqual({
      start: 10.75,
      end: 12.05,
    });
  });

  it('normalise accents et apostrophes', () => {
    expect(
      resolveExcerptTimeRangeFromWords(words, 'pour electricite'),
    ).toEqual({
      start: 11.25,
      end: 12.75,
    });
  });

  it('retrouve une fenêtre partiellement bruitée', () => {
    expect(
      resolveExcerptTimeRangeFromWords(
        words,
        "bonjour madame je viens pour l'electricite",
      ),
    ).toEqual({
      start: 9.75,
      end: 12.75,
    });
  });

  it('retourne null si aucun match fiable', () => {
    expect(resolveExcerptTimeRangeFromWords(words, 'signature contrat fibre')).toBeNull();
  });

  it('nettoie les words invalides', () => {
    expect(
      normalizeTranscriptWords([
        { word: 'Bonjour', start: 1, end: 2, score: 0.8 },
        { word: '', start: 2, end: 3 },
        { word: 'bad', start: 3, end: 2 },
        null,
      ]),
    ).toEqual([{ word: 'Bonjour', start: 1, end: 2, score: 0.8 }]);
  });
});
