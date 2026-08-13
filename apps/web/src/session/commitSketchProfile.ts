/**
 * SK-profile / SK-wall-profile-v1 — provisional profile → commands.
 * Surface/line single-host `result`: in-place `SetWallVerticalProfileCommand` (ADR 0018).
 * Storey / multi-host / axes: delete+create replace (SK-profile-one).
 */
import {
  CompositeCommand,
  CreateWallCommand,
  DeleteWallCommand,
  SetWallVerticalProfileCommand,
  createWallId,
  type Command,
} from "@axonbim/commands";
import {
  insetRingToAxes,
  invertStoreyFootprint,
  isWallBoxFootprint,
  validateSketchProfileForHost,
} from "@axonbim/geometry";
import {
  openingsOnWall,
  pointOnWorkplaneXY,
  resolveSpatialReference,
  cloneWallVertical,
  wallVerticalEquals,
  type Wall,
  type Workplane,
} from "@axonbim/model";
import { MIN_THICKNESS, MIN_WALL_LENGTH } from "@axonbim/shared";
import { profileToAxes, profileToPoints, type SketchProfile } from "@axonbim/tools";
import { patchViewsAfterDocumentChange } from "./cameraViews.js";
import { applyCommandToSession, rejectionStatus } from "./documentMutation.js";
import type { SessionState } from "./sliceTypes.js";
import { worldRingToWallVertical } from "./worldRingToWallVertical.js";

type Get = () => SessionState;
type Set = (partial: Partial<SessionState>) => void;

const GEOM_EPS = 1e-6;

function pushCommand(
  get: Get,
  set: Set,
  cmd: Command,
  status: string,
): "applied" | "noop" | "rejected" {
  const { document, history, documentRev } = get();
  const outcome = applyCommandToSession(
    { document, history, documentRev },
    cmd,
    status,
  );
  if (!outcome.mutated) {
    set(outcome.patch);
    return outcome.rejected ? "rejected" : "noop";
  }
  const { views, activeViewId } = patchViewsAfterDocumentChange(
    get().views,
    get().activeViewId,
    outcome.patch.document.cameras,
  );
  set({ ...outcome.patch, views, activeViewId });
  return "applied";
}

export type CommitSketchProfileResult = {
  ok: boolean;
  /** False when geometry matches sources — caller must keep the sketch profile. */
  mutated: boolean;
  wallId: string | null;
};

function ringFromProfile(profile: SketchProfile) {
  const pts = profileToPoints(profile);
  if (profile.closed && pts.length >= 2) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    if (
      Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z) < 1e-9
    ) {
      pts.pop();
    }
  }
  return pts;
}

function commitFail(wallId: string | null = null): CommitSketchProfileResult {
  return { ok: false, mutated: false, wallId };
}

function commitOk(
  mutated: boolean,
  wallId: string | null,
): CommitSketchProfileResult {
  return { ok: true, mutated, wallId };
}

function near2(
  a: { x: number; y: number },
  b: { x: number; y: number },
  eps = GEOM_EPS,
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= eps;
}

/** True if proposed walls match sources (same count, endpoints, thickness, height). */
function proposedMatchesSources(
  sources: Wall[],
  proposed: Wall[],
): boolean {
  if (sources.length !== proposed.length) return false;
  const used = new Set<number>();
  for (const p of proposed) {
    let found = -1;
    for (let i = 0; i < sources.length; i++) {
      if (used.has(i)) continue;
      const s = sources[i]!;
      const sameEnds =
        (near2(p.p1, s.p1) && near2(p.p2, s.p2)) ||
        (near2(p.p1, s.p2) && near2(p.p2, s.p1));
      if (
        sameEnds &&
        Math.abs(p.thickness - s.thickness) <= GEOM_EPS &&
        wallVerticalEquals(p.vertical, s.vertical, GEOM_EPS) &&
        p.storeyId === s.storeyId &&
        p.familyId === s.familyId
      ) {
        found = i;
        break;
      }
    }
    if (found < 0) return false;
    used.add(found);
  }
  return true;
}

