/**
 * SK-wall-profile-v1 Bloque 6B — pure edit helpers on provisional SketchProfile.
 * Session/UI call these; AxonDocument is untouched until commit.
 */

import { SNAP_TOLERANCE } from "@axonbim/shared";
import type { SketchPoint } from "./sketchRect.js";
import {
  profileFromClosedRing,
  profileVertices,
  type SketchProfile,
} from "./sketchProfile.js";

function dist3(a: SketchPoint, b: SketchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function near(
  a: SketchPoint,
  b: SketchPoint,
  tol = SNAP_TOLERANCE,
): boolean {
  return dist3(a, b) <= tol;
}

function clonePoint(p: SketchPoint): SketchPoint {
  return { x: p.x, y: p.y, z: p.z };
}

function withMeta(
  profile: SketchProfile,
  verts: SketchPoint[],
  closed = profile.closed,
): SketchProfile {
  const next = profileFromClosedRing(
    verts.map(clonePoint),
    profile.sourceWallIds,
    closed,
  );
  return {
    ...next,
    semantic: profile.semantic,
  };
}

/** Closest point on segment AB to P (clamped). */
function closestOnSegment(
  p: SketchPoint,
  a: SketchPoint,
  b: SketchPoint,
): { point: SketchPoint; t: number; dist: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (len2 > 1e-24) {
    t =
      ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const point = {
    x: a.x + t * abx,
    y: a.y + t * aby,
    z: a.z + t * abz,
  };
  return { point, t, dist: dist3(p, point) };
}

function edgeEndpoints(
  verts: SketchPoint[],
  edgeIndex: number,
  closed: boolean,
): { a: SketchPoint; b: SketchPoint } | null {
  const n = verts.length;
  if (n < 2 || edgeIndex < 0) return null;
  const edgeCount = closed ? n : n - 1;
  if (edgeIndex >= edgeCount) return null;
  return {
    a: verts[edgeIndex]!,
    b: verts[(edgeIndex + 1) % n]!,
  };
}

/**
 * Hit-test world pick against profile edges (closest point on segment in 3D).
 * Default tol is wider than vertex hit so long sides stay pickable in alzado/3D.
 * @returns edge index in walk order, or -1
 */
export function hitProfileEdge(
  profile: SketchProfile,
  world: SketchPoint,
  tol = SNAP_TOLERANCE * 5,
): number {
  const verts = profileVertices(profile);
  const edgeCount = profile.closed ? verts.length : Math.max(0, verts.length - 1);
  let best = -1;
  let bestD = tol;
  for (let i = 0; i < edgeCount; i++) {
    const ends = edgeEndpoints(verts, i, profile.closed);
    if (!ends) continue;
    const { dist } = closestOnSegment(world, ends.a, ends.b);
    if (dist <= bestD) {
      bestD = dist;
      best = i;
    }
  }
  return best;
}

/** Midpoint of edge `edgeIndex` in walk order, or null if out of range. */
export function profileEdgeMidpoint(
  profile: SketchProfile,
  edgeIndex: number,
): SketchPoint | null {
  const verts = profileVertices(profile);
  const ends = edgeEndpoints(verts, edgeIndex, profile.closed);
  if (!ends) return null;
  return {
    x: (ends.a.x + ends.b.x) * 0.5,
    y: (ends.a.y + ends.b.y) * 0.5,
    z: (ends.a.z + ends.b.z) * 0.5,
  };
}

/**
 * Insert a vertex on the nearest edge at the closest point to `world`.
 * No-op (same profile) when the pick is near an existing vertex.
 */
export function splitProfileAtPoint(
  profile: SketchProfile,
  world: SketchPoint,
  tol = SNAP_TOLERANCE,
): SketchProfile {
  const verts = profileVertices(profile);
  if (verts.length < 2) return profile;

  for (const v of verts) {
    if (near(world, v, tol)) return profile;
  }

  const edgeCount = profile.closed ? verts.length : verts.length - 1;
  let bestEdge = -1;
  let bestPoint: SketchPoint | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < edgeCount; i++) {
    const ends = edgeEndpoints(verts, i, profile.closed)!;
    const { point, dist, t } = closestOnSegment(world, ends.a, ends.b);
    if (t <= 0 || t >= 1) continue;
    if (near(point, ends.a, tol) || near(point, ends.b, tol)) continue;
    if (dist < bestD) {
      bestD = dist;
      bestEdge = i;
      bestPoint = point;
    }
  }
  if (bestEdge < 0 || !bestPoint) return profile;

  const next = [
    ...verts.slice(0, bestEdge + 1),
    clonePoint(bestPoint),
    ...verts.slice(bestEdge + 1),
  ];
  return withMeta(profile, next);
}

/**
 * Closest-points intersection of segments AB and CD in 3D.
 * Returns the point on AB when segments approach within `tol`.
 */
function segmentIntersectOnAB(
  a: SketchPoint,
  b: SketchPoint,
  c: SketchPoint,
  d: SketchPoint,
  tol: number,
): { point: SketchPoint; s: number } | null {
  const EPS = 1e-14;
  const d1x = b.x - a.x;
  const d1y = b.y - a.y;
  const d1z = b.z - a.z;
  const d2x = d.x - c.x;
  const d2y = d.y - c.y;
  const d2z = d.z - c.z;
  const rx = a.x - c.x;
  const ry = a.y - c.y;
  const rz = a.z - c.z;

  const A = d1x * d1x + d1y * d1y + d1z * d1z;
  const E = d2x * d2x + d2y * d2y + d2z * d2z;
  const F = d2x * rx + d2y * ry + d2z * rz;
  const C = d1x * rx + d1y * ry + d1z * rz;
  const Bdot = d1x * d2x + d1y * d2y + d1z * d2z;

  let s: number;
  let t: number;

  if (A <= EPS && E <= EPS) {
    return null;
  }
  if (A <= EPS) {
    s = 0;
    t = E > EPS ? Math.max(0, Math.min(1, F / E)) : 0;
  } else if (E <= EPS) {
    t = 0;
    s = Math.max(0, Math.min(1, -C / A));
  } else {
    const denom = A * E - Bdot * Bdot;
    if (Math.abs(denom) < EPS) {
      // Nearly parallel: project midpoint of overlap onto AB if close
      s = Math.max(0, Math.min(1, -C / A));
      t = Math.max(0, Math.min(1, (Bdot * s + F) / E));
    } else {
      s = Math.max(0, Math.min(1, (Bdot * F - C * E) / denom));
      t = Math.max(0, Math.min(1, (Bdot * s + F) / E));
    }
  }

  const p = { x: a.x + s * d1x, y: a.y + s * d1y, z: a.z + s * d1z };
  const q = { x: c.x + t * d2x, y: c.y + t * d2y, z: c.z + t * d2z };
  if (dist3(p, q) > tol) return null;
  return { point: p, s };
}

/**
 * Split profile edges where segment `lineP1`–`lineP2` crosses them (not at endpoints).
 * @returns updated profile, or `null` when no splits
 */
export function splitProfileEdgeByLine(
  profile: SketchProfile,
  lineP1: SketchPoint,
  lineP2: SketchPoint,
  tol = SNAP_TOLERANCE,
): SketchProfile | null {
  const verts = profileVertices(profile);
  if (verts.length < 2) return null;

  const edgeCount = profile.closed ? verts.length : verts.length - 1;
  /** Insertions after vertex `edgeIndex`, sorted descending for stable splice. */
  const inserts: { after: number; point: SketchPoint }[] = [];

  for (let i = 0; i < edgeCount; i++) {
    const ends = edgeEndpoints(verts, i, profile.closed)!;
    const hit = segmentIntersectOnAB(ends.a, ends.b, lineP1, lineP2, tol);
    if (!hit) continue;
    if (hit.s <= 0 || hit.s >= 1) continue;
    if (near(hit.point, ends.a, tol) || near(hit.point, ends.b, tol)) continue;
    inserts.push({ after: i, point: clonePoint(hit.point) });
  }

  if (inserts.length === 0) return null;

  inserts.sort((a, b) => b.after - a.after);
  const next = verts.map(clonePoint);
  for (const ins of inserts) {
    next.splice(ins.after + 1, 0, ins.point);
  }
  return withMeta(profile, next);
}

/**
 * Translate a single edge (both endpoints) by `delta`.
 * @returns null when `edgeIndex` is out of range.
 */
export function translateProfileEdge(
  profile: SketchProfile,
  edgeIndex: number,
  delta: SketchPoint,
): SketchProfile | null {
  const verts = profileVertices(profile);
  const n = verts.length;
  const edgeCount = profile.closed ? n : Math.max(0, n - 1);
  if (edgeIndex < 0 || edgeIndex >= edgeCount) return null;
  const i0 = edgeIndex;
  const i1 = (edgeIndex + 1) % n;
  const next = verts.map((p, i) => {
    if (i === i0 || i === i1) {
      return {
        x: p.x + delta.x,
        y: p.y + delta.y,
        z: p.z + delta.z,
      };
    }
    return clonePoint(p);
  });
  return withMeta(profile, next);
}

/** Translate every vertex by `delta`. */
export function translateProfile(
  profile: SketchProfile,
  delta: SketchPoint,
): SketchProfile {
  const verts = profileVertices(profile).map((p) => ({
    x: p.x + delta.x,
    y: p.y + delta.y,
    z: p.z + delta.z,
  }));
  if (verts.length === 0) {
    return {
      sourceWallIds: [...profile.sourceWallIds],
      edges: [],
      closed: false,
      semantic: profile.semantic,
    };
  }
  return withMeta(profile, verts);
}

/** Alias of {@link translateProfile} (copy = translate provisional). */
export function copyProfileTranslated(
  profile: SketchProfile,
  delta: SketchPoint,
): SketchProfile {
  return translateProfile(profile, delta);
}

/** Rotate about world +Z through `pivot` (storey / horizontal WP). */
export function rotateProfile(
  profile: SketchProfile,
  pivot: SketchPoint,
  angleRad: number,
): SketchProfile {
  return rotateProfileAboutAxis(
    profile,
    pivot,
    { x: 0, y: 0, z: 1 },
    angleRad,
  );
}

/**
 * Rotate all vertices around `pivot` about unit (or non-zero) `axis` (Rodrigues).
 */
export function rotateProfileAboutAxis(
  profile: SketchProfile,
  pivot: SketchPoint,
  axis: SketchPoint,
  angleRad: number,
): SketchProfile {
  const len = Math.hypot(axis.x, axis.y, axis.z);
  if (len < 1e-14) return profile;
  const kx = axis.x / len;
  const ky = axis.y / len;
  const kz = axis.z / len;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const oneC = 1 - c;

  const verts = profileVertices(profile).map((p) => {
    const vx = p.x - pivot.x;
    const vy = p.y - pivot.y;
    const vz = p.z - pivot.z;
    const dot = kx * vx + ky * vy + kz * vz;
    const cx = ky * vz - kz * vy;
    const cy = kz * vx - kx * vz;
    const cz = kx * vy - ky * vx;
    return {
      x: pivot.x + vx * c + cx * s + kx * dot * oneC,
      y: pivot.y + vy * c + cy * s + ky * dot * oneC,
      z: pivot.z + vz * c + cz * s + kz * dot * oneC,
    };
  });
  if (verts.length === 0) return profile;
  return withMeta(profile, verts);
}

/**
 * Chamfer-like fillet: replace corner `vertexIndex` with two points at distance
 * `radius` along adjacent edges; remove the original vertex.
 * @returns null if radius exceeds adjacent edge lengths or loop would be invalid
 */
export function filletProfileVertex(
  profile: SketchProfile,
  vertexIndex: number,
  radius: number,
  tol = SNAP_TOLERANCE,
): SketchProfile | null {
  if (!(radius > tol)) return null;
  const verts = profileVertices(profile);
  const n = verts.length;
  if (vertexIndex < 0 || vertexIndex >= n) return null;
  if (profile.closed && n < 3) return null;
  if (!profile.closed && (vertexIndex === 0 || vertexIndex === n - 1)) {
    return null;
  }

  const prevIdx = profile.closed
    ? (vertexIndex - 1 + n) % n
    : vertexIndex - 1;
  const nextIdx = profile.closed
    ? (vertexIndex + 1) % n
    : vertexIndex + 1;
  if (prevIdx < 0 || nextIdx >= n) return null;

  const v = verts[vertexIndex]!;
  const prev = verts[prevIdx]!;
  const next = verts[nextIdx]!;
  const dPrev = dist3(prev, v);
  const dNext = dist3(v, next);
  if (dPrev < radius - 1e-12 || dNext < radius - 1e-12) return null;

  const along = (
    from: SketchPoint,
    to: SketchPoint,
    dist: number,
  ): SketchPoint => {
    const len = dist3(from, to);
    const t = dist / len;
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    };
  };

  // Points on edges toward neighbors, measured from the corner vertex.
  const pA = along(v, prev, radius);
  const pB = along(v, next, radius);

  const nextVerts: SketchPoint[] = [];
  for (let i = 0; i < n; i++) {
    if (i === vertexIndex) {
      nextVerts.push(clonePoint(pA), clonePoint(pB));
    } else {
      nextVerts.push(clonePoint(verts[i]!));
    }
  }

  if (profile.closed && nextVerts.length < 3) return null;
  return withMeta(profile, nextVerts);
}

