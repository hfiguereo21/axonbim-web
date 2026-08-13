/** Shared primitives — no React / Three / DOM. */

export type Vec3 = { x: number; y: number; z: number };

export const EPS_LENGTH = 1e-6;
export const EPS_AREA = 1e-9;
export const MIN_WALL_LENGTH = 0.05;
export const MIN_THICKNESS = 0.05;
export const MIN_HEIGHT = 0.05;
export const SNAP_TOLERANCE = 0.05;

export function almostEqual(a: number, b: number, eps = EPS_LENGTH): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Where a rejection happened (SK-R1).
 *
 * The validators already know the offending index; before this type it only
 * survived as text inside an English message, so the UI could describe the
 * problem but never point at it. Optional by design: a rule about the whole
 * profile (area, self-intersection) has no single location and must not invent
 * one.
 */
export type IssueLocation =
  | { at: "vertex"; index: number }
  | { at: "edge"; index: number };
