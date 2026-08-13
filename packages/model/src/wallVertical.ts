/**
 * Wall vertical profile — local U/V frame, loop helpers, validation (ADR 0018).
 * Bloque 2: pure domain; no React / Three / DOM.
 */
import {
  EPS_AREA,
  EPS_LENGTH,
  MIN_HEIGHT,
  MIN_WALL_LENGTH,
  SNAP_TOLERANCE,
  almostEqual,
  type IssueLocation,
  type Vec3,
} from "@axonbim/shared";
import {
  OPENING_END_MARGIN,
  OPENING_VERTICAL_MARGIN,
  type HostedOpeningSpec,
} from "./openingFit.js";
import type { Wall, WallProfilePoint, WallVerticalDefinition } from "./types.js";
import type { ValidationResult } from "./validate.js";

export type WallAxisFrame = {
  length: number;
  baseZ: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
};

function issue(
  code: string,
  message: string,
  where?: IssueLocation,
): NonNullable<ValidationResult> {
  return where ? { code, message, where } : { code, message };
}

/** Plan length of the wall axis (XY). */
export function wallLength(wall: Pick<Wall, "p1" | "p2">): number {
  return Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
}

/** Local frame: U along p1→p2, V = +Z, N = horizontal normal (right of U). */
export function wallAxisFrame(wall: Pick<Wall, "p1" | "p2">): WallAxisFrame | null {
  const length = wallLength(wall);
  if (length < MIN_WALL_LENGTH) return null;
  const ux = (wall.p2.x - wall.p1.x) / length;
  const uy = (wall.p2.y - wall.p1.y) / length;
  return {
    length,
    baseZ: Math.min(wall.p1.z, wall.p2.z),
    ux,
    uy,
    nx: -uy,
    ny: ux,
  };
}

/** Legacy `height` → discriminated vertical (migration helper for Bloque 7). */
export function wallVerticalFromHeight(height: number): WallVerticalDefinition {
  return { kind: "uniform", height };
}

/** Vertical definition of a wall entity. */
export function wallVerticalOf(wall: Pick<Wall, "vertical">): WallVerticalDefinition {
  return wall.vertical;
}

/** Maximum height (m) of a vertical definition. */
export function wallMaxHeight(vertical: WallVerticalDefinition): number {
  if (vertical.kind === "uniform") return vertical.height;
  let max = 0;
  for (const p of vertical.outerLoop) {
    if (Number.isFinite(p.v) && p.v > max) max = p.v;
  }
  return max;
}

/** Convenience: max height from a wall. */
export function wallMaxHeightOf(wall: Pick<Wall, "vertical">): number {
  return wallMaxHeight(wall.vertical);
}

/** Deep clone of a vertical definition (for command snapshots). */
export function cloneWallVertical(vertical: WallVerticalDefinition): WallVerticalDefinition {
  if (vertical.kind === "uniform") {
    return { kind: "uniform", height: vertical.height };
  }
  return {
    kind: "profile",
    outerLoop: vertical.outerLoop.map((p) => ({ u: p.u, v: p.v })),
  };
}

/** Geometric equivalence within tolerance (noop detection). */
export function wallVerticalEquals(
  a: WallVerticalDefinition,
  b: WallVerticalDefinition,
  eps = EPS_LENGTH,
): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "uniform" && b.kind === "uniform") {
    return almostEqual(a.height, b.height, eps);
  }
  if (a.kind === "profile" && b.kind === "profile") {
    if (a.outerLoop.length !== b.outerLoop.length) return false;
    for (let i = 0; i < a.outerLoop.length; i++) {
      const p = a.outerLoop[i]!;
      const q = b.outerLoop[i]!;
      if (!almostEqual(p.u, q.u, eps) || !almostEqual(p.v, q.v, eps)) return false;
    }
    return true;
  }
  return false;
}

/** Implicit rectangle when `kind === "uniform"`. Profile loops are returned as-is. */
export function wallVerticalLoop(
  vertical: WallVerticalDefinition,
  length: number,
): WallProfilePoint[] {
  if (vertical.kind === "uniform") {
    const h = vertical.height;
    return [
      { u: 0, v: 0 },
      { u: length, v: 0 },
      { u: length, v: h },
      { u: 0, v: h },
    ];
  }
  return vertical.outerLoop.map((p) => ({ u: p.u, v: p.v }));
}