/** Local axes of a Workplane (or any orthonormal frame) for planar edits. */
export type SketchPlaneFrame = {
  origin: SketchPoint;
  axisU: SketchPoint;
  axisV: SketchPoint;
};

function worldToFrameUV(
  frame: SketchPlaneFrame,
  p: SketchPoint,
): { u: number; v: number } {
  const dx = p.x - frame.origin.x;
  const dy = p.y - frame.origin.y;
  const dz = p.z - frame.origin.z;
  return {
    u: dx * frame.axisU.x + dy * frame.axisU.y + dz * frame.axisU.z,
    v: dx * frame.axisV.x + dy * frame.axisV.y + dz * frame.axisV.z,
  };
}

function frameUVToWorld(
  frame: SketchPlaneFrame,
  u: number,
  v: number,
): SketchPoint {
  return {
    x: frame.origin.x + u * frame.axisU.x + v * frame.axisV.x,
    y: frame.origin.y + u * frame.axisU.y + v * frame.axisV.y,
    z: frame.origin.z + u * frame.axisU.z + v * frame.axisV.z,
  };
}

function intersectUvLines(
  p1: { u: number; v: number },
  d1: { u: number; v: number },
  p2: { u: number; v: number },
  d2: { u: number; v: number },
): { u: number; v: number } | null {
  const denom = d1.u * d2.v - d1.v * d2.u;
  if (Math.abs(denom) < 1e-14) return null;
  const su = p2.u - p1.u;
  const sv = p2.v - p1.v;
  const t = (su * d2.v - sv * d2.u) / denom;
  return { u: p1.u + t * d1.u, v: p1.v + t * d1.v };
}

