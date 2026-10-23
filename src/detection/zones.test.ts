import { describe, it, expect } from 'vitest';
import { FACE, FACE_LANDMARKS_USED, ZONES, createResolvedZone, type ZoneId } from './zones.ts';
import { IMAGE, facePoint, neutralFace } from './synthetic.ts';
import type { Landmark } from './types.ts';

const ZONE_IDS = Object.keys(ZONES) as ZoneId[];
const norm = ([x, y]: [number, number]) => [x / IMAGE.width, y / IMAGE.height];

/** The face array wrapped so every index a resolver reads is recorded. */
function watched(face: Landmark[]) {
  const read = new Set<number>();
  const proxy = new Proxy(face, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) read.add(Number(prop));
      return Reflect.get(target, prop, receiver);
    },
  });
  return { proxy, read };
}

describe('face zones', () => {
  it('each zone reads exactly the face-mesh indices it declares, so fixtures know what to carry', () => {
    for (const id of ZONE_IDS) {
      const { proxy, read } = watched(neutralFace());
      ZONES[id].resolve(proxy, createResolvedZone());
      expect([...read].sort((a, b) => a - b), id).toEqual([...new Set(ZONES[id].landmarks)].sort((a, b) => a - b));
    }
  });

  it('FACE_LANDMARKS_USED is the sorted union of the zones and every index is a real face-mesh index', () => {
    const union = new Set(ZONE_IDS.flatMap(id => ZONES[id].landmarks));
    expect([...FACE_LANDMARKS_USED]).toEqual([...union].sort((a, b) => a - b));
    for (const i of FACE_LANDMARKS_USED) expect(i >= 0 && i < 468).toBe(true);
  });

  it('the named indices are the ones MediaPipe documents (lips 13/14/17, oval 10/152/234/454)', () => {
    expect([FACE.INNER_LIP_UPPER, FACE.INNER_LIP_LOWER, FACE.OUTER_LIP_LOWER_BOTTOM]).toEqual([13, 14, 17]);
    expect([FACE.OVAL_TOP, FACE.OVAL_CHIN, FACE.OVAL_SIDE_RIGHT, FACE.OVAL_SIDE_LEFT]).toEqual([10, 152, 234, 454]);
  });

  it('the mouth zone is the midpoint of the inner lips, in image units', () => {
    const z = createResolvedZone();
    ZONES.mouth.resolve(neutralFace(), z);
    const [mx, my] = norm(facePoint('mouth'));
    expect(z.count).toBe(1);
    expect(z.unit).toBe(1);
    expect(z.x[0]).toBeCloseTo(mx, 10);
    expect(z.y[0]).toBeCloseTo(my, 10);
  });

  it('the other zones are measured in face sizes', () => {
    const face = neutralFace();
    const width = Math.hypot(face[234].x - face[454].x, face[234].y - face[454].y);
    const height = Math.hypot(face[10].x - face[152].x, face[10].y - face[152].y);
    const unitOf = (id: ZoneId) => { const z = createResolvedZone(); ZONES[id].resolve(face, z); return z.unit; };
    expect(unitOf('nose')).toBeCloseTo(width, 10);
    expect(unitOf('eye_area')).toBeCloseTo(width, 10);
    expect(unitOf('face_skin')).toBeCloseTo(width, 10);
    expect(unitOf('scalp')).toBeCloseTo(height, 10);
  });

  it('anchors sit where the zone is described to be', () => {
    const face = neutralFace();
    const anchors = (id: ZoneId) => { const z = createResolvedZone(); ZONES[id].resolve(face, z); return Array.from({ length: z.count }, (_, i) => [z.x[i], z.y[i]]); };
    const close = (a: number[], b: number[]) => { expect(a[0]).toBeCloseTo(b[0], 8); expect(a[1]).toBeCloseTo(b[1], 8); };

    close(anchors('nose')[0], norm(facePoint('noseBase')));
    const eye = anchors('eye_area');
    close(eye[0], norm(facePoint('eyeRight')));
    close(eye[1], norm(facePoint('eyeLeft')));
    close(eye[2], norm(facePoint('browRight')));
    close(eye[3], norm(facePoint('browLeft')));
    const skin = anchors('face_skin');
    close(skin[0], norm(facePoint('cheekRight')));
    close(skin[1], norm(facePoint('cheekLeft')));
    close(skin[2], norm(facePoint('chinAnchor')));
    close(skin[3], norm(facePoint('foreheadAnchor')));
    const scalp = anchors('scalp');
    close(scalp[0], norm(facePoint('scalpTop')));
    close(scalp[1], norm(facePoint('scalpLeft')));  // anchors 1 and 2 are the image-right and image-left sides
    close(scalp[2], norm(facePoint('scalpRight')));
  });

  it('the scalp anchors are all above the top of the forehead', () => {
    const face = neutralFace();
    const z = createResolvedZone();
    ZONES.scalp.resolve(face, z);
    for (let i = 0; i < z.count; i++) expect(z.y[i]).toBeLessThan(face[10].y);
  });

  it('zones follow the face: moved and enlarged, the anchors and units move with it', () => {
    const small = neutralFace();
    const big = neutralFace({ width: 340, height: 390, cx: 400, cy: 200 });
    for (const id of ZONE_IDS) {
      const a = createResolvedZone();
      const b = createResolvedZone();
      ZONES[id].resolve(small, a);
      ZONES[id].resolve(big, b);
      if (id === 'mouth') continue; // image units by design
      expect(b.unit / a.unit, id).toBeGreaterThan(1.9);
      expect(b.unit / a.unit, id).toBeLessThan(2.4); // x and y are normalised separately, so not exactly 2
    }
  });

  it('the scalp follows a tilted head', () => {
    // Tilt the face 30 degrees: the scalp anchors must tilt with the chin-to-forehead axis.
    const f = neutralFace();
    const angle = (30 * Math.PI) / 180;
    const cx = 0.5, cy = 0.5;
    const tilted = f.map(p => ({
      x: cx + (p.x - cx) * Math.cos(angle) - (p.y - cy) * Math.sin(angle),
      y: cy + (p.x - cx) * Math.sin(angle) + (p.y - cy) * Math.cos(angle),
    }));
    const upright = createResolvedZone();
    const tilt = createResolvedZone();
    ZONES.scalp.resolve(f, upright);
    ZONES.scalp.resolve(tilted, tilt);
    // The centre anchor stays on the line from the chin through the top of the forehead.
    const ux = tilted[10].x - tilted[152].x;
    const uy = tilted[10].y - tilted[152].y;
    const ax = tilt.x[0] - tilted[10].x;
    const ay = tilt.y[0] - tilted[10].y;
    const cross = ux * ay - uy * ax;
    expect(Math.abs(cross)).toBeLessThan(1e-9);
    expect(ux * ax + uy * ay).toBeGreaterThan(0); // beyond the forehead, not below it
  });

  it('a face with too few landmarks throws, like the shipped mouth check did', () => {
    expect(() => ZONES.mouth.resolve([], createResolvedZone())).toThrow();
  });
});
