/**
 * Wall solid from a vertical U/V profile extruded ± thickness/2 (ADR 0018 Bloque 3).
 * No React / Three / DOM. No OpenCascade.
 */
import {
  wallAxisFrame,
  wallLength,
  wallLocalToWorld,
  wallMaxHeight,
  wallVerticalLoop,
  wallVerticalOf,
  type WallProfilePoint,
  type WallVerticalDefinition,
  type Wall,
} from "@axonbim/model";
import { EPS_AREA, EPS_LENGTH, MIN_WALL_LENGTH, type Vec3 } from "@axonbim/shared";
import type { MeshBuffer } from "./types.js";
import { emptyMesh, type WallMeshOptions, type WallMetrics, wallBoxMesh } from "./wallBox.js";
import { wallMeshWithOpenings, type WallOpening } from "./openings.js";

type UV = { u: number; v: number };
type V3 = { x: number; y: number; z: number };

function signedArea(pts: readonly UV[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.u * q.v - q.u * p.v;
  }
  return 0.5 * a;
}

/** Ensure CCW winding in U/V (positive area). */
export function ensureProfileCcw(pts: readonly WallProfilePoint[]): WallProfilePoint[] {
  const copy = pts.map((p) => ({ u: p.u, v: p.v }));
  if (signedArea(copy) < 0) copy.reverse();
  return copy;
}

export function profileLoopArea(pts: readonly WallProfilePoint[]): number {
  return Math.abs(signedArea(pts));
}

/** True when miters (ADR 0008) apply — only uniform verticals. */
export function wallProfileSupportsMiter(vertical: WallVerticalDefinition): boolean {
  return vertical.kind === "uniform";
}

export function wallProfileMetrics(
  wall: Wall,
  vertical: WallVerticalDefinition = wallVerticalOf(wall),
): WallMetrics {
  const length = wallLength(wall);
  const loop = ensureProfileCcw(wallVerticalLoop(vertical, length));
  const area = profileLoopArea(loop);
  const half = wall.thickness / 2;
  const frame = wallAxisFrame(wall);
  const z0 = frame?.baseZ ?? Math.min(wall.p1.z, wall.p2.z);
  const nx = frame?.nx ?? 0;
  const ny = frame?.ny ?? 1;
  const corners = [
    { x: wall.p1.x - nx * half, y: wall.p1.y - ny * half },
    { x: wall.p1.x + nx * half, y: wall.p1.y + ny * half },
    { x: wall.p2.x + nx * half, y: wall.p2.y + ny * half },
    { x: wall.p2.x - nx * half, y: wall.p2.y - ny * half },
  ];
  // Expand bbox by profile extents in U/V projected to world (conservative AABB).
  let minX = Math.min(...corners.map((c) => c.x));
  let maxX = Math.max(...corners.map((c) => c.x));
  let minY = Math.min(...corners.map((c) => c.y));
  let maxY = Math.max(...corners.map((c) => c.y));
  let minZ = z0;
  let maxZ = z0;
  for (const p of loop) {
    const w = wallLocalToWorld(wall, { u: p.u, v: p.v, n: half });
    const w2 = wallLocalToWorld(wall, { u: p.u, v: p.v, n: -half });
    for (const q of [w, w2]) {
      if (!q) continue;
      minX = Math.min(minX, q.x);
      maxX = Math.max(maxX, q.x);
      minY = Math.min(minY, q.y);
      maxY = Math.max(maxY, q.y);
      minZ = Math.min(minZ, q.z);
      maxZ = Math.max(maxZ, q.z);
    }
  }
  return {
    length,
    volume: area * wall.thickness,
    centroidXY: {
      x: (wall.p1.x + wall.p2.x) / 2,
      y: (wall.p1.y + wall.p2.y) / 2,
    },
    bbox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
  };
}

function cross2(o: UV, a: UV, b: UV): number {
  return (a.u - o.u) * (b.v - o.v) - (a.v - o.v) * (b.u - o.u);
}

function pointInTri(p: UV, a: UV, b: UV, c: UV): boolean {
  const a1 = cross2(a, b, p);
  const a2 = cross2(b, c, p);
  const a3 = cross2(c, a, p);
  const hasNeg = a1 < -EPS_LENGTH || a2 < -EPS_LENGTH || a3 < -EPS_LENGTH;
  const hasPos = a1 > EPS_LENGTH || a2 > EPS_LENGTH || a3 > EPS_LENGTH;
  return !(hasNeg && hasPos);
}

