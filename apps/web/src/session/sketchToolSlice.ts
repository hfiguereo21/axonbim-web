import {
  CreateCameraCommand,
  CreateDoorCommand,
  CreateWindowCommand,
  createCameraId,
  createDoorId,
  createWindowId,
} from "@axonbim/commands";
import {
  OPENING_VERTICAL_MARGIN,
  asOpeningSpec,
  defaultCameraCrop,
  findDoorFamily,
  findWallFamily,
  findWindowFamily,
  projectPointOntoWorkplane,
  reconcileActiveStoreyId,
  openingsOnWall,
  validateHostedOpening,
  wallFaceTowardPoint,
  wallMaxHeightOf,
  workplaneFromWallFace,
  type Camera,
  type Door,
  type Wall,
  type Window,
  type Workplane,
} from "@axonbim/model";
import { MIN_WALL_LENGTH } from "@axonbim/shared";
import type {
  DrawMode,
  EditingParadigm,
  RectWallAxis,
  SketchPoint,
  SketchProfile,
  SketchTarget,
  ToolId,
} from "@axonbim/tools";
import {
  appendProfileEdge,
  canEnterSketchOnKind,
  clearSnapSession,
  closerEndpoint,
  collectEndpoints,
  emptySnapSession,
  hitProfileEdge,
  hitProfileVertex,
  isCameraTool,
  isSketchTool,
  isWorkplaneTool,
  mapProfilePoints,
  moveProfileVertex,
  paradigmForDrawMode,
  profileEdgeMidpoint,
  profileFromAxes,
  profileFromClosedRing,
  profileVertices,
  restartChainAt,
  sampleArcCE,
  sampleArcSER,
  snapWallPoint,
  translateProfileEdge,
  wallAxesFromPolyline,
  wallAxesFromRectangle,
  type SnapKind,
  type SnapSession,
} from "@axonbim/tools";
import { outlineOnWorkplane, projectPointOnWall } from "@axonbim/geometry";
import { cameraViewId } from "./cameraViews.js";
import { commitSketchProfile } from "./commitSketchProfile.js";
import { commitWallAxes } from "./commitWallAxes.js";
import { rejectionStatus } from "./documentMutation.js";
import { DEFAULT_CAMERA_EYE_Z, DEFAULT_CAMERA_FOV } from "./sessionTypes.js";
import {
  CLOSED_SEED_LINE_STATUS,
  CLOSED_SEED_REBUILD_STATUS,
  isClosedResultSeed,
} from "./sketchProfilePolicy.js";
import { applyCommand } from "./sliceContracts.js";
import type { SessionSliceCreator } from "./sliceTypes.js";
import { wallProfileEditContext } from "./wallProfileViewContext.js";

export type EnterSketchOnElementOpts = {
  /** Explicit face from WallHit (preferred). */
  face?: "front" | "back";
  /** World point used with wallFaceTowardPoint when face is omitted. */
  hitPoint?: { x: number; y: number; z: number };
};

/** Resolve face Workplane for vertical profile — never storey / first-storey default. */
function resolveWallProfileWorkplane(
  wall: Wall,
  activeWp: Workplane,
  opts?: EnterSketchOnElementOpts,
): Workplane | null {
  if (opts?.face) {
    return workplaneFromWallFace(wall, opts.face);
  }
  if (opts?.hitPoint) {
    return workplaneFromWallFace(wall, wallFaceTowardPoint(wall, opts.hitPoint));
  }
  if (
    activeWp.kind === "surface" &&
    activeWp.host?.kind === "wall" &&
    activeWp.host.id === wall.id
  ) {
    return activeWp;
  }
  return null;
}

function drawModeStatus(mode: DrawMode, onSelection: boolean): string {
  const prefix = onSelection ? "Sketch · Workplane · " : "";
  switch (mode) {
    case "line":
      return onSelection
        ? "Sketch · Workplane · clic vértice del perímetro → nueva posición"
        : "Paramétrico — línea (muro)";
    case "rectangle":
      return onSelection
        ? `${prefix}Rectángulo → reemplaza el perímetro en el plano`
        : "Rectángulo: esquina 1 → esquina 2";
    case "arcSER":
      return onSelection
        ? `${prefix}Arco I-F-R → reemplaza perímetro en el plano`
        : "Arco I-F-R: inicio → fin → punto en arco";
    case "arcCE":
      return onSelection
        ? `${prefix}Arco centro → reemplaza perímetro en el plano`
        : "Arco centro: centro → inicio → fin";
    case "pickLines":
      return onSelection
        ? `${prefix}clic vértice del perímetro (mismo que línea)`
        : "Pick líneas: clic en un muro (P1 en extremo)";
    case "pickFace":
      return `${prefix}Pick cara: clic en un muro (fija nivel / Workplane)`;
    default:
      return `${prefix}Dibujo: ${mode}`;
  }
}

/** Modes that rebuild the whole profile (vs vertex edit on Workplane). */
function isProfileRebuildMode(mode: DrawMode): boolean {
  return mode === "rectangle" || mode === "arcSER" || mode === "arcCE";
}

function clearDrawGesture(): Partial<{
  drawPoints: SketchPoint[];
  wallPending: null;
  wallChainOrigin: null;
  wallHover: null;
  lastSnapKind: "none";
  snapSession: ReturnType<typeof clearSnapSession>;
}> {
  return {
    drawPoints: [],
    wallPending: null,
    wallChainOrigin: null,
    wallHover: null,
    lastSnapKind: "none",
    snapSession: clearSnapSession(),
  };
}

type GetSet = {
  get: () => {
    sketchTarget: SketchTarget | null;
    sketchProfile: SketchProfile | null;
    sketchProfileStroke: boolean;
    wallChain: boolean;
    activeWorkplane: Workplane;
  };
  set: (partial: Record<string, unknown>) => void;
};

/** Keep sketch points on the session Workplane (storey / surface / line). */
function ontoSessionWorkplane(wp: Workplane, p: SketchPoint): SketchPoint {
  return projectPointOntoWorkplane(wp, p);
}

function profileOntoSessionWorkplane(
  profile: SketchProfile,
  wp: Workplane,
): SketchProfile {
  return mapProfilePoints(profile, (p) => ontoSessionWorkplane(wp, p));
}