function wallFromAxis(
  axis: { p1: { x: number; y: number }; p2: { x: number; y: number } },
  template: Wall,
  storeyWp: Workplane,
): Wall {
  return {
    id: createWallId(),
    storeyId: template.storeyId,
    familyId: template.familyId,
    p1: pointOnWorkplaneXY(storeyWp, axis.p1.x, axis.p1.y),
    p2: pointOnWorkplaneXY(storeyWp, axis.p2.x, axis.p2.y),
    vertical: cloneWallVertical(template.vertical),
    thickness: template.thickness,
  };
}

function replaceSourcesWithWalls(
  get: Get,
  set: Set,
  sourceIds: string[],
  newWalls: Wall[],
  status: string,
): CommitSketchProfileResult {
  if (newWalls.length === 0) {
    set({ status: "Perfil vacío o segmentos demasiado cortos" });
    return commitFail();
  }
  const sources = sourceIds
    .map((id) => get().document.walls.find((w) => w.id === id))
    .filter((w): w is Wall => Boolean(w));
  if (proposedMatchesSources(sources, newWalls)) {
    return commitOk(false, sourceIds[0] ?? null);
  }
  for (const id of sourceIds) {
    if (
      openingsOnWall(id, get().document.doors, get().document.windows).length >
      0
    ) {
      set({
        status:
          "No se puede reemplazar: hay puertas/ventanas en muros del perfil",
      });
      return commitFail();
    }
  }
  const result = pushCommand(
    get,
    set,
    new CompositeCommand("sketch.profile.replace", [
      ...sourceIds.map((id) => new DeleteWallCommand(id)),
      ...newWalls.map((wall) => new CreateWallCommand(wall)),
    ]),
    status,
  );
  if (result === "rejected") return commitFail();
  return commitOk(result === "applied", newWalls[0]?.id ?? null);
}