/** Ear clipping for a simple CCW polygon. Returns index triples into `pts`. */
export function triangulateProfileLoop(pts: readonly UV[]): [number, number, number][] {
  const n0 = pts.length;
  if (n0 < 3) return [];
  const idx = Array.from({ length: n0 }, (_, i) => i);
  const tris: [number, number, number][] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n0 * n0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length]!;
      const i1 = idx[i]!;
      const i2 = idx[(i + 1) % idx.length]!;
      const a = pts[i0]!;
      const b = pts[i1]!;
      const c = pts[i2]!;
      if (cross2(a, b, c) <= EPS_AREA) continue; // not a convex ear
      let anyInside = false;
      for (let j = 0; j < idx.length; j++) {
        const k = idx[j]!;
        if (k === i0 || k === i1 || k === i2) continue;
        if (pointInTri(pts[k]!, a, b, c)) {
          anyInside = true;
          break;
        }
      }
      if (anyInside) continue;
      tris.push([i0, i1, i2]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) {
    tris.push([idx[0]!, idx[1]!, idx[2]!]);
  }
  return tris.filter(([i, j, k]) => {
    const a = pts[i]!;
    const b = pts[j]!;
    const c = pts[k]!;
    return Math.abs(cross2(a, b, c)) > EPS_AREA * 2;
  });
}

function isAxisAlignedRectangle(loop: readonly UV[]): boolean {
  if (loop.length !== 4) return false;
  const us = [...new Set(loop.map((p) => Math.round(p.u * 1e6) / 1e6))];
  const vs = [...new Set(loop.map((p) => Math.round(p.v * 1e6) / 1e6))];
  if (us.length !== 2 || vs.length !== 2) return false;
  const [u0, u1] = us[0]! < us[1]! ? [us[0]!, us[1]!] : [us[1]!, us[0]!];
  const [v0, v1] = vs[0]! < vs[1]! ? [vs[0]!, vs[1]!] : [vs[1]!, vs[0]!];
  if (u1 - u0 < MIN_WALL_LENGTH || v1 - v0 < MIN_WALL_LENGTH) return false;
  return loop.every(
    (p) =>
      (almostEq(p.u, u0) || almostEq(p.u, u1)) &&
      (almostEq(p.v, v0) || almostEq(p.v, v1)),
  );
}

function almostEq(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

function openingToUvRect(o: WallOpening): { u0: number; u1: number; v0: number; v1: number } {
  return {
    u0: o.centerAlong - o.width / 2,
    u1: o.centerAlong + o.width / 2,
    v0: o.sill,
    v1: o.sill + o.height,
  };
}

/**
 * Cut a sill=0 rectangular door/notch into the bottom of a CCW outer loop.
 * Returns null if the outer contour is not a simple bottom-on-v=0 case we support.
 */
function notchBottomOpening(outer: UV[], o: WallOpening): UV[] | null {
  const { u0, u1, v0, v1 } = openingToUvRect(o);
  if (v0 > EPS_LENGTH) return null;
  const next: UV[] = [];
  let notched = false;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % outer.length]!;
    next.push(a);
    const onBottom =
      Math.abs(a.v) <= SNAP_V &&
      Math.abs(b.v) <= SNAP_V &&
      b.u > a.u + EPS_LENGTH;
    if (!onBottom) continue;
    if (u0 >= a.u - EPS_LENGTH && u1 <= b.u + EPS_LENGTH && u1 - u0 > EPS_LENGTH) {
      next.push({ u: u0, v: 0 });
      next.push({ u: u0, v: v1 });
      next.push({ u: u1, v: v1 });
      next.push({ u: u1, v: 0 });
      notched = true;
    }
  }
  if (!notched) return null;
  const out: UV[] = [];
  for (const p of next) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p.u - last.u, p.v - last.v) < EPS_LENGTH) continue;
    out.push(p);
  }
  return out.length >= 3 ? ensureProfileCcw(out) : null;
}

const SNAP_V = 1e-4;

/**
 * Build a single contour for openings: bottom-touching → notch; floating → bridge hole.
 */
