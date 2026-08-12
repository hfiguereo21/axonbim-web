/** Interaction tools — wall draw, snapping, SK-draw (line/rect/arc/pick). */

export type ToolId =
  | "select"
  | "wall"
  | "door"
  | "window"
  | "camera"
  | "workplaneSelect"
  | "workplaneLine"
  | "none";

export function isWorkplaneTool(tool: ToolId): boolean {
  return tool === "workplaneSelect" || tool === "workplaneLine";
}

/** Draw panel modes while a sketch/placement tool is active. */
export type DrawMode =
  | "line"
  | "rectangle"
  | "arcSER"
  | "arcCE"
  | "pickLines"
  | "pickFace";

export type ToolSession = {
  activeTool: ToolId;
  drawMode: DrawMode;
};

/** Tools that open Modify + Draw (UI), not the EditingParadigm “Sketch Mode”. */
export function isSketchTool(tool: ToolId): boolean {
  return tool === "wall";
}

export {
  isSketchDrawMode,
  isSketchDrawModeReady,
  paradigmForDrawMode,
  type EditingParadigm,
} from "./editingParadigm.js";

export {
  rectangleCorners,
  wallAxesFromRectangle,
  type RectWallAxis,
  type SketchPoint,
} from "./sketchRect.js";

export { wallAxesFromPolyline } from "./drawPolyline.js";

export {
  ARC_SEGMENTS,
  closerEndpoint,
  sampleArcCE,
  sampleArcSER,
} from "./drawArc.js";

export { canEnterSketchOnKind, type SketchTarget, type SketchTargetKind } from "./sketchTarget.js";

export {
  appendProfileEdge,
  findWallLoop,
  hitProfileVertex,
  mapProfilePoints,
  moveProfileVertex,
  profileFromAxes,
  profileFromClosedRing,
  profileFromWallAxis,
  profileFromWallLoop,
  profileToAxes,
  profileToPoints,
  profileVertices,
  projectProfileToWorkplaneZ,
  seedProfileFromWall,
  type SketchProfile,
  type SketchProfileEdge,
  type WallAxisLike,
} from "./sketchProfile.js";

export {
  clearProfileEdges,
  copyProfileTranslated,
  deleteProfileVertex,
  filletProfileVertex,
  hitProfileEdge,
  offsetProfile,
  offsetProfileInPlane,
  profileEdgeMidpoint,
  rotateProfile,
  rotateProfileAboutAxis,
  splitProfileAtPoint,
  splitProfileEdgeByLine,
  translateProfile,
  translateProfileEdge,
  type SketchPlaneFrame,
} from "./sketchProfileEdit.js";

/** Two-click placement on plan (eye → target). */
export function isCameraTool(tool: ToolId): boolean {
  return tool === "camera";
}

/** One-click host placement (door/window on wall). */
export function isHostedTool(tool: ToolId): boolean {
  return tool === "door" || tool === "window";
}

export type Point2 = { x: number; y: number; z: number };

/** First click of a wall segment, or null. */
export type WallDrawState = {
  pending: Point2 | null;
  hover: Point2 | null;
};

export {
  applyAxisLock,
  axisAngleFromHorizontal,
  clearSnapSession,
  collectEndpoints,
  emptySnapSession,
  orthoFrom,
  snapWallPoint,
  ORTHO_ANGLE_DEG,
  ORTHO_ENTER_ANGLE_DEG,
  ORTHO_HOLD_ANGLE_DEG,
  type AxisLock,
  type SnapContext,
  type SnapKind,
  type SnapResult,
  type SnapSession,
} from "./snap";

export { restartChainAt, type WallChainDrawState } from "./wallChain";