export function wallLocalToWorld(
  wall: Pick<Wall, "p1" | "p2">,
  local: { u: number; v: number; n?: number },
): Vec3 | null {
  const frame = wallAxisFrame(wall);
  if (!frame) return null;
  const n = local.n ?? 0;
  return {
    x: wall.p1.x + local.u * frame.ux + n * frame.nx,
    y: wall.p1.y + local.u * frame.uy + n * frame.ny,
    z: frame.baseZ + local.v,
  };
}

export function worldToWallProfileUV(
  wall: Pick<Wall, "p1" | "p2">,
  point: Vec3,
): WallProfilePoint | null {
  const frame = wallAxisFrame(wall);
  if (!frame) return null;
  const dx = point.x - wall.p1.x;
  const dy = point.y - wall.p1.y;
  return {
    u: dx * frame.ux + dy * frame.uy,
    v: point.z - frame.baseZ,
  };
}

/** Opening rectangle corners in wall U/V (closed for containment checks). */
export function openingRectangleUV(opening: HostedOpeningSpec): WallProfilePoint[] {
  const half = opening.width / 2;
  const u0 = opening.centerOffset - half;
  const u1 = opening.centerOffset + half;
  const v0 = opening.sill;
  const v1 = opening.sill + opening.height;
  return [
    { u: u0, v: v0 },
    { u: u1, v: v0 },
    { u: u1, v: v1 },
    { u: u0, v: v1 },
  ];
}

function ringArea(points: readonly WallProfilePoint[]): number {
  let a = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % n]!;
    a += p.u * q.v - q.u * p.v;
  }
  return 0.5 * a;
}

/** Ray-cast inclusion; boundary counts as inside within EPS_LENGTH. */
export function pointInWallProfile(
  point: WallProfilePoint,
  loop: readonly WallProfilePoint[],
  eps = EPS_LENGTH,
): boolean {
  if (loop.length < 3) return false;
  // On-boundary → inside
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    if (pointOnSegment(point, a, b, eps)) return true;
  }
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const pi = loop[i]!;
    const pj = loop[j]!;
    const intersect =
      pi.v > point.v !== pj.v > point.v &&
      point.u <
        ((pj.u - pi.u) * (point.v - pi.v)) / (pj.v - pi.v + Number.EPSILON) + pi.u;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointOnSegment(
  p: WallProfilePoint,
  a: WallProfilePoint,
  b: WallProfilePoint,
  eps: number,
): boolean {
  const cross = (p.u - a.u) * (b.v - a.v) - (p.v - a.v) * (b.u - a.u);
  if (Math.abs(cross) > eps) return false;
  const dot = (p.u - a.u) * (b.u - a.u) + (p.v - a.v) * (b.v - a.v);
  if (dot < -eps) return false;
  const len2 = (b.u - a.u) ** 2 + (b.v - a.v) ** 2;
  if (dot - len2 > eps) return false;
  return true;
}

function segmentsIntersect(
  a: WallProfilePoint,
  b: WallProfilePoint,
  c: WallProfilePoint,
  d: WallProfilePoint,
  eps = EPS_LENGTH,
): boolean {
  const orient = (
    p: WallProfilePoint,
    q: WallProfilePoint,
    r: WallProfilePoint,
  ) => (q.u - p.u) * (r.v - p.v) - (q.v - p.v) * (r.u - p.u);

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  if (
    ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) &&
    ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))
  ) {
    return true;
  }
  // Collinear overlaps count as self-intersection for validation.
  if (Math.abs(o1) <= eps && pointOnSegment(c, a, b, eps)) return true;
  if (Math.abs(o2) <= eps && pointOnSegment(d, a, b, eps)) return true;
  if (Math.abs(o3) <= eps && pointOnSegment(a, c, d, eps)) return true;
  if (Math.abs(o4) <= eps && pointOnSegment(b, c, d, eps)) return true;
  return false;
}

function profileHasSelfIntersection(loop: readonly WallProfilePoint[]): boolean {
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges and the closing pair that shares a vertex.
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === n - 1) continue;
      const c = loop[j]!;
      const d = loop[(j + 1) % n]!;
      // Also skip if they share a vertex (non-adjacent should not).
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/**
 * Validate a closed outer loop for a wall of given axis length.
 * Does not silently repair invalid geometry.
 */
