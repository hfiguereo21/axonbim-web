import type { Camera, Door, ViewCrop, Wall, Window } from "@axonbim/model";
import { LineSegments, Mesh, WebGLRenderer } from "three";
import { createCropOverlayLayer } from "./cropOverlayLayer.js";
import { createDocumentSceneSync } from "./documentSceneSync.js";
import { clearGroupMeshes } from "./viewCropClip.js";
import {
  createViewportCameraController,
  type CameraPreset,
} from "./viewportCameraController.js";
import { createViewportContext, type ViewProjection } from "./viewportContext.js";
import {
  createViewportPicking,
  type CropGripPick,
  type FlipPick,
  type WallHit,
} from "./viewportPicking.js";
import {
  createViewportSceneGraph,
  disposeStaticSceneGraphResources,
} from "./viewportSceneGraph.js";

export type { CameraPreset } from "./viewportCameraController.js";
export type { ViewProjection } from "./viewportContext.js";
export type { CropGripPick, FlipPick, WallHit } from "./viewportPicking.js";

export type ViewportHandle = {
  canvas: HTMLCanvasElement;
  resize: (width: number, height: number) => void;
  dispose: () => void;
  fitEmpty: () => void;
  fitWalls: (walls: Wall[]) => void;
  setProjection: (mode: ViewProjection) => void;
  /**
   * Named view for the 3D tab. Non-iso → orthographic 3D; iso → perspective.
   * Orbit remains enabled around the current pivot.
   */
  setCameraPreset: (preset: CameraPreset) => void;
  /** Orbit the 3D camera by screen delta (px). No-op in plan. */
  orbitByDelta: (dx: number, dy: number) => void;
  /** Pose the 3D perspective camera from a model Camera entity. */
  applyModelCamera: (cam: {
    eye: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    fov: number;
  }) => void;
  /** Disable wheel/orbit (locked camera view). Plan pan/zoom still uses this flag. */
  setNavigationEnabled: (enabled: boolean) => void;
  /** World-space orbit / look-at pivot for the 3D cameras. */
  setOrbitPivot: (point: { x: number; y: number; z: number }) => void;
  getOrbitPivot: () => { x: number; y: number; z: number };
  syncWalls: (
    walls: Wall[],
    doors: Door[],
    windows: Window[],
    cameras: Camera[],
    selectedWallId: string | null,
    selectedDoorId: string | null,
    selectedWindowId: string | null,
    selectedCameraId: string | null,
    /** Session crop for plan/perspective (not camera entity). */
    sessionCrop?: ViewCrop | null,
    /** Camera whose crop frame is selected (grips + move) in plan. */
    selectedCropFrameCameraId?: string | null,
  ) => void;
  /** Apply AABB clipping in 3D (no-op / disabled in plan). */
  setClippingCrop: (crop: ViewCrop | null) => void;
  setPreviewSegment: (
    p1: { x: number; y: number; z: number } | null,
    p2: { x: number; y: number; z: number } | null,
  ) => void;
  setPreviewRect: (
    a: { x: number; y: number; z: number } | null,
    b: { x: number; y: number; z: number } | null,
  ) => void;
  setPreviewPolyline: (
    points: { x: number; y: number; z: number }[] | null,
  ) => void;
  setProfilePolyline: (
    points: { x: number; y: number; z: number }[] | null,
    vertices?: { x: number; y: number; z: number }[] | null,
    selectedVertex?: number | null,
    frame?: {
      normal: { x: number; y: number; z: number };
      axisU: { x: number; y: number; z: number };
      axisV: { x: number; y: number; z: number };
    } | null,
    selectedEdge?: number | null,
  ) => void;
  setWorkplaneOverlay: (
    corners: [
      { x: number; y: number; z: number },
      { x: number; y: number; z: number },
      { x: number; y: number; z: number },
      { x: number; y: number; z: number },
    ] | null,
    origin?: { x: number; y: number; z: number } | null,
    axisU?: { x: number; y: number; z: number } | null,
    axisV?: { x: number; y: number; z: number } | null,
  ) => void;
  setWorkplaneTrace: (
    p1: { x: number; y: number; z: number } | null,
    p2: { x: number; y: number; z: number } | null,
  ) => void;
  /** Snap marker + optional ortho guides while drawing (UV frame on Workplane). */
  setSnapCue: (
    point: { x: number; y: number; z: number } | null,
    kind: "none" | "endpoint" | "ortho" | "close",
    pending?: { x: number; y: number; z: number } | null,
    frame?: {
      normal: { x: number; y: number; z: number };
      axisU: { x: number; y: number; z: number };
      axisV: { x: number; y: number; z: number };
    } | null,
  ) => void;
  /** NDC from canvas client coords → world point on storey plane z=elevation */
  pickGround: (
    clientX: number,
    clientY: number,
    elevation?: number,
  ) => { x: number; y: number; z: number } | null;
  pickWorkplane: (
    clientX: number,
    clientY: number,
    plane: {
      origin: { x: number; y: number; z: number };
      normal: { x: number; y: number; z: number };
    },
  ) => { x: number; y: number; z: number } | null;
  pickWallId: (clientX: number, clientY: number) => string | null;
  pickWallHit: (
    clientX: number,
    clientY: number,
    walls: readonly Wall[],
  ) => WallHit | null;
  pickDoorId: (clientX: number, clientY: number) => string | null;
  pickWindowId: (clientX: number, clientY: number) => string | null;
  pickCameraId: (clientX: number, clientY: number) => string | null;
  /** Plan orientation grips (swing / hinge) — reusable for hosted elements. */
  pickFlipControl: (clientX: number, clientY: number) => FlipPick | null;
  /** Crop region corner grips. */
  pickCropGrip: (clientX: number, clientY: number) => CropGripPick | null;
  /** Pick camera crop frame body (not session crop). */
  pickCropFrame: (clientX: number, clientY: number) => { cameraId: string } | null;
  /** Project world point to client (CSS) coordinates — C3 screen crop frame. */
  clientFromWorld: (
    wx: number,
    wy: number,
    wz: number,
  ) => { x: number; y: number; behind: boolean };
};

