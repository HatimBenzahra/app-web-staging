import {
  centroid,
  enclosingRadiusMeters,
  parseRing,
  polygonAreaM2,
  type Ring,
} from './zone.geometry';

describe('zone.geometry', () => {
  // Petit carré ~111 m de côté proche de l'équateur (lng/lat en degrés).
  const square: Ring = [
    [0, 0],
    [0.001, 0],
    [0.001, 0.001],
    [0, 0.001],
  ];

  describe('parseRing', () => {
    it('normalise un anneau ouvert valide', () => {
      expect(parseRing(square)).toEqual(square);
    });

    it('retire le point de fermeture dupliqué (anneau fermé)', () => {
      const closed: Ring = [...square, [0, 0]];
      expect(parseRing(closed)).toEqual(square);
    });

    it('rejette une entrée non tableau', () => {
      expect(() => parseRing('nope' as unknown)).toThrow();
    });

    it('rejette une coordonnée non numérique', () => {
      expect(() => parseRing([[0, 0], ['a', 1], [1, 1]] as unknown)).toThrow();
    });

    it('rejette moins de 3 sommets distincts', () => {
      expect(() =>
        parseRing([
          [0, 0],
          [1, 1],
          [0, 0],
        ]),
      ).toThrow();
    });
  });

  describe('centroid', () => {
    it('retourne la moyenne des sommets (xOrigin=lng, yOrigin=lat)', () => {
      const c = centroid(square);
      expect(c.xOrigin).toBeCloseTo(0.0005, 10);
      expect(c.yOrigin).toBeCloseTo(0.0005, 10);
    });
  });

  describe('enclosingRadiusMeters', () => {
    it('retourne la distance haversine max centre -> sommet (positive)', () => {
      const center = centroid(square);
      const radius = enclosingRadiusMeters(center, square);
      // Demi-diagonale d'un carré de ~111 m => ~78 m.
      expect(radius).toBeGreaterThan(70);
      expect(radius).toBeLessThan(90);
    });

    it('couvre bien tous les sommets', () => {
      const center = centroid(square);
      const radius = enclosingRadiusMeters(center, square);
      // Le rayon englobant est >= distance à chaque sommet par construction.
      expect(radius).toBeGreaterThan(0);
    });
  });

  describe('polygonAreaM2', () => {
    it('approxime l’aire d’un carré ~111 m de côté', () => {
      const area = polygonAreaM2(square);
      // ~111.19 m de côté => ~12360 m².
      expect(area).toBeGreaterThan(11000);
      expect(area).toBeLessThan(14000);
    });

    it('est insensible au sens de parcours (valeur absolue)', () => {
      const reversed: Ring = [...square].reverse();
      expect(polygonAreaM2(reversed)).toBeCloseTo(polygonAreaM2(square), 3);
    });
  });
});