function contourWithOpenings(
  outerIn: readonly UV[],
  openings: readonly WallOpening[],
): { verts: UV[]; tris: [number, number, number][] } {
  let outer = ensureProfileCcw(outerIn).map((p) => ({ u: p.u, v: p.v }));
  const floating: UV[][] = [];

  for (const o of openings) {
    const notched = notchBottomOpening(outer, o);
    if (notched) {
      outer = notched;
      continue;
    }
    const { u0, u1, v0, v1 } = openingToUvRect(o);
    floating.push([
      { u: u0, v: v0 },
      { u: u0, v: v1 },
      { u: u1, v: v1 },
      { u: u1, v: v0 },
    ]);
  }

  if (floating.length === 0) {
    return { verts: outer, tris: triangulateProfileLoop(outer) };
  }
  return triangulateOuterWithRectHoles(outer, floating);
}

function triangulateOuterWithRectHoles(
  outerIn: readonly UV[],
  holesIn: readonly UV[][],
): { verts: UV[]; tris: [number, number, number][] } {
  let outer = ensureProfileCcw(outerIn).map((p) => ({ u: p.u, v: p.v }));

  const holes = holesIn.map((h) => {
    const c = h.map((p) => ({ u: p.u, v: p.v }));
    if (signedArea(c) > 0) c.reverse();
    return c;
  });

  // Process rightmost holes first to keep bridges short.
  holes.sort(
    (a, b) =>
      Math.max(...b.map((p) => p.u)) - Math.max(...a.map((p) => p.u)),
  );

  for (const hole of holes) {
    let best = Infinity;
    let oi = 0;
    let hi = 0;
    for (let i = 0; i < outer.length; i++) {
      for (let j = 0; j < hole.length; j++) {
        const d = Math.hypot(outer[i]!.u - hole[j]!.u, outer[i]!.v - hole[j]!.v);
        if (d < best) {
          best = d;
          oi = i;
          hi = j;
        }
      }
    }

    const next: UV[] = [];
    for (let i = 0; i <= oi; i++) next.push(outer[i]!);
    for (let k = 0; k <= hole.length; k++) {
      const p = hole[(hi + k) % hole.length]!;
      next.push({ u: p.u, v: p.v });
    }
    // Return along the bridge to the outer vertex, then continue.
    next.push({ u: outer[oi]!.u, v: outer[oi]!.v });
    for (let i = oi + 1; i < outer.length; i++) next.push(outer[i]!);

    // Collapse near-duplicate consecutive vertices.
    outer = [];
    for (const p of next) {
      const last = outer[outer.length - 1];
      if (last && Math.hypot(p.u - last.u, p.v - last.v) < EPS_LENGTH) continue;
      outer.push(p);
    }
    if (outer.length >= 2) {
      const a = outer[0]!;
      const b = outer[outer.length - 1]!;
      if (Math.hypot(a.u - b.u, a.v - b.v) < EPS_LENGTH) outer.pop();
    }
  }

  if (signedArea(outer) < 0) outer.reverse();
  const tris = triangulateProfileLoop(outer);
  return { verts: outer, tris };
}

function faceNormal(a: V3, b: V3, c: V3): V3 {
  const e1x = b.x - a.x;
  const e1y = b.y - a.y;
  const e1z = b.z - a.z;
  const e2x = c.x - a.x;
  const e2y = c.y - a.y;
  const e2z = c.z - a.z;
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const L = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / L, y: ny / L, z: nz / L };
}