export type CreateViewportOptions = {
  canvas: HTMLCanvasElement;
  background?: string;
  projection?: ViewProjection;
};

/** Three.js representation adapter — perspective or orthographic plan. */
export function createViewport(options: CreateViewportOptions): ViewportHandle {
  const { canvas, background = "#1c2228", projection: initial = "perspective" } = options;

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;

  const sg = createViewportSceneGraph(background);
  const ctx = createViewportContext({
    canvas,
    sg,
    renderer,
    initialProjection: initial,
  });

  const cropLayer = createCropOverlayLayer(ctx);
  const syncSceneForMode = () => ctx.syncSceneForMode(cropLayer.applyClippingState);
  const camera = createViewportCameraController(ctx, syncSceneForMode);
  const sceneSync = createDocumentSceneSync(ctx, cropLayer);
  const picking = createViewportPicking(ctx);

  syncSceneForMode();
  const unbindNavigation = camera.bindNavigation();

  let raf = 0;
  const render = () => {
    raf = requestAnimationFrame(render);
    renderer.render(sg.scene, ctx.activeCamera());
  };
  render();

  const {
    wallsGroup,
    doorsGroup,
    windowsGroup,
    planDoorsGroup,
    flipControlsGroup,
    camerasGroup,
    cropGroup,
    cropMaskGroup,
  } = sg;

  const clearDynamicMeshes = () => {
    while (wallsGroup.children.length) {
      const child = wallsGroup.children[0]!;
      wallsGroup.remove(child);
      if (child instanceof Mesh) child.geometry.dispose();
    }
    while (doorsGroup.children.length) {
      const child = doorsGroup.children[0]!;
      doorsGroup.remove(child);
      if (child instanceof Mesh) child.geometry.dispose();
    }
    while (windowsGroup.children.length) {
      const child = windowsGroup.children[0]!;
      windowsGroup.remove(child);
      if (child instanceof Mesh) child.geometry.dispose();
    }
    while (planDoorsGroup.children.length) {
      const child = planDoorsGroup.children[0]!;
      planDoorsGroup.remove(child);
      if (child instanceof LineSegments) child.geometry.dispose();
    }
    while (flipControlsGroup.children.length) {
      flipControlsGroup.remove(flipControlsGroup.children[0]!);
    }
    while (camerasGroup.children.length) {
      const child = camerasGroup.children[0]!;
      camerasGroup.remove(child);
      if (child instanceof LineSegments || child instanceof Mesh) {
        child.geometry.dispose();
      }
    }
    while (cropGroup.children.length) {
      const child = cropGroup.children[0]!;
      cropGroup.remove(child);
      if (child instanceof LineSegments || child instanceof Mesh) {
        child.geometry.dispose();
      }
    }
  };

  return {
    canvas,
    resize(w, h) {
      if (w <= 0 || h <= 0) return;
      ctx.width = w;
      ctx.height = h;
      renderer.setSize(w, h, false);
      ctx.persp.aspect = w / h;
      ctx.persp.updateProjectionMatrix();
      camera.updateOrthoFrustum();
      camera.updateOrtho3dFrustum();
    },
    fitEmpty: camera.fitEmpty,
    fitWalls: camera.fitWalls,
    setProjection: camera.setProjection,
    setOrbitPivot: camera.setOrbitPivot,
    getOrbitPivot: camera.getOrbitPivot,
    setCameraPreset: camera.setCameraPreset,
    orbitByDelta: camera.orbitByDelta,
    applyModelCamera: camera.applyModelCamera,
    setNavigationEnabled: camera.setNavigationEnabled,
    syncWalls: sceneSync.syncWalls,
    setClippingCrop: cropLayer.setClippingCrop,
    setPreviewSegment: sceneSync.setPreviewSegment,
    setPreviewRect: sceneSync.setPreviewRect,
    setPreviewPolyline: sceneSync.setPreviewPolyline,
    setProfilePolyline: sceneSync.setProfilePolyline,
    setWorkplaneOverlay: sceneSync.setWorkplaneOverlay,
    setWorkplaneTrace: sceneSync.setWorkplaneTrace,
    setSnapCue: sceneSync.setSnapCue,
    pickGround: picking.pickGround,
    pickWorkplane: picking.pickWorkplane,
    pickWallId: picking.pickWallId,
    pickWallHit: picking.pickWallHit,
    pickDoorId: picking.pickDoorId,
    pickWindowId: picking.pickWindowId,
    pickCameraId: picking.pickCameraId,
    pickFlipControl: picking.pickFlipControl,
    pickCropGrip: picking.pickCropGrip,
    pickCropFrame: picking.pickCropFrame,
    clientFromWorld: ctx.clientFromWorld,
    dispose() {
      cancelAnimationFrame(raf);
      unbindNavigation();
      disposeStaticSceneGraphResources(sg);
      clearGroupMeshes(cropMaskGroup);
      sceneSync.disposeOverlays();
      clearDynamicMeshes();
      renderer.dispose();
    },
  };
}
