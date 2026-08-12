import type { HistoryStack } from "@axonbim/commands";
import type {
  AxonDocument,
  CropCorner,
  Door,
  DoorLeafState,
  DoorSwing,
  ViewCrop,
  Window,
  Workplane,
} from "@axonbim/model";
import type {
  DrawMode,
  EditingParadigm,
  SketchPoint,
  SketchProfile,
  SketchTarget,
  ToolId,
} from "@axonbim/tools";
import type { CameraPreset } from "@axonbim/viewer";
import type { CropDragMeta } from "./viewCropDrag.js";
import type { SketchModifyMode } from "./sketchModifySlice.js";
import type {
  DetailLevel,
  DockSide,
  FloatPos,
  OrbitPivotMode,
  PanelId,
  ProjectView,
  RibbonTab,
  ViewKind,
  VisualStyle,
} from "./sessionTypes.js";

/** Full session store shape — composed from slices in createSessionStore.ts. */
export type SessionState = {
  document: AxonDocument;
  history: HistoryStack;
  views: ProjectView[];
  activeViewId: string;
  ribbonTab: RibbonTab;
  activeTool: ToolId;
  drawMode: DrawMode;
  /** SK-v1 — parametric vs sketch; session only. */
  editingParadigm: EditingParadigm;
  /** SK-sel — host element for Sketch-on-selection; session only. */
  sketchTarget: SketchTarget | null;
  /** SK-profile — abstract perimeter on Workplane; session only. */
  sketchProfile: SketchProfile | null;
  sketchProfileStroke: boolean;
  profileVertexIndex: number | null;
  /** SK-UX-B — selected edge index in walk order (session only). */
  profileEdgeIndex: number | null;
  /** Bloque 6B — Modificar sobre provisional (null path = vertex default). */
  sketchModifyMode: SketchModifyMode;
  sketchModifyPending: SketchPoint | null;
  setSketchModifyMode: (mode: SketchModifyMode) => void;
  redrawSketchProfile: () => void;
  sketchModifyClick: (raw: SketchPoint, forceOrtho?: boolean) => void;
  deleteSelectedProfileVertex: () => void;
  selectProfileEdge: (edgeIndex: number | null) => void;
  profileEdgeClick: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  profileEdgeDragTo: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  endProfileEdgeDrag: () => void;
  wallChain: boolean;
  activeFamilyId: string;
  wallHeight: number;
  selectedWallId: string | null;
  selectedDoorId: string | null;
  selectedWindowId: string | null;
  selectedCameraId: string | null;
  selectedCropFrameCameraId: string | null;
  cropDragLive: ViewCrop | null;
  cropDragMeta: CropDragMeta | null;
  cameraPoseDragLive: {
    cameraId: string;
    eye: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null;
  cameraViewNavEdit: boolean;
  setCameraViewNavEdit: (edit: boolean) => void;
  activeDoorFamilyId: string;
  activeWindowFamilyId: string;
  wallPending: { x: number; y: number; z: number } | null;
  wallChainOrigin: { x: number; y: number; z: number } | null;
  wallHover: { x: number; y: number; z: number } | null;
  drawPoints: SketchPoint[];
  lastSnapKind: import("@axonbim/tools").SnapKind;
  /** LR1 ortho axis lock — session only, never in document/history. */
  snapSession: import("@axonbim/tools").SnapSession;
  snapEnabled: boolean;
  documentRev: number;
  /** LR3-A — active storey for creation / elevation context. */
  activeStoreyId: string;
  setActiveStoreyId: (id: string) => void;
  /** WP-v2 — tangible workplane (session only). */
  activeWorkplane: Workplane;
  workplaneLock: "auto-level" | "manual";
  workplaneLinePending: { x: number; y: number; z: number } | null;
  resetWorkplaneToLevel: () => void;
  setWorkplaneFromSurface: (
    wallId: string,
    face?: "front" | "back",
    hint?: { x: number; y: number; z: number },
  ) => void;
  setWorkplaneFromLine: (
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
  ) => void;
  workplaneSelectClick: (
    wallId: string | null,
    hint?: { x: number; y: number; z: number },
  ) => void;
  workplaneLineClick: (p: { x: number; y: number; z: number }) => void;
  status: string;
  visualStyle: VisualStyle;
  detailLevel: DetailLevel;
  graphicScale: string;
  fitViewRequest: number;
  cameraPresetRequest: number;
  cameraPreset: CameraPreset | null;
  orbitPivotMode: OrbitPivotMode;
  orbitPivotRequest: number;
  browserDock: DockSide;
  propertiesDock: DockSide;
  browserFloat: FloatPos;
  propertiesFloat: FloatPos;
  browserVisible: boolean;
  propertiesVisible: boolean;
  systemBrowserVisible: boolean;
  iconBarVisible: boolean;
  statusBarVisible: boolean;
  leftDockWidth: number;
  rightDockWidth: number;
  leftDockSplit: number;
  rightDockSplit: number;
  dockPreview: DockSide | null;
  draggingPanel: PanelId | null;
  newProject: () => void;
  openDemo: () => void;
  openFromText: (text: string, fileName?: string) => void;
  /** F9-E5 policy B — salvage `.axon.bak` / damaged copies with warnings. */
  recoverFromText: (text: string, fileName?: string) => void;
  exportText: () => string;
  setStatus: (status: string) => void;
  setRibbonTab: (tab: RibbonTab) => void;
  setTool: (tool: ToolId) => void;
  setDrawMode: (mode: DrawMode) => void;
  enterSketchOnSelection: () => void;
  enterSketchOnElement: (
    kind: SketchTarget["kind"],
    id: string,
    opts?: {
      face?: "front" | "back";
      hitPoint?: { x: number; y: number; z: number };
    },
  ) => void;
  finishSketchOnSelection: () => void;
  exitSketchOnSelection: () => void;
  profileVertexClick: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  profileVertexDragTo: (
    p: { x: number; y: number; z: number },
    forceOrtho?: boolean,
  ) => void;
  endProfileVertexDrag: () => void;
  setWallChain: (chained: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  splitWallChain: () => void;
  releaseWallChain: () => void;
  restartChainAt: (point: { x: number; y: number; z: number }) => void;
  setActiveFamilyId: (id: string) => void;
  setWallHeight: (height: number) => void;
  setSelectedWallId: (id: string | null) => void;
  setSelectedDoorId: (id: string | null) => void;
  setSelectedWindowId: (id: string | null) => void;
  setSelectedCameraId: (id: string | null) => void;
  setSelectedCropFrameCameraId: (id: string | null) => void;
  setActiveDoorFamilyId: (id: string) => void;
  setActiveWindowFamilyId: (id: string) => void;
  placeDoorOnWall: (wallId: string, world: { x: number; y: number }) => void;
  placeWindowOnWall: (wallId: string, world: { x: number; y: number }) => void;
  setWallHover: (p: { x: number; y: number; z: number } | null, forceOrtho?: boolean) => void;
  wallClick: (p: { x: number; y: number; z: number }, forceOrtho?: boolean) => void;
  wallPickClick: (wallId: string, hint?: { x: number; y: number; z: number }) => void;
  cameraClick: (p: { x: number; y: number; z: number }) => void;
  cancelWallDraw: () => void;
  runUndo: () => void;
  runRedo: () => void;
  deleteSelectedWall: () => void;
  deleteSelectedDoor: () => void;
  deleteSelectedWindow: () => void;
  deleteSelectedCamera: () => void;
  setSelectedCameraName: (name: string) => void;
  setSelectedCameraFov: (fov: number) => void;
  setSelectedCameraEyeHeight: (z: number) => void;
  setSelectedCameraCrop: (crop: ViewCrop) => void;
  getActiveViewCrop: () => ViewCrop | null;
  getClippingCrop: () => ViewCrop | null;
  setActiveViewCropEnabled: (enabled: boolean) => void;
  setActiveViewCropSize: (width: number, depth: number) => void;
  setActiveViewCrop: (crop: ViewCrop) => void;
  resizeActiveViewCropCorner: (corner: CropCorner, x: number, y: number) => void;
  beginCropDrag: (cameraId: string | null, corner: CropCorner) => void;
  beginCameraFrameMove: (cameraId: string, x: number, y: number) => void;
  updateCropDrag: (x: number, y: number) => void;
  commitCropDrag: () => void;
  cancelCropDrag: () => void;
  setSelectedDoorLeafState: (state: DoorLeafState) => void;
  setSelectedDoorSwing: (swing: DoorSwing) => void;
  flipSelectedDoorSwing: () => void;
  flipSelectedDoorHinge: () => void;
  setSelectedDoorHinge: (hinge: Door["hinge"]) => void;
  setSelectedDoorFamily: (familyId: string) => void;
  setSelectedWindowLeafState: (state: DoorLeafState) => void;
  setSelectedWindowSwing: (swing: DoorSwing) => void;
  flipSelectedWindowSwing: () => void;
  flipSelectedWindowHinge: () => void;
  setSelectedWindowHinge: (hinge: Window["hinge"]) => void;
  setSelectedWindowFamily: (familyId: string) => void;
  setSelectedWallHeight: (height: number) => void;
  setSelectedWallThickness: (thickness: number) => void;
  setSelectedWallFamily: (familyId: string) => void;
  setActiveView: (id: string) => void;
  ensureViewOpen: (id: string) => void;
  addView: (kind: ViewKind) => void;
  setVisualStyle: (style: VisualStyle) => void;
  setDetailLevel: (level: DetailLevel) => void;
  setGraphicScale: (scale: string) => void;
  requestFitView: () => void;
  requestCameraPreset: (preset: CameraPreset) => void;
  setOrbitPivotMode: (mode: OrbitPivotMode) => void;
  syncOrbitPivot: () => void;
  setPanelDock: (id: PanelId, side: DockSide) => void;
  setPanelFloat: (id: PanelId, pos: FloatPos) => void;
  setPanelVisible: (id: PanelId, visible: boolean) => void;
  setSystemBrowserVisible: (visible: boolean) => void;
  setIconBarVisible: (visible: boolean) => void;
  setStatusBarVisible: (visible: boolean) => void;
  setLeftDockWidth: (width: number) => void;
  setRightDockWidth: (width: number) => void;
  setLeftDockSplit: (ratio: number) => void;
  setRightDockSplit: (ratio: number) => void;
  setDockPreview: (side: DockSide | null) => void;
  setDraggingPanel: (id: PanelId | null) => void;
  cycleGraphicScale: () => void;
  cycleVisualStyle: () => void;
  cycleDetailLevel: () => void;
};

export type SessionSliceCreator<T extends Partial<SessionState>> = (
  set: (
    partial:
      | Partial<SessionState>
      | ((state: SessionState) => Partial<SessionState>),
  ) => void,
  get: () => SessionState,
) => T;
