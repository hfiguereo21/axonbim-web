/**
 * Domain invariants (ADR 0017) — pure predicates, no React / Three / DOM.
 *
 * Single source for rules shared by three consumers:
 * commands (garantizar), persistence (validar entrada externa), UI (explicar).
 *
 * `code` is the stable machine identity of a rule; `message` is technical
 * English for logs and `.axon` errors. User-facing copy maps from `code`.
 *
 * Hosted-opening fit/overlap: see `openingFit.ts` (F9-E2).
 */
import { type IssueLocation, MIN_THICKNESS, MIN_WALL_LENGTH } from "@axonbim/shared";
import type { AxonDocument, Camera, Door, ViewCrop, Wall, Window } from "./types.js";
import { validateWallVerticalDefinition } from "./wallVertical.js";

export type ValidationIssue = {
  code: string;
  message: string;
  /** Optional offending vertex/edge, so the UI can point at it (SK-R1). */
  where?: IssueLocation;
};

/** `null` means valid. */
export type ValidationResult = ValidationIssue | null;

export const MIN_CAMERA_FOV = 10;
export const MAX_CAMERA_FOV = 120;
export const MIN_CAMERA_EYE_TARGET_DISTANCE = 0.05;

/** Reference sets an entity is validated against. */
export type DocumentRefs = {
  storeyIds: ReadonlySet<string>;
  wallFamilyIds: ReadonlySet<string>;
  doorFamilyIds: ReadonlySet<string>;
  windowFamilyIds: ReadonlySet<string>;
  wallIds: ReadonlySet<string>;
};

/**
 * Builds the reference sets in O(n). Commands call this per execution, which is
 * fine at MVP scale; if it ever shows up in a profile, cache it on the document
 * rather than dropping the check.
 */
export function documentRefs(doc: AxonDocument): DocumentRefs {
  return {
    storeyIds: new Set(doc.storeys.map((s) => s.id)),
    wallFamilyIds: new Set(doc.families.map((f) => f.id)),
    doorFamilyIds: new Set(doc.doorFamilies.map((f) => f.id)),
    windowFamilyIds: new Set(doc.windowFamilies.map((f) => f.id)),
    wallIds: new Set(doc.walls.map((w) => w.id)),
  };
}

const HINGES: ReadonlySet<string> = new Set(["start", "end"]);
const SWINGS: ReadonlySet<string> = new Set(["positive", "negative"]);
const LEAF_STATES: ReadonlySet<string> = new Set(["closed", "ajar", "open"]);

function issue(code: string, message: string): ValidationIssue {
  return { code, message };
}

// Entities can arrive from JSON, so runtime shape is not guaranteed by types.
function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function vec3Issue(v: unknown, code: string, label: string): ValidationResult {
  if (!v || typeof v !== "object") return issue(code, `${label} must be an object`);
  const o = v as Record<string, unknown>;
  if (!isFiniteNum(o.x) || !isFiniteNum(o.y) || !isFiniteNum(o.z)) {
    return issue(code, `${label} must have finite x,y,z`);
  }
  return null;
}

export function validateWall(wall: Wall, refs: DocumentRefs): ValidationResult {
  if (!isNonEmptyString(wall?.id)) return issue("wall.id.invalid", "wall.id required");
  const at = `wall ${wall.id}`;
  if (!refs.storeyIds.has(wall.storeyId)) {
    return issue("wall.storey.unknown", `${at}: unknown storeyId`);
  }
  if (!refs.wallFamilyIds.has(wall.familyId)) {
    return issue("wall.family.unknown", `${at}: unknown familyId`);
  }
  const p1 = vec3Issue(wall.p1, "wall.point.invalid", `${at}.p1`);
  if (p1) return p1;
  const p2 = vec3Issue(wall.p2, "wall.point.invalid", `${at}.p2`);
  if (p2) return p2;
  if (!isFiniteNum(wall.thickness) || wall.thickness < MIN_THICKNESS) {
    return issue("wall.thickness.min", `${at}: thickness must be at least ${MIN_THICKNESS} m`);
  }
  const length = Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
  if (length < MIN_WALL_LENGTH) {
    return issue("wall.length.min", `${at}: axis shorter than ${MIN_WALL_LENGTH} m`);
  }
  const verticalIssue = validateWallVerticalDefinition(wall.vertical, length);
  if (verticalIssue) {
    return issue(verticalIssue.code, `${at}: ${verticalIssue.message}`);
  }
  return null;
}

const OPENING_CODES = {
  door: {
    idInvalid: "door.id.invalid",
    wallUnknown: "door.wall.unknown",
    familyUnknown: "door.family.unknown",
  },
  window: {
    idInvalid: "window.id.invalid",
    wallUnknown: "window.wall.unknown",
    familyUnknown: "window.family.unknown",
  },
} as const;