/** Commit profile → delete hosts + create new wall(s) from provisional geometry. */
export function commitSketchProfile(get: Get, set: Set): CommitSketchProfileResult {
  const s = get();
  const profile = s.sketchProfile;
  if (!profile || !s.sketchTarget) {
    set({ status: "No hay perfil de sketch para confirmar" });
    return commitFail();
  }

  const sourceIds = profile.sourceWallIds.filter((id) =>
    s.document.walls.some((w) => w.id === id),
  );
  if (sourceIds.length === 0) {
    set({ status: "Los muros del perfil ya no están en el documento" });
    return commitFail();
  }

  const template = s.document.walls.find((w) => w.id === sourceIds[0]!);
  if (!template) return commitFail();

  const spatial = resolveSpatialReference(s.document, template.storeyId);
  const storeyWp = spatial.workplane;
  const wp = s.activeWorkplane;
  const ring = ringFromProfile(profile);
  const asResult = profile.semantic !== "axes";

  let hasOpenings = false;
  for (const id of sourceIds) {
    if (openingsOnWall(id, s.document.doors, s.document.windows).length > 0) {
      hasOpenings = true;
      break;
    }
  }

  const validated = validateSketchProfileForHost(profile, {
    workplane: wp,
    sourceCount: sourceIds.length,
    hasOpenings,
    thickness: template.thickness,
  });
  if (!validated.ok) {
    // Through `rejectionStatus`, not the raw message: this path used to bypass
    // the copy table, so every geometry rule reached the user without a remedy
    // and outside the surface the guard checks (SK-R1).
    set({ status: rejectionStatus(validated.code, validated.message) });
    return commitFail(sourceIds[0] ?? null);
  }

  // --- Single host: storey footprint still invertible → 1 new wall ---
  if (
    asResult &&
    sourceIds.length === 1 &&
    profile.edges.length === 4 &&
    profile.closed &&
    wp.kind === "storey" &&
    isWallBoxFootprint(ring)
  ) {
    const inv = invertStoreyFootprint(ring);
    if (inv && inv.thickness >= MIN_THICKNESS) {
      const thickness = Math.max(inv.thickness, MIN_THICKNESS);
      const wall: Wall = {
        id: createWallId(),
        storeyId: spatial.storeyId,
        familyId: template.familyId,
        p1: pointOnWorkplaneXY(storeyWp, inv.p1.x, inv.p1.y),
        p2: pointOnWorkplaneXY(storeyWp, inv.p2.x, inv.p2.y),
        vertical: cloneWallVertical(template.vertical),
        thickness,
      };
      return replaceSourcesWithWalls(
        get,
        set,
        sourceIds,
        [wall],
        "Perfil aplicado — huella → muro nuevo (reemplazo)",
      );
    }
    set({
      status:
        "La huella no es un muro caja convertible — ajusta a rectángulo o redibuja con Rect/ejes",
    });
    return commitFail(sourceIds[0] ?? null);
  }

  // --- Single host on face/line: persist vertical profile in place (Bloque 6A) ---
  if (
    asResult &&
    sourceIds.length === 1 &&
    profile.closed &&
    (wp.kind === "surface" || wp.kind === "line") &&
    ring.length >= 3
  ) {
    const hostId = sourceIds[0]!;
    const vertical = worldRingToWallVertical(template, ring);
    if (!vertical) {
      set({
        status:
          "Perfil vertical inválido — debe llegar a ambos extremos del muro (u=0 y u=L), sin autointersección",
      });
      return commitFail(hostId);
    }
    if (wallVerticalEquals(template.vertical, vertical)) {
      return commitOk(false, hostId);
    }
    const result = pushCommand(
      get,
      set,
      new SetWallVerticalProfileCommand(hostId, vertical),
      "Perfil vertical aplicado — mismo muro (in-place)",
    );
    if (result === "rejected") {
      return commitFail(hostId);
    }
    return commitOk(result === "applied", hostId);
  }

  // SK-profile-one: never turn a single-host result silhouette into N walls.
  if (asResult && sourceIds.length === 1) {
    set({
      status:
        "El perfil no es convertible a un único muro — usa elevación/3D o cara, o redibuja con Rect/ejes",
    });
    return commitFail(sourceIds[0] ?? null);
  }

  // --- Closed loop outer ring on storey (N edges) → inset → N new walls ---
  if (
    asResult &&
    profile.closed &&
    wp.kind === "storey" &&
    sourceIds.length >= 3 &&
    profile.edges.length >= 3
  ) {
    const axes = insetRingToAxes(ring, template.thickness);
    if (!axes || axes.length === 0) {
      set({ status: "No se pudo insetar el anillo exterior a ejes" });
      return commitFail();
    }
    const newWalls = axes.map((axis) =>
      wallFromAxis(axis, template, storeyWp),
    );
    return replaceSourcesWithWalls(
      get,
      set,
      sourceIds,
      newWalls,
      `Perfil aplicado — anillo → ${axes.length} muros nuevos`,
    );
  }

  // --- Explicit axes rebuild (Rect/arco/redibujo): each usable edge → new wall ---
  if (!asResult) {
    const axes = profileToAxes(profile).filter((a) => {
      const len = Math.hypot(a.p2.x - a.p1.x, a.p2.y - a.p1.y);
      return len >= MIN_WALL_LENGTH;
    });
    if (axes.length === 0) {
      set({ status: "Perfil vacío o segmentos demasiado cortos" });
      return commitFail();
    }

    const newWalls = axes.map((axis) => wallFromAxis(axis, template, storeyWp));
    return replaceSourcesWithWalls(
      get,
      set,
      sourceIds,
      newWalls,
      `Perfil aplicado — ${axes.length} muros nuevos (reemplazo)`,
    );
  }

  set({ status: "No se pudo materializar el perfil como un único resultado" });
  return commitFail(sourceIds[0] ?? null);
}