function pushTri(
  positions: number[],
  normals: number[],
  indices: number[],
  a: V3,
  b: V3,
  c: V3,
  n?: V3,
): void {
  const area2 =
    Math.hypot(
      (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
      (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z),
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
    );
  if (area2 < EPS_AREA) return;
  const nn = n ?? faceNormal(a, b, c);
  const base = positions.length / 3;
  for (const v of [a, b, c]) {
    positions.push(v.x, v.y, v.z);
    normals.push(nn.x, nn.y, nn.z);
  }
  indices.push(base, base + 1, base + 2);
}

function pushQuad(
  positions: number[],
  normals: number[],
  indices: number[],
  a: V3,
  b: V3,
  c: V3,
  d: V3,
): void {
  const n = faceNormal(a, b, c);
  pushTri(positions, normals, indices, a, b, c, n);
  pushTri(positions, normals, indices, a, c, d, n);
}

function toWorld(
  wall: Wall,
  uv: UV,
  n: number,
): V3 {
  const w = wallLocalToWorld(wall, { u: uv.u, v: uv.v, n });
  return w ?? { x: 0, y: 0, z: 0 };
}

export type WallProfileMeshOptions = {
  vertical?: WallVerticalDefinition;
  openings?: WallOpening[];
  /** Ignored when vertical is `profile` (fallback: square ends). */
  join?: WallMeshOptions;
};

/**
 * Solid mesh for a wall vertical definition.
 * - `uniform` + no openings + join → delegates to `wallBoxMesh` (same contract).
 * - `uniform` + openings → `wallMeshWithOpenings`.
 * - `profile` → extruded polygon (± thickness/2); openings as UV holes.
 */
export function wallProfileMesh(
  wall: Wall,
  opts?: WallProfileMeshOptions,
): MeshBuffer {
  const vertical = opts?.vertical ?? wallVerticalOf(wall);
  const openings = opts?.openings ?? [];
  const length = wallLength(wall);
  if (length < MIN_WALL_LENGTH || wall.thickness <= 0) return emptyMesh();

  if (vertical.kind === "uniform") {
    if (openings.length === 0) {
      return wallBoxMesh(wall, opts?.join);
    }
    return wallMeshWithOpenings(wall, openings, opts?.join);
  }

  // Custom profile: never apply box miters (ADR 0018 join fallback).
  const outer = ensureProfileCcw(wallVerticalLoop(vertical, length));
  if (outer.length < 3 || profileLoopArea(outer) < EPS_AREA) return emptyMesh();

  const half = wall.thickness / 2;
  const cleanedOpenings = openings
    .map((o) => ({
      ...o,
      width: Math.min(o.width, length - MIN_WALL_LENGTH),
      height: Math.min(o.height, wallMaxHeight(vertical) - o.sill),
    }))
    .filter((o) => o.width >= MIN_WALL_LENGTH && o.height > 0);

  // Rectangular profile + openings → proven slab union (same solid as uniform box).
  if (cleanedOpenings.length > 0 && isAxisAlignedRectangle(outer)) {
    const vs = outer.map((p) => p.v);
    const v0 = Math.min(...vs);
    const v1 = Math.max(...vs);
    const proxy: Wall = {
      ...wall,
      p1: { ...wall.p1, z: Math.min(wall.p1.z, wall.p2.z) + v0 },
      p2: { ...wall.p2, z: Math.min(wall.p1.z, wall.p2.z) + v0 },
      vertical: { kind: "uniform", height: v1 - v0 },
    };
    const shifted = cleanedOpenings.map((o) => ({
      ...o,
      sill: o.sill - v0,
    }));
    return wallMeshWithOpenings(proxy, shifted);
  }

  const { verts, tris } =
    cleanedOpenings.length === 0
      ? { verts: outer, tris: triangulateProfileLoop(outer) }
      : contourWithOpenings(outer, cleanedOpenings);

  if (tris.length === 0) return emptyMesh();

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const front = verts.map((p) => toWorld(wall, p, half));
  const back = verts.map((p) => toWorld(wall, p, -half));

  // Front (+N): CCW tris as-is
  for (const [i, j, k] of tris) {
    pushTri(positions, normals, indices, front[i]!, front[j]!, front[k]!);
  }
  // Back (−N): reverse winding
  for (const [i, j, k] of tris) {
    pushTri(positions, normals, indices, back[i]!, back[k]!, back[j]!);
  }

  // Side walls along bridged contour edges
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;
    const a = verts[i]!;
    const b = verts[j]!;
    if (Math.hypot(b.u - a.u, b.v - a.v) < EPS_LENGTH) continue;
    pushQuad(
      positions,
      normals,
      indices,
      front[i]!,
      front[j]!,
      back[j]!,
      back[i]!,
    );
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

/** Mesh bbox from positions. */
export function meshBufferBBox(mesh: MeshBuffer): { min: Vec3; max: Vec3 } | null {
  if (mesh.positions.length < 3) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i]!;
    const y = mesh.positions[i + 1]!;
    const z = mesh.positions[i + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}