/** Contorno del sólido resultante en el Workplane (no el eje). */
function seedResultOutlineProfile(
  walls: Wall[],
  seedWallId: string,
  wp: Workplane,
): SketchProfile | null {
  const outline = outlineOnWorkplane(walls, seedWallId, wp);
  if (!outline || outline.points.length === 0) return null;
  return profileFromClosedRing(
    outline.points,
    outline.sourceWallIds,
    outline.closed,
  );
}

type SketchEditSession = {
  sketchProfile: SketchProfile | null;
  document: { walls: Wall[] };
  activeWorkplane: Workplane;
  snapEnabled: boolean;
  snapSession: SnapSession;
};

/** Snap + project onto active Workplane for provisional vertex edits. */
function resolveSketchEditPoint(
  s: SketchEditSession,
  raw: SketchPoint,
  forceOrtho: boolean,
  pending: SketchPoint | null,
): { point: SketchPoint; kind: SnapKind; session: SnapSession } {
  const onPlane = ontoSessionWorkplane(s.activeWorkplane, raw);
  const verts = s.sketchProfile ? profileVertices(s.sketchProfile) : [];

  // Plan snap (endpoint/ortho) is XY-based — use it only on storey planes.
  // On surface/line, keep 3D motion on the plane; snap to profile verts in 3D.
  if (s.activeWorkplane.kind !== "storey") {
    if (!s.snapEnabled) {
      return { point: onPlane, kind: "none", session: clearSnapSession() };
    }
    const tol = 0.2;
    let best = onPlane;
    let kind: SnapKind = "none";
    let bestD = tol;
    for (const ep of verts) {
      if (pending && nearSketch(ep, pending)) continue;
      const d = Math.hypot(
        onPlane.x - ep.x,
        onPlane.y - ep.y,
        onPlane.z - ep.z,
      );
      if (d <= bestD) {
        bestD = d;
        best = ontoSessionWorkplane(s.activeWorkplane, ep);
        kind = "endpoint";
      }
    }
    return { point: best, kind, session: clearSnapSession() };
  }

  const hide = new Set(s.sketchProfile?.sourceWallIds ?? []);
  const visibleWalls = s.document.walls.filter((w) => !hide.has(w.id));
  const endpoints = collectEndpoints(visibleWalls, verts);
  const snap = s.snapEnabled
    ? snapWallPoint({
        raw: onPlane,
        pending: pending
          ? ontoSessionWorkplane(s.activeWorkplane, pending)
          : null,
        chainOrigin: null,
        endpoints,
        forceOrtho,
        session: s.snapSession,
      })
    : {
        point: onPlane,
        kind: "none" as const,
        session: clearSnapSession(),
      };
  return {
    point: ontoSessionWorkplane(s.activeWorkplane, snap.point),
    kind: snap.kind,
    session: snap.session,
  };
}

function nearSketch(a: SketchPoint, b: SketchPoint, tol = 1e-6): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= tol;
}

/**
 * Move a provisional vertex independently (SK-replace: no corner constricted).
 * The host stays untouched until Terminar replaces it with new wall(s).
 */
function moveProvisionalVertex(
  s: SketchEditSession,
  vertexIndex: number,
  to: SketchPoint,
): SketchProfile | null {
  const profile = s.sketchProfile;
  if (!profile) return null;
  return moveProfileVertex(profile, vertexIndex, to);
}

/** Create walls, or edit abstract profile when sketchTarget is set. */
function applyGestureAxes(
  get: GetSet["get"],
  set: GetSet["set"],
  axes: RectWallAxis[],
  opts: {
    replace: boolean;
    closed?: boolean;
    statusCreate: string;
    statusProfile: string;
    /** When chaining lines into the profile, keep pending at this point. */
    chainTo?: SketchPoint | null;
  },
): boolean {
  const s = get();
  if (s.sketchTarget && s.sketchProfile) {
    if (axes.length === 0) {
      set({ status: "Trazo demasiado corto o inválido" });
      return false;
    }
    // SK-UX-A: do not append Línea onto a closed result seed (ADR 0018 §11).
    if (!opts.replace && isClosedResultSeed(s.sketchProfile)) {
      set({ status: CLOSED_SEED_LINE_STATUS });
      return false;
    }
    // Provisional: Rect/arco replace; Línea añade solo tras Redibujar / seed abierto.
    let next: SketchProfile;
    if (opts.replace) {
      next = profileFromAxes(
        axes,
        s.sketchProfile.sourceWallIds,
        opts.closed ?? false,
      );
    } else {
      next = s.sketchProfile;
      for (const a of axes) {
        next = appendProfileEdge(next, a.p1, a.p2, opts.closed ?? false);
      }
    }
    const wp = s.activeWorkplane;
    next = profileOntoSessionWorkplane(next, wp);
    const chaining =
      !opts.replace &&
      Boolean(opts.chainTo) &&
      s.wallChain &&
      !(opts.closed ?? false);
    if (chaining) {
      const chainTo = opts.chainTo
        ? ontoSessionWorkplane(wp, opts.chainTo)
        : null;
      set({
        sketchProfile: next,
        sketchProfileStroke: true,
        profileVertexIndex: null,
        wallPending: chainTo,
        wallHover: chainTo,
        drawPoints: [],
        lastSnapKind: "none",
        snapSession: clearSnapSession(),
        status: opts.statusProfile,
      });
    } else {
      set({
        sketchProfile: next,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        ...clearDrawGesture(),
        status: opts.statusProfile,
      });
    }
    return true;
  }
  const ok = commitWallAxes(get as never, set as never, axes, opts.statusCreate);
  // Rect/arc create: clear gesture here. Line create chains outside.
  if (ok && opts.replace) set({ ...clearDrawGesture() });
  return ok;
}