function validateOpening(
  opening: Door | Window,
  kind: "door" | "window",
  wallIds: ReadonlySet<string>,
  familyIds: ReadonlySet<string>,
): ValidationResult {
  // Literal codes, never composed: a code built as `${kind}.family.unknown` is
  // invisible to grep and to the SK-R1 guard, so the rejection surface stops
  // being enumerable — by a script or by a person.
  const codes = OPENING_CODES[kind];
  if (!isNonEmptyString(opening?.id)) {
    return issue(codes.idInvalid, `${kind}.id required`);
  }
  const at = `${kind} ${opening.id}`;
  if (!wallIds.has(opening.wallId)) {
    return issue(codes.wallUnknown, `${at}: unknown wallId`);
  }
  if (!familyIds.has(opening.familyId)) {
    return issue(codes.familyUnknown, `${at}: unknown familyId`);
  }
  if (!isFiniteNum(opening.width) || opening.width <= 0) {
    return issue(`${kind}.width.invalid`, `${at}: width must be greater than 0`);
  }
  if (!isFiniteNum(opening.height) || opening.height <= 0) {
    return issue(`${kind}.height.invalid`, `${at}: height must be greater than 0`);
  }
  if (!isFiniteNum(opening.centerOffset) || opening.centerOffset < 0) {
    return issue(`${kind}.offset.invalid`, `${at}: centerOffset must be 0 or greater`);
  }
  if (!isFiniteNum(opening.sill) || opening.sill < 0) {
    return issue(`${kind}.sill.invalid`, `${at}: sill must be 0 or greater`);
  }
  if (!HINGES.has(opening.hinge)) {
    return issue(`${kind}.hinge.invalid`, `${at}: hinge must be "start" or "end"`);
  }
  if (!SWINGS.has(opening.swing)) {
    return issue(`${kind}.swing.invalid`, `${at}: swing must be "positive" or "negative"`);
  }
  if (!LEAF_STATES.has(opening.leafState)) {
    return issue(`${kind}.leafState.invalid`, `${at}: leafState must be closed/ajar/open`);
  }
  return null;
}

export function validateDoor(door: Door, refs: DocumentRefs): ValidationResult {
  return validateOpening(door, "door", refs.wallIds, refs.doorFamilyIds);
}

export function validateWindow(win: Window, refs: DocumentRefs): ValidationResult {
  return validateOpening(win, "window", refs.wallIds, refs.windowFamilyIds);
}

export function validateViewCrop(crop: ViewCrop, label: string): ValidationResult {
  if (!crop || typeof crop !== "object") {
    return issue("crop.invalid", `${label}: crop must be an object`);
  }
  if (typeof crop.enabled !== "boolean") {
    return issue("crop.enabled.invalid", `${label}: enabled required`);
  }
  if (
    !isFiniteNum(crop.minX) ||
    !isFiniteNum(crop.minY) ||
    !isFiniteNum(crop.maxX) ||
    !isFiniteNum(crop.maxY)
  ) {
    return issue("crop.bounds.invalid", `${label}: bounds must be finite`);
  }
  if (crop.maxX <= crop.minX || crop.maxY <= crop.minY) {
    return issue("crop.bounds.inverted", `${label}: max must be greater than min`);
  }
  if (crop.minZ !== undefined && !isFiniteNum(crop.minZ)) {
    return issue("crop.z.invalid", `${label}: invalid minZ`);
  }
  if (crop.maxZ !== undefined && !isFiniteNum(crop.maxZ)) {
    return issue("crop.z.invalid", `${label}: invalid maxZ`);
  }
  if (crop.minZ !== undefined && crop.maxZ !== undefined && crop.maxZ <= crop.minZ) {
    return issue("crop.z.inverted", `${label}: maxZ must be greater than minZ`);
  }
  return null;
}

export function validateCamera(camera: Camera): ValidationResult {
  if (!isNonEmptyString(camera?.id)) return issue("camera.id.invalid", "camera.id required");
  const at = `camera ${camera.id}`;
  if (!isNonEmptyString(camera.name)) {
    return issue("camera.name.required", `${at}: name required`);
  }
  const eye = vec3Issue(camera.eye, "camera.eye.invalid", `${at}.eye`);
  if (eye) return eye;
  const target = vec3Issue(camera.target, "camera.target.invalid", `${at}.target`);
  if (target) return target;
  if (!isFiniteNum(camera.fov) || camera.fov < MIN_CAMERA_FOV || camera.fov > MAX_CAMERA_FOV) {
    return issue("camera.fov.range", `${at}: fov must be ${MIN_CAMERA_FOV}–${MAX_CAMERA_FOV}`);
  }
  const distance = Math.hypot(
    camera.target.x - camera.eye.x,
    camera.target.y - camera.eye.y,
    camera.target.z - camera.eye.z,
  );
  if (distance < MIN_CAMERA_EYE_TARGET_DISTANCE) {
    return issue("camera.eyeTarget.tooClose", `${at}: eye and target too close`);
  }
  if (!camera.crop || typeof camera.crop !== "object") {
    return issue("camera.crop.required", `${at}: crop required`);
  }
  return validateViewCrop(camera.crop, `${at}.crop`);
}