/**
 * Equidistant offset of a closed loop in a plane frame (Workplane UV).
 * Positive `distance` expands outward; negative shrinks.
 */
export function offsetProfileInPlane(
  profile: SketchProfile,
  frame: SketchPlaneFrame,
  distance: number,
  tol = SNAP_TOLERANCE,
): SketchProfile | null {
  if (!profile.closed) return null;
  if (!(Math.abs(distance) > tol)) return null;
  const verts = profileVertices(profile);
  const n = verts.length;
  if (n < 3) return null;

  const uv = verts.map((p) => worldToFrameUV(frame, p));
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = uv[i]!;
    const b = uv[(i + 1) % n]!;
    area2 += a.u * b.v - b.u * a.v;
  }
  // CCW (area2 > 0): outward = rotate edge 90° CW = (dy, -dx)
  const outwardSign = area2 >= 0 ? 1 : -1;

  type Uv = { u: number; v: number };
  const offs: { p: Uv; d: Uv }[] = [];
  for (let i = 0; i < n; i++) {
    const a = uv[i]!;
    const b = uv[(i + 1) % n]!;
    const dx = b.u - a.u;
    const dy = b.v - a.v;
    const len = Math.hypot(dx, dy);
    if (len < tol) return null;
    const ou = (outwardSign * dy) / len;
    const ov = (outwardSign * -dx) / len;
    offs.push({
      p: { u: a.u + ou * distance, v: a.v + ov * distance },
      d: { u: dx, v: dy },
    });
  }

  const nextUv: Uv[] = [];
  for (let i = 0; i < n; i++) {
    const prev = offs[(i - 1 + n) % n]!;
    const cur = offs[i]!;
    const hit = intersectUvLines(prev.p, prev.d, cur.p, cur.d);
    if (!hit) return null;
    nextUv.push(hit);
  }

  const next = nextUv.map((p) => frameUVToWorld(frame, p.u, p.v));
  return withMeta(profile, next);
}