export function validateWallProfile(
  loop: readonly WallProfilePoint[],
  wallLen: number,
): ValidationResult {
  if (loop.length < 3) {
    return issue("profile.vertexCount", "profile needs at least 3 vertices");
  }
  if (!(wallLen >= MIN_WALL_LENGTH)) {
    return issue("profile.wallLength", `wall length must be at least ${MIN_WALL_LENGTH} m`);
  }

  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]!;
    if (!Number.isFinite(p.u) || !Number.isFinite(p.v)) {
      return issue("profile.nonFinite", `profile vertex ${i} is not finite`, {
        at: "vertex",
        index: i,
      });
    }
    if (p.u < -SNAP_TOLERANCE || p.u > wallLen + SNAP_TOLERANCE) {
      return issue(
        "profile.u.bounds",
        `profile vertex ${i}: u must be within [0, ${wallLen}]`,
        { at: "vertex", index: i },
      );
    }
    if (p.v < -SNAP_TOLERANCE) {
      return issue("profile.v.belowBase", `profile vertex ${i}: v below wall base`, {
        at: "vertex",
        index: i,
      });
    }
  }

  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    const len = Math.hypot(b.u - a.u, b.v - a.v);
    if (len < EPS_LENGTH) {
      return issue(
        "profile.duplicateVertex",
        `profile has duplicate consecutive vertices at ${i}`,
        { at: "vertex", index: i },
      );
    }
    if (len < MIN_WALL_LENGTH) {
      return issue(
        "profile.edge.short",
        `profile edge ${i} shorter than ${MIN_WALL_LENGTH} m`,
        { at: "edge", index: i },
      );
    }
  }

  const area = Math.abs(ringArea(loop));
  if (profileHasSelfIntersection(loop)) {
    return issue("profile.selfIntersection", "profile edges self-intersect");
  }
  if (area < EPS_AREA) {
    return issue("profile.area", "profile area is zero or below tolerance");
  }

  const reachesStart = loop.some((p) => almostEqual(p.u, 0, SNAP_TOLERANCE));
  const reachesEnd = loop.some((p) => almostEqual(p.u, wallLen, SNAP_TOLERANCE));
  if (!reachesStart || !reachesEnd) {
    return issue(
      "profile.ends",
      "profile must reach both wall ends (u=0 and u=length)",
    );
  }

  // Closed by convention (no repeated first point). Continuity already checked via edges.
  if (wallMaxHeight({ kind: "profile", outerLoop: [...loop] }) < MIN_HEIGHT) {
    return issue("profile.height.min", `profile max height must be at least ${MIN_HEIGHT} m`);
  }

  return null;
}

/** Validate a full vertical definition against a wall axis length. */
export function validateWallVerticalDefinition(
  vertical: WallVerticalDefinition,
  wallLen: number,
): ValidationResult {
  if (vertical.kind === "uniform") {
    if (!Number.isFinite(vertical.height) || vertical.height < MIN_HEIGHT) {
      return issue(
        "wall.height.min",
        `height must be at least ${MIN_HEIGHT} m`,
      );
    }
    return null;
  }
  return validateWallProfile(vertical.outerLoop, wallLen);
}

/**
 * Opening rectangle must lie inside the solid profile (all four corners).
 * Also enforces end / headroom margins on the host length and max height.
 */
export function validateOpeningInsideWallProfile(
  opening: HostedOpeningSpec,
  wall: Pick<Wall, "p1" | "p2" | "id">,
  vertical: WallVerticalDefinition,
): ValidationResult {
  if (wall.id !== opening.wallId) {
    return issue(
      "opening.wall.mismatch",
      `opening ${opening.id}: wall ${wall.id} is not host ${opening.wallId}`,
    );
  }
  const len = wallLength(wall);
  const half = opening.width / 2;
  const minCenter = half + OPENING_END_MARGIN;
  const maxCenter = len - half - OPENING_END_MARGIN;
  if (opening.centerOffset < minCenter || opening.centerOffset > maxCenter) {
    return issue(
      "opening.endMargin",
      `opening ${opening.id}: too close to wall end`,
    );
  }
  const maxH = wallMaxHeight(vertical);
  if (opening.sill + opening.height > maxH - OPENING_VERTICAL_MARGIN) {
    return issue(
      "opening.verticalFit",
      `opening ${opening.id}: sill+height exceeds wall profile height`,
    );
  }

  const loop = wallVerticalLoop(vertical, len);
  const corners = openingRectangleUV(opening);
  for (const c of corners) {
    if (!pointInWallProfile(c, loop)) {
      return issue(
        "opening.outsideProfile",
        `opening ${opening.id}: rectangle leaves the wall profile`,
      );
    }
  }
  return null;
}