export const createSketchToolSlice: SessionSliceCreator<{
  activeTool: ToolId;
  drawMode: DrawMode;
  /** SK-v1 / SK-sel — sketch when drawMode sketch or sketchTarget set; not persisted. */
  editingParadigm: EditingParadigm;
  /** SK-sel — parametric element hosting Sketch Mode; session only. */
  sketchTarget: SketchTarget | null;
  /** SK-profile — abstract perimeter on active Workplane; session only. */
  sketchProfile: SketchProfile | null;
  /** True while a rebuild stroke (rect/arc/chain) is accumulating. */
  sketchProfileStroke: boolean;
  /** Selected profile vertex index (`profileVertices`), or null. */
  profileVertexIndex: number | null;
  /** SK-UX-B — selected edge index in walk order. */
  profileEdgeIndex: number | null;
  selectProfileEdge: (edgeIndex: number | null) => void;
  wallChain: boolean;
  activeFamilyId: string;
  wallHeight: number;
  activeDoorFamilyId: string;
  activeWindowFamilyId: string;
  wallPending: { x: number; y: number; z: number } | null;
  wallChainOrigin: { x: number; y: number; z: number } | null;
  wallHover: { x: number; y: number; z: number } | null;
  /** SK-draw — accumulated clicks for multi-step gestures (arcs). */
  drawPoints: SketchPoint[];
  lastSnapKind: import("@axonbim/tools").SnapKind;
  /** LR1 — ortho axis lock for current segment; never in AxonDocument. */
  snapSession: SnapSession;
  snapEnabled: boolean;
  setTool: (tool: ToolId) => void;
  setDrawMode: (mode: DrawMode) => void;
  setWallChain: (chained: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  splitWallChain: () => void;
  releaseWallChain: () => void;
  /** LR1-B — new chain at point; no document/history mutation. */
  restartChainAt: (point: { x: number; y: number; z: number }) => void;
  setActiveFamilyId: (id: string) => void;
  setWallHeight: (height: number) => void;
  setActiveDoorFamilyId: (id: string) => void;
  setActiveWindowFamilyId: (id: string) => void;
  placeDoorOnWall: (wallId: string, world: { x: number; y: number }) => void;
  placeWindowOnWall: (wallId: string, world: { x: number; y: number }) => void;
  setWallHover: (p: { x: number; y: number; z: number } | null, forceOrtho?: boolean) => void;
  wallClick: (p: { x: number; y: number; z: number }, forceOrtho?: boolean) => void;
  /** SK-draw pick modes — click on an existing wall. */
  wallPickClick: (wallId: string, hint?: { x: number; y: number; z: number }) => void;
  /** SK-profile — pick/move a perimeter vertex on the Workplane. */
  profileVertexClick: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  /** SK-profile — live drag of a selected vertex on the Workplane. */
  profileVertexDragTo: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  /** SK-profile — release vertex grip after drag. */
  endProfileVertexDrag: () => void;
  /** SK-UX-B — pick/place a perimeter edge (midpoint → click). */
  profileEdgeClick: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  /** SK-UX-B — live drag of a selected edge on the Workplane. */
  profileEdgeDragTo: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  /** SK-UX-B — release edge grip after drag. */
  endProfileEdgeDrag: () => void;
  cameraClick: (p: { x: number; y: number; z: number }) => void;
  cancelWallDraw: () => void;
  /** SK-sel — enter Sketch on current selection (Modify button). */
  enterSketchOnSelection: () => void;
  /** SK-sel / ADR 0018 — enter Sketch on a wall face (elevación/3D + WallHit). */
  enterSketchOnElement: (
    kind: SketchTarget["kind"],
    id: string,
    opts?: EnterSketchOnElementOpts,
  ) => void;
  /** SK-profile — apply profile then leave Sketch → Parametric. */
  finishSketchOnSelection: () => void;
  /** SK-sel — discard profile and leave Sketch → Parametric. */
  exitSketchOnSelection: () => void;
}> = (set, get) => ({
  activeTool: "none",
  drawMode: "line",
  editingParadigm: "parametric",
  sketchTarget: null,
  sketchProfile: null,
  sketchProfileStroke: false,
  profileVertexIndex: null,
  profileEdgeIndex: null,
  wallChain: true,
  activeFamilyId: "family.block-150",
  wallHeight: 2.7,
  activeDoorFamilyId: "family.door-90",
  activeWindowFamilyId: "family.window-90x120",
  wallPending: null,
  wallChainOrigin: null,
  wallHover: null,
  drawPoints: [],
  lastSnapKind: "none",
  snapSession: emptySnapSession(),
  snapEnabled: true,

  setTool: (activeTool) => {
    if (activeTool === "none") {
      set({
        activeTool,
        drawMode: "line",
        editingParadigm: "parametric",
        sketchTarget: null,
        sketchProfile: null,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        ribbonTab: "modify",
        ...clearDrawGesture(),
        status: "Herramienta: ninguna",
      });
      return;
    }
    if (activeTool === "door") {
      set({
        activeTool,
        sketchTarget: null,
        sketchProfile: null,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        editingParadigm: "parametric",
        ribbonTab: "modify",
        selectedWallId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        ...clearDrawGesture(),
        status: "Colocar puerta — clic en un muro",
      });
      return;
    }
    if (activeTool === "window") {
      set({
        activeTool,
        sketchTarget: null,
        sketchProfile: null,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        editingParadigm: "parametric",
        ribbonTab: "modify",
        selectedWallId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedCameraId: null,
        ...clearDrawGesture(),
        status: "Colocar ventana — clic en un muro",
      });
      return;
    }
    if (isCameraTool(activeTool)) {
      set({
        activeTool,
        sketchTarget: null,
        sketchProfile: null,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        editingParadigm: "parametric",
        ribbonTab: "view",
        selectedWallId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedCameraId: null,
        ...clearDrawGesture(),
        status: "Cámara — clic 1: ojo · clic 2: mira (en planta)",
      });
      return;
    }
    if (isWorkplaneTool(activeTool)) {
      set({
        activeTool,
        sketchTarget: null,
        sketchProfile: null,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        editingParadigm: "parametric",
        // Dibujar plano → Arquitectura; Seleccionar puede usarse desde ambas cintas.
        ribbonTab: activeTool === "workplaneLine" ? "architecture" : get().ribbonTab,
        workplaneLinePending: null,
        ...clearDrawGesture(),
        status:
          activeTool === "workplaneSelect"
            ? "Seleccionar plano — clic cara de muro o vacío = nivel"
            : "Dibujar plano — clic 1: inicio de la traza (vertical en XYZ)",
      });
      return;
    }
    if (isSketchTool(activeTool)) {
      set({
        activeTool,
        drawMode: "line",
        editingParadigm: "parametric",
        sketchTarget: null,
        sketchProfile: null,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        wallChain: true,
        ribbonTab: "modify",
        selectedWallId: null,
        selectedDoorId: null,
        selectedWindowId: null,
        selectedCameraId: null,
        ...clearDrawGesture(),
        status: "Colocar muro — Dibujar: línea / rectángulo / arcos / pick",
      });
      return;
    }
    set({
      activeTool,
      ribbonTab: "modify",
      ...clearDrawGesture(),
      status: `Herramienta: ${activeTool}`,
    });
  },

  setDrawMode: (drawMode) => {
    const s = get();
    const onSelection = s.sketchTarget != null;
    const rebuild =
      drawMode === "rectangle" ||
      drawMode === "arcSER" ||
      drawMode === "arcCE";
    if (onSelection && rebuild && isClosedResultSeed(s.sketchProfile)) {
      set({ status: CLOSED_SEED_REBUILD_STATUS });
      return;
    }
    const editingParadigm = onSelection ? "sketch" : paradigmForDrawMode(drawMode);
    set({
      drawMode,
      editingParadigm,
      sketchProfileStroke: false,
      profileVertexIndex: null,
      profileEdgeIndex: null,
      ...clearDrawGesture(),
      status: drawModeStatus(drawMode, onSelection),
    });
  },

  selectProfileEdge: (edgeIndex) => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile) {
      set({ status: "Activa Sketch (Editar perfil) para seleccionar una arista" });
      return;
    }
    if (edgeIndex == null) {
      set({ profileEdgeIndex: null });
      return;
    }
    const edgeCount = s.sketchProfile.closed
      ? profileVertices(s.sketchProfile).length
      : Math.max(0, profileVertices(s.sketchProfile).length - 1);
    if (edgeIndex < 0 || edgeIndex >= edgeCount) {
      set({ status: "Arista fuera de rango" });
      return;
    }
    set({
      profileEdgeIndex: edgeIndex,
      profileVertexIndex: null,
      sketchModifyMode: "vertex",
      sketchModifyPending: null,
      activeTool: "wall",
      status: `Arista ${edgeIndex + 1} seleccionada — arrastra o clic 2 para proyectar · Terminar confirma`,
    });
  },

  setWallChain: (wallChain) =>
    set({
      wallChain,
      status: wallChain
        ? "Cadena activa — cada segmento continúa desde el anterior"
        : "Cadena desactivada — un segmento por trazo",
    }),

  setSnapEnabled: (snapEnabled) =>
    set({
      snapEnabled,
      lastSnapKind: "none",
      snapSession: clearSnapSession(),
      status: snapEnabled
        ? "Snap activo — extremos / orto / cierre"
        : "Snap desactivado",
    }),

  splitWallChain: () => {
    set({
      wallChain: true,
      wallPending: null,
      wallChainOrigin: null,
      wallHover: null,
      lastSnapKind: "none",
      snapSession: clearSnapSession(),
      status: "Cadena dividida — siguiente clic inicia un nuevo tramo",
    });
  },

  releaseWallChain: () => {
    set({
      wallChain: false,
      wallPending: null,
      wallChainOrigin: null,
      wallHover: null,
      lastSnapKind: "none",
      snapSession: clearSnapSession(),
      status: "Cadena soltada — coloca segmentos sueltos",
    });
  },

  restartChainAt: (point) => {
    const s = get();
    if (s.activeTool !== "wall") return;
    const next = restartChainAt(point);
    set({
      ...next,
      status: "Cadena reiniciada — P1 fijado · clic P2 (sin historial)",
    });
  },

  setActiveFamilyId: (activeFamilyId) => {
    const fam = findWallFamily(get().document.families, activeFamilyId);
    if (!fam) {
      set({ status: "Esa familia de muro no existe en el documento" });
      return;
    }
    set({ activeFamilyId, status: `Familia: ${fam.label}` });
  },

  setWallHeight: (wallHeight) => set({ wallHeight }),

  setActiveDoorFamilyId: (activeDoorFamilyId) => {
    const fam = findDoorFamily(get().document.doorFamilies, activeDoorFamilyId);
    if (!fam) {
      set({ status: "Esa familia de puerta no existe en el documento" });
      return;
    }
    set({ activeDoorFamilyId, status: `Familia puerta: ${fam.label}` });
  },

  setActiveWindowFamilyId: (activeWindowFamilyId) => {
    const fam = findWindowFamily(get().document.windowFamilies, activeWindowFamilyId);
    if (!fam) {
      set({ status: "Esa familia de ventana no existe en el documento" });
      return;
    }
    set({ activeWindowFamilyId, status: `Familia ventana: ${fam.label}` });
  },

  placeDoorOnWall: (wallId, world) => {
    const s = get();
    const wall = s.document.walls.find((w) => w.id === wallId);
    if (!wall) {
      set({ status: "Muro no encontrado" });
      return;
    }
    const fam = findDoorFamily(s.document.doorFamilies, s.activeDoorFamilyId);
    if (!fam) {
      set({ status: "Esa familia de puerta no existe en el documento" });
      return;
    }
    const { offset } = projectPointOnWall(wall, world);
    // Tool may trim height to the wall; the command still re-validates (ADR 0017).
    const door: Door = {
      id: createDoorId(),
      wallId,
      familyId: fam.id,
      centerOffset: offset,
      width: fam.width,
      height: Math.min(fam.height, wallMaxHeightOf(wall) - OPENING_VERTICAL_MARGIN),
      sill: 0,
      hinge: "start",
      swing: "positive",
      leafState: "open",
    };
    const fit = validateHostedOpening(
      asOpeningSpec(door),
      wall,
      openingsOnWall(wallId, s.document.doors, s.document.windows),
    );
    if (fit) {
      set({ status: rejectionStatus(fit.code, fit.message) });
      return;
    }
    applyCommand(get, set, new CreateDoorCommand(door), `Puerta ${fam.width.toFixed(2)} m`);
    set({ selectedDoorId: door.id, selectedWallId: null, selectedWindowId: null });
  },

  placeWindowOnWall: (wallId, world) => {
    const s = get();
    const wall = s.document.walls.find((w) => w.id === wallId);
    if (!wall) {
      set({ status: "Muro no encontrado" });
      return;
    }
    const fam = findWindowFamily(s.document.windowFamilies, s.activeWindowFamilyId);
    if (!fam) {
      set({ status: "Esa familia de ventana no existe en el documento" });
      return;
    }
    const { offset } = projectPointOnWall(wall, world);
    const win: Window = {
      id: createWindowId(),
      wallId,
      familyId: fam.id,
      centerOffset: offset,
      width: fam.width,
      height: fam.height,
      sill: fam.sill,
      hinge: "start",
      swing: "positive",
      leafState: "closed",
    };
    const fit = validateHostedOpening(
      asOpeningSpec(win),
      wall,
      openingsOnWall(wallId, s.document.doors, s.document.windows),
    );
    if (fit) {
      set({ status: rejectionStatus(fit.code, fit.message) });
      return;
    }
    applyCommand(get, set, new CreateWindowCommand(win), `Ventana ${fam.width.toFixed(2)} m`);
    set({ selectedWindowId: win.id, selectedWallId: null, selectedDoorId: null });
  },

  setWallHover: (raw, forceOrtho = false) => {
    if (!raw) {
      set({ wallHover: null, lastSnapKind: "none" });
      return;
    }
    const s = get();
    // SK-UX-A: snap feedback while editing face profile / Modificar.
    if (s.sketchTarget && s.sketchProfile) {
      const pending =
        s.sketchModifyPending ??
        (s.profileVertexIndex != null
          ? profileVertices(s.sketchProfile)[s.profileVertexIndex] ?? null
          : s.wallPending);
      const resolved = resolveSketchEditPoint(
        {
          sketchProfile: s.sketchProfile,
          document: s.document,
          activeWorkplane: s.activeWorkplane,
          snapEnabled: s.snapEnabled,
          snapSession: s.snapSession,
        },
        raw,
        forceOrtho,
        pending,
      );
      set({
        wallHover: resolved.point,
        lastSnapKind: resolved.kind,
        snapSession: resolved.session,
      });
      return;
    }
    if (!s.snapEnabled) {
      set({ wallHover: raw, lastSnapKind: "none", snapSession: clearSnapSession() });
      return;
    }
    const snap = snapWallPoint({
      raw,
      pending: s.wallPending,
      chainOrigin: s.wallChainOrigin,
      endpoints: collectEndpoints(s.document.walls),
      forceOrtho,
      session: s.snapSession,
    });
    set({ wallHover: snap.point, lastSnapKind: snap.kind, snapSession: snap.session });
  },

  wallClick: (raw, forceOrtho = false) => {
    const s = get();
    const modifyLive =
      Boolean(s.sketchTarget) &&
      Boolean(s.sketchProfile) &&
      Boolean(s.sketchModifyMode) &&
      s.sketchModifyMode !== "vertex" &&
      s.sketchModifyMode !== "redraw";
    // H1: Modificar must work even if ribbon left activeTool on "select".
    if (s.activeTool !== "wall" && !modifyLive) return;

    // Bloque 6B — Modificar toolkit (snap + Workplane); not vertex default.
    if (modifyLive) {
      const resolved = resolveSketchEditPoint(
        {
          sketchProfile: s.sketchProfile,
          document: s.document,
          activeWorkplane: s.activeWorkplane,
          snapEnabled: s.snapEnabled,
          snapSession: s.snapSession,
        },
        raw,
        forceOrtho,
        s.sketchModifyPending,
      );
      get().sketchModifyClick(resolved.point, forceOrtho);
      set({ lastSnapKind: resolved.kind, snapSession: resolved.session });
      return;
    }

    // SK-provisional: grips / edges; closed seed blocks Línea append (SK-UX-A).
    if (s.sketchTarget && s.sketchProfile && !isProfileRebuildMode(s.drawMode)) {
      if (s.drawMode === "pickFace") {
        set({ status: "Clic en un muro (modo pick cara)" });
        return;
      }
      if (s.profileVertexIndex != null) {
        get().profileVertexClick(raw, forceOrtho);
        return;
      }
      // SK-UX-B: place selected edge before Línea/miss clears it.
      if (s.profileEdgeIndex != null) {
        get().profileEdgeClick(raw, forceOrtho);
        return;
      }
      const pick = ontoSessionWorkplane(s.activeWorkplane, raw);
      if (hitProfileVertex(s.sketchProfile, pick) >= 0) {
        get().profileVertexClick(raw, forceOrtho);
        return;
      }
      // SK-UX-B: select edge when missing vertex grips.
      const edgeHit = hitProfileEdge(s.sketchProfile, pick);
      if (edgeHit >= 0) {
        get().selectProfileEdge(edgeHit);
        return;
      }
      if (isClosedResultSeed(s.sketchProfile)) {
        set({
          profileEdgeIndex: null,
          status: CLOSED_SEED_LINE_STATUS,
        });
        return;
      }
      // Miss grip → line / pickLines draw into open provisional.
      if (s.drawMode !== "line" && s.drawMode !== "pickLines") {
        get().profileVertexClick(raw, forceOrtho);
        return;
      }
    }

    if (s.drawMode === "pickLines" || s.drawMode === "pickFace") {
      // Completing a pickLines segment after P1 was set from a wall.
      if (s.drawMode === "pickLines" && s.wallPending) {
        // fall through to line-style commit below via snap
      } else {
        set({ status: "Clic en un muro (modo pick)" });
        return;
      }
    }

    const profilePts = s.sketchProfile ? profileVertices(s.sketchProfile) : [];
    const snap = s.snapEnabled
      ? snapWallPoint({
          raw,
          pending: s.wallPending,
          chainOrigin:
            s.drawMode === "line" || (s.drawMode === "pickLines" && s.wallPending)
              ? s.wallChainOrigin
              : null,
          endpoints: collectEndpoints(s.document.walls, profilePts),
          forceOrtho,
          session: s.snapSession,
        })
      : {
          point: raw,
          kind: "none" as const,
          closed: false,
          session: clearSnapSession(),
        };
    // Viewport picks on activeWorkplane; re-project after snap so sketch stays on plane.
    const p = ontoSessionWorkplane(s.activeWorkplane, snap.point);

    if (s.drawMode === "rectangle") {
      if (!s.wallPending) {
        set({
          wallPending: p,
          wallHover: p,
          lastSnapKind: snap.kind,
          snapSession: clearSnapSession(),
          status: "Rectángulo — clic esquina opuesta",
        });
        return;
      }
      const axes = wallAxesFromRectangle(s.wallPending, p);
      const w = Math.abs(p.x - s.wallPending.x);
      const d = Math.abs(p.y - s.wallPending.y);
      applyGestureAxes(get, set, axes, {
        replace: true,
        closed: true,
        statusCreate: `Rectángulo ${w.toFixed(2)}×${d.toFixed(2)} m (${axes.length} muros)`,
        statusProfile: `Perfil ← rectángulo ${w.toFixed(2)}×${d.toFixed(2)} m · Terminar aplica`,
      });
      return;
    }

    if (s.drawMode === "arcSER") {
      const pts = [...s.drawPoints, p];
      if (pts.length < 3) {
        set({
          drawPoints: pts,
          wallHover: p,
          lastSnapKind: snap.kind,
          snapSession: clearSnapSession(),
          status:
            pts.length === 1
              ? "Arco I-F-R — clic fin del arco"
              : "Arco I-F-R — clic punto en el arco",
        });
        return;
      }
      const poly = sampleArcSER(pts[0]!, pts[1]!, pts[2]!);
      const axes = wallAxesFromPolyline(poly);
      if (
        !applyGestureAxes(get, set, axes, {
          replace: true,
          closed: false,
          statusCreate: `Arco I-F-R (${axes.length} segmentos)`,
          statusProfile: `Perfil ← arco I-F-R (${axes.length} segs) · Terminar aplica`,
        })
      ) {
        set({
          drawPoints: [],
          wallHover: null,
          lastSnapKind: "none",
          snapSession: clearSnapSession(),
        });
      }
      return;
    }

    if (s.drawMode === "arcCE") {
      const pts = [...s.drawPoints, p];
      if (pts.length < 3) {
        set({
          drawPoints: pts,
          wallHover: p,
          lastSnapKind: snap.kind,
          snapSession: clearSnapSession(),
          status:
            pts.length === 1
              ? "Arco centro — clic inicio (radio)"
              : "Arco centro — clic fin (ángulo)",
        });
        return;
      }
      const poly = sampleArcCE(pts[0]!, pts[1]!, pts[2]!);
      const axes = wallAxesFromPolyline(poly);
      if (
        !applyGestureAxes(get, set, axes, {
          replace: true,
          closed: false,
          statusCreate: `Arco centro (${axes.length} segmentos)`,
          statusProfile: `Perfil ← arco centro (${axes.length} segs) · Terminar aplica`,
        })
      ) {
        set({
          drawPoints: [],
          wallHover: null,
          lastSnapKind: "none",
          snapSession: clearSnapSession(),
        });
      }
      return;
    }

    // line + pickLines (after P1)
    if (!s.wallPending) {
      set({
        wallPending: p,
        wallChainOrigin: s.wallChainOrigin ?? p,
        wallHover: p,
        lastSnapKind: snap.kind,
        snapSession: clearSnapSession(),
        status:
          snap.kind === "endpoint"
            ? "P1 en extremo — clic P2 (Esc cancela)"
            : "P1 fijado — clic P2 · snap orto/extremos/cierre",
      });
      return;
    }

    const p1 = ontoSessionWorkplane(s.activeWorkplane, s.wallPending);
    const onProfile = s.sketchTarget != null;
    const len = onProfile
      ? Math.hypot(p.x - p1.x, p.y - p1.y, p.z - p1.z)
      : Math.hypot(p.x - p1.x, p.y - p1.y);
    if (len < MIN_WALL_LENGTH) {
      set({ status: "Segmento demasiado corto", lastSnapKind: snap.kind });
      return;
    }

    const snapLabel =
      snap.kind === "close"
        ? "cierre"
        : snap.kind === "endpoint"
          ? "extremo"
          : snap.kind === "ortho"
            ? "orto"
            : "libre";
    const onPlane = ontoSessionWorkplane(s.activeWorkplane, p);
    const continueChain =
      !snap.closed && s.wallChain && s.drawMode !== "pickLines";

    const ok = applyGestureAxes(get, set, [{ p1, p2: p }], {
      replace: false,
      closed: Boolean(snap.closed),
      statusCreate: `Muro ${len.toFixed(2)} m (${snapLabel})`,
      statusProfile: snap.closed
        ? "Perfil cerrado · Terminar aplica al host"
        : continueChain
          ? "Perfil · cadena — siguiente segmento · Terminar aplica"
          : "Perfil actualizado · Terminar aplica",
      chainTo: onProfile && continueChain ? onPlane : null,
    });
    if (!ok) return;

    if (!onProfile) {
      if (snap.closed || !s.wallChain || s.drawMode === "pickLines") {
        set({
          ...clearDrawGesture(),
          status: snap.closed
            ? "Espacio cerrado — clic para nuevo trazo"
            : s.drawMode === "pickLines"
              ? "Pick líneas — clic en un muro para otro P1"
              : "Segmento colocado",
        });
      } else {
        set({
          wallPending: onPlane,
          wallHover: onPlane,
          drawPoints: [],
          lastSnapKind: snap.kind,
          snapSession: clearSnapSession(),
          status: "Cadena — siguiente segmento (cierre cerca del origen)",
        });
      }
    }
  },

  profileVertexClick: (raw, forceOrtho = false) => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile) return;

    if (s.profileVertexIndex == null) {
      const pick = ontoSessionWorkplane(s.activeWorkplane, raw);
      const hit = hitProfileVertex(s.sketchProfile, pick);
      if (hit < 0) {
        const edgeHit = hitProfileEdge(s.sketchProfile, pick);
        if (edgeHit >= 0) {
          get().selectProfileEdge(edgeHit);
          return;
        }
        set({
          status: isClosedResultSeed(s.sketchProfile)
            ? "Clic un vértice o arista (snap visible) · Split / Redibujar para cambiar topología"
            : "Sketch provisional — clic un vértice o Redibujar",
        });
        return;
      }
      set({
        profileVertexIndex: hit,
        profileEdgeIndex: null,
        wallHover: pick,
        status: `Vértice ${hit + 1} seleccionado — clic/arrastra (snap) · Terminar confirma`,
      });
      return;
    }

    const from = profileVertices(s.sketchProfile)[s.profileVertexIndex] ?? null;
    const resolved = resolveSketchEditPoint(s, raw, forceOrtho, from);
    const moved = moveProvisionalVertex(
      s,
      s.profileVertexIndex,
      resolved.point,
    );
    if (!moved) {
      set({
        profileVertexIndex: null,
        profileEdgeIndex: null,
        status: "No se pudo mover el vértice",
      });
      return;
    }
    set({
      sketchProfile: moved,
      profileVertexIndex: null,
      profileEdgeIndex: null,
      wallHover: resolved.point,
      lastSnapKind: resolved.kind,
      snapSession: resolved.session,
      status: "Vértice movido · preview · Terminar confirma en el documento",
    });
  },

  profileVertexDragTo: (raw, forceOrtho = false) => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile || s.profileVertexIndex == null) return;
    const from = profileVertices(s.sketchProfile)[s.profileVertexIndex] ?? null;
    const resolved = resolveSketchEditPoint(s, raw, forceOrtho, from);
    const moved = moveProvisionalVertex(
      s,
      s.profileVertexIndex,
      resolved.point,
    );
    if (!moved) return;
    set({
      sketchProfile: moved,
      wallHover: resolved.point,
      lastSnapKind: resolved.kind,
      snapSession: resolved.session,
    });
  },

  endProfileVertexDrag: () => {
    const s = get();
    if (!s.sketchTarget) return;
    set({
      profileVertexIndex: null,
      status: "Sketch provisional actualizado · Terminar valida y aplica",
    });
  },

  profileEdgeClick: (raw, forceOrtho = false) => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile) return;

    if (s.profileEdgeIndex == null) {
      const pick = ontoSessionWorkplane(s.activeWorkplane, raw);
      const edgeHit = hitProfileEdge(s.sketchProfile, pick);
      if (edgeHit >= 0) {
        get().selectProfileEdge(edgeHit);
        return;
      }
      set({
        status: isClosedResultSeed(s.sketchProfile)
          ? "Clic un vértice o arista (snap visible) · Split / Redibujar para cambiar topología"
          : "Sketch provisional — clic un vértice/arista o Redibujar",
      });
      return;
    }

    const mid = profileEdgeMidpoint(s.sketchProfile, s.profileEdgeIndex);
    if (!mid) {
      set({ profileEdgeIndex: null, status: "Arista fuera de rango" });
      return;
    }
    const resolved = resolveSketchEditPoint(s, raw, forceOrtho, mid);
    const delta = {
      x: resolved.point.x - mid.x,
      y: resolved.point.y - mid.y,
      z: resolved.point.z - mid.z,
    };
    if (Math.hypot(delta.x, delta.y, delta.z) < 1e-9) {
      set({
        profileEdgeIndex: null,
        status: "Arista — destino igual al centro (sin cambio)",
      });
      return;
    }
    const next = translateProfileEdge(
      s.sketchProfile,
      s.profileEdgeIndex,
      delta,
    );
    if (!next) {
      set({
        profileEdgeIndex: null,
        status: "No se pudo proyectar la arista",
      });
      return;
    }
    set({
      sketchProfile: next,
      profileEdgeIndex: null,
      profileVertexIndex: null,
      wallHover: resolved.point,
      lastSnapKind: resolved.kind,
      snapSession: resolved.session,
      status: "Arista proyectada · preview · Terminar confirma en el documento",
    });
  },

  profileEdgeDragTo: (raw, forceOrtho = false) => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile || s.profileEdgeIndex == null) return;
    const mid = profileEdgeMidpoint(s.sketchProfile, s.profileEdgeIndex);
    if (!mid) return;
    const resolved = resolveSketchEditPoint(s, raw, forceOrtho, mid);
    const delta = {
      x: resolved.point.x - mid.x,
      y: resolved.point.y - mid.y,
      z: resolved.point.z - mid.z,
    };
    if (Math.hypot(delta.x, delta.y, delta.z) < 1e-12) return;
    const next = translateProfileEdge(
      s.sketchProfile,
      s.profileEdgeIndex,
      delta,
    );
    if (!next) return;
    set({
      sketchProfile: next,
      wallHover: resolved.point,
      lastSnapKind: resolved.kind,
      snapSession: resolved.session,
    });
  },

  endProfileEdgeDrag: () => {
    const s = get();
    if (!s.sketchTarget) return;
    set({
      profileEdgeIndex: null,
      status: "Arista proyectada · Terminar valida y aplica",
    });
  },

  wallPickClick: (wallId, hint) => {
    const s = get();
    if (s.activeTool !== "wall") return;

    // While editing a profile on Workplane, pick modes that hit walls still
    // resolve to workplane vertex edit (host solids may be hidden).
    if (s.sketchTarget && s.sketchProfile && s.drawMode !== "pickFace") {
      const hintPt = hint ?? s.activeWorkplane.origin;
      get().profileVertexClick(ontoSessionWorkplane(s.activeWorkplane, hintPt));
      return;
    }

    const wall = s.document.walls.find((w) => w.id === wallId);
    if (!wall) {
      set({ status: "Ese muro ya no está en el documento" });
      return;
    }

    if (s.drawMode === "pickFace") {
      const hintPt = hint ?? {
        x: (wall.p1.x + wall.p2.x) / 2,
        y: (wall.p1.y + wall.p2.y) / 2,
        z: wall.p1.z,
      };
      get().setWorkplaneFromSurface(wallId, undefined, hintPt);
      return;
    }

    if (s.drawMode === "pickLines") {
      const hintPt = hint ?? {
        x: (wall.p1.x + wall.p2.x) / 2,
        y: (wall.p1.y + wall.p2.y) / 2,
        z: wall.p1.z,
      };
      const p1 = closerEndpoint(wall, hintPt);
      set({
        wallPending: p1,
        wallChainOrigin: null,
        wallHover: p1,
        drawPoints: [],
        lastSnapKind: "endpoint",
        snapSession: clearSnapSession(),
        selectedWallId: wallId,
        status: "Pick líneas — P1 en extremo · clic P2 en el plano",
      });
      return;
    }

    set({ status: "Cambia a Pick líneas o Pick cara para usar clic en muro" });
  },

  cameraClick: (p) => {
    const s = get();
    if (!isCameraTool(s.activeTool)) return;
    const eyeZ = DEFAULT_CAMERA_EYE_Z;

    if (!s.wallPending) {
      set({
        wallPending: { x: p.x, y: p.y, z: eyeZ },
        wallHover: { x: p.x, y: p.y, z: eyeZ },
        status: "Cámara — clic 2: dirección de mira",
      });
      return;
    }

    const eye = s.wallPending;
    const dist = Math.hypot(p.x - eye.x, p.y - eye.y);
    if (dist < 0.2) {
      set({ status: "Mira demasiado cerca del ojo — elige otro punto" });
      return;
    }

    const n = s.document.cameras.length + 1;
    const id = createCameraId();
    const eyePos = { x: eye.x, y: eye.y, z: eyeZ };
    const targetPos = { x: p.x, y: p.y, z: eyeZ };
    const camera: Camera = {
      id,
      name: `Cámara ${n}`,
      eye: eyePos,
      target: targetPos,
      fov: DEFAULT_CAMERA_FOV,
      crop: defaultCameraCrop(eyePos, targetPos, DEFAULT_CAMERA_FOV),
    };
    applyCommand(get, set, new CreateCameraCommand(camera), `Cámara creada: ${camera.name}`);
    // Tab is derived from document.cameras inside applyCommand (F9-E4).
    set({
      activeViewId: cameraViewId(id),
      selectedCameraId: id,
      selectedWallId: null,
      selectedDoorId: null,
      selectedWindowId: null,
      wallPending: null,
      wallHover: null,
      activeTool: "none",
      status: `${camera.name} — vista 3D abierta (independiente de Perspectiva 3D)`,
    });
  },

  cancelWallDraw: () => {
    const s = get();
    const tool = s.activeTool;
    if (tool !== "wall" && tool !== "camera") return;
    if (s.sketchTarget && tool === "wall") {
      if (s.profileVertexIndex != null) {
        set({
          profileVertexIndex: null,
          ...clearDrawGesture(),
          status: "Sketch · Workplane — vértice liberado · clic otro vértice",
        });
        return;
      }
      const seeded = seedResultOutlineProfile(
        s.document.walls,
        s.sketchTarget.id,
        s.activeWorkplane,
      );
      const reseeds = seeded
        ? profileOntoSessionWorkplane(seeded, s.activeWorkplane)
        : s.sketchProfile;
      set({
        sketchProfile: reseeds,
        sketchProfileStroke: false,
        profileVertexIndex: null,
        ...clearDrawGesture(),
        status:
          "Sketch · Workplane — perímetro restaurado · Terminar aplica · Cancelar descarta",
      });
      return;
    }
    const sketch = tool === "wall" && s.editingParadigm === "sketch";
    set({
      ...clearDrawGesture(),
      status:
        tool === "camera"
          ? "Cámara cancelada — clic 1 para ojo"
          : sketch
            ? "Sketch cancelado — listo para nuevo trazo"
            : "Trazado cancelado — clic para nuevo P1",
    });
  },

  enterSketchOnElement: (kind, id, opts) => {
    if (!canEnterSketchOnKind(kind)) {
      set({
        status: "Sketch sobre selección: este tipo aún no tiene perfil editable",
      });
      return;
    }
    const s = get();
    const wall = s.document.walls.find((w) => w.id === id);
    if (!wall) {
      set({ status: "Sketch: el elemento ya no está en el documento" });
      return;
    }

    const view = s.views.find((v) => v.id === s.activeViewId);
    const viewKind = view?.kind ?? "plan";
    const viewCtx = wallProfileEditContext(viewKind);
    if (!viewCtx.allowed) {
      set({ status: viewCtx.reason ?? "Perfil vertical: vista no permitida" });
      return;
    }

    const wp = resolveWallProfileWorkplane(wall, s.activeWorkplane, opts);
    if (!wp) {
      set({
        status:
          "Perfil vertical: haz doble clic en una cara del muro en elevación/3D (o Seleccionar cara)",
      });
      return;
    }

    const storeyId = reconcileActiveStoreyId(s.document, wall.storeyId);
    const seeded = seedResultOutlineProfile(s.document.walls, id, wp);
    if (!seeded) {
      set({ status: "Sketch: no se pudo cargar el contorno del muro" });
      return;
    }
    const profile = profileOntoSessionWorkplane(seeded, wp);
    const loopNote = profile.closed
      ? `contorno resultante (${profile.edges.length} aristas)`
      : `contorno (${profile.edges.length} aristas)`;
    set({
      sketchTarget: { kind: "wall", id },
      sketchProfile: profile,
      sketchProfileStroke: false,
      profileVertexIndex: null,
      profileEdgeIndex: null,
      sketchModifyMode: "vertex",
      sketchModifyPending: null,
      selectedWallId: id,
      selectedDoorId: null,
      selectedWindowId: null,
      selectedCameraId: null,
      activeStoreyId: storeyId,
      activeWorkplane: wp,
      workplaneLock: "manual",
      workplaneLinePending: null,
      editingParadigm: "sketch",
      activeTool: "wall",
      drawMode: "line",
      ribbonTab: "modify",
      ...clearDrawGesture(),
      status: `Sketch · Workplane «${wp.label}» — ${loopNote} · preview derivado · Terminar confirma en el documento`,
    });
  },

  enterSketchOnSelection: () => {
    const s = get();
    if (s.selectedWallId) {
      get().enterSketchOnElement("wall", s.selectedWallId);
      return;
    }
    if (s.selectedDoorId || s.selectedWindowId || s.selectedCameraId) {
      set({
        status:
          "Sketch sobre selección: puertas/ventanas/cámaras no tienen perfil sketch (losas/terreno próximamente)",
      });
      return;
    }
    set({ status: "Selecciona un elemento paramétrico para Sketch (doble clic o Editar perfil)" });
  },

  finishSketchOnSelection: () => {
    const s = get();
    if (!s.sketchTarget) {
      get().cancelWallDraw();
      return;
    }
    const hostId = s.sketchTarget.id;
    const result = commitSketchProfile(get, set);
    if (!result.ok) {
      // Error status already set — stay in Sketch with profile.
      return;
    }
    if (!result.mutated) {
      // Do NOT clear sketchProfile — that looked like “Terminar descartó el edit”.
      set({
        status:
          "Sin cambios — edita vértices/aristas del provisional o redibuja · Terminar / Cancelar",
      });
      return;
    }
    set({
      sketchTarget: null,
      sketchProfile: null,
      sketchProfileStroke: false,
      profileVertexIndex: null,
      sketchModifyMode: "vertex",
      sketchModifyPending: null,
      editingParadigm: "parametric",
      activeTool: "select",
      drawMode: "line",
      ribbonTab: "modify",
      selectedWallId: result.wallId ?? hostId,
      // Force viewer resync after un-hiding host solids.
      documentRev: get().documentRev + 1,
      ...clearDrawGesture(),
      status: "Paramétrico — perfil vertical aplicado (mismo muro)",
    });
  },

  exitSketchOnSelection: () => {
    const s = get();
    if (!s.sketchTarget) {
      get().cancelWallDraw();
      return;
    }
    const keepId = s.sketchTarget.id;
    set({
      sketchTarget: null,
      sketchProfile: null,
      sketchProfileStroke: false,
      profileVertexIndex: null,
      sketchModifyMode: "vertex",
      sketchModifyPending: null,
      editingParadigm: "parametric",
      activeTool: "select",
      drawMode: "line",
      ribbonTab: "modify",
      selectedWallId: keepId,
      ...clearDrawGesture(),
      status: "Paramétrico — Sketch cancelado (perfil no aplicado)",
    });
  },
});