/**
 * Simple XY offset for axis-aligned rectangles (constant Z) only.
 * Positive `distance` expands the bbox; negative shrinks.
 * Other shapes / non-planar / non-AA → null.
 * `normalHint` reserved for a future plane offset (unused in v1).
 */
export function offsetProfile(
  profile: SketchProfile,
  distance: number,
  _normalHint?: SketchPoint,
): SketchProfile | null {
  void _normalHint;
  if (!profile.closed) return null;
  const verts = profileVertices(profile);
  if (verts.length !== 4) return null;

  const z0 = verts[0]!.z;
  for (const v of verts) {
    if (Math.abs(v.z - z0) > SNAP_TOLERANCE) return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of verts) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }

  // Each edge must be axis-aligned in XY.
  for (let i = 0; i < 4; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % 4]!;
    const ax = Math.abs(a.x - b.x) <= SNAP_TOLERANCE;
    const ay = Math.abs(a.y - b.y) <= SNAP_TOLERANCE;
    if (ax === ay) return null; // both or neither → diagonal / degenerate
  }

  const newMinX = minX - distance;
  const newMaxX = maxX + distance;
  const newMinY = minY - distance;
  const newMaxY = maxY + distance;
  if (newMaxX - newMinX < SNAP_TOLERANCE || newMaxY - newMinY < SNAP_TOLERANCE) {
    return null;
  }

  const mapCorner = (v: SketchPoint): SketchPoint | null => {
    const atMinX = Math.abs(v.x - minX) <= SNAP_TOLERANCE;
    const atMaxX = Math.abs(v.x - maxX) <= SNAP_TOLERANCE;
    const atMinY = Math.abs(v.y - minY) <= SNAP_TOLERANCE;
    const atMaxY = Math.abs(v.y - maxY) <= SNAP_TOLERANCE;
    if (!(atMinX || atMaxX) || !(atMinY || atMaxY)) return null;
    return {
      x: atMinX ? newMinX : newMaxX,
      y: atMinY ? newMinY : newMaxY,
      z: z0,
    };
  };

  const next: SketchPoint[] = [];
  for (const v of verts) {
    const m = mapCorner(v);
    if (!m) return null;
    next.push(m);
  }
  return withMeta(profile, next);
}

/**
 * Remove vertex; merge adjacent edges.
 * Closed loops must keep at least 3 vertices.
 */
export function deleteProfileVertex(
  profile: SketchProfile,
  vertexIndex: number,
): SketchProfile | null {
  const verts = profileVertices(profile);
  if (vertexIndex < 0 || vertexIndex >= verts.length) return null;
  if (profile.closed && verts.length <= 3) return null;
  if (!profile.closed && verts.length <= 2) return null;

  const next = [
    ...verts.slice(0, vertexIndex),
    ...verts.slice(vertexIndex + 1),
  ];
  if (profile.closed && next.length < 3) return null;
  return withMeta(profile, next, profile.closed && next.length >= 3);
}

/**
 * Clear provisional edges for Redibujar; keep `sourceWallIds` / semantic.
 */
export function clearProfileEdges(profile: SketchProfile): SketchProfile {
  return {
    sourceWallIds: [...profile.sourceWallIds],
    edges: [],
    closed: false,
    semantic: profile.semantic,
  };
}
