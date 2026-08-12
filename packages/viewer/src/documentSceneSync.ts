import {
  computeWallJoinDirs,
  doorAssemblyMeshes,
  doorPlanSymbol,
  openingsFromHosted,
  wallMeshWithOpenings,
  windowAssemblyMeshes,
  windowPlanSymbol,
  cameraPlanSymbol,
  cameraVisionConeLines,
  type MeshBuffer,
} from "@axonbim/geometry";
import type { Camera, Door, ViewCrop, Wall, Window } from "@axonbim/model";
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
} from "three";
import type { CropOverlayLayer } from "./cropOverlayLayer.js";
import {
  CAMERA_PICK_RADIUS_PX,
  FLIP_CONTROL_RADIUS_PX,
  MAX_FLIP_CONTROL_RADIUS,
  MIN_CAMERA_PICK_RADIUS,
  screenScaledRadius,
} from "./pickTolerance.js";
import type { ViewportContext } from "./viewportContext.js";
import { meshFromBuffer } from "./viewportSceneGraph.js";
import {
  CAMERA_ID,
  DOOR_ID,
  ENTITY_ID,
  ENTITY_TYPE,
  FLIP_CONTROL,
  KIND,
  WALL_ID,
  WINDOW_ID,
} from "./viewportUserData.js";

export type DocumentSceneSync = {
  syncWalls: (
    walls: Wall[],
    doors: Door[],
    windows: Window[],
    cameras: Camera[],
    selectedWallId: string | null,
    selectedDoorId: string | null,
    selectedWindowId: string | null,
    selectedCameraId: string | null,
    sessionCrop?: ViewCrop | null,
    selectedCropFrameCameraId?: string | null,
  ) => void;
  setPreviewSegment: (
    p1: { x: number; y: number; z: number } | null,
    p2: { x: number; y: number; z: number } | null,
  ) => void;
  /** SK-v1 — rectangle outline preview (four edges). */
  setPreviewRect: (
    a: { x: number; y: number; z: number } | null,
    b: { x: number; y: number; z: number } | null,
  ) => void;
  /** SK-draw — consecutive polyline segments (arcs, etc.). */
  setPreviewPolyline: (
    points: { x: number; y: number; z: number }[] | null,
  ) => void;
  /** SK-profile — perimeter on Workplane + optional vertex grips / edge highlight. */
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
  /** WP-v2 — tangible workplane patch + U/V axes. */
  setWorkplaneOverlay: (
    corners: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }, { x: number; y: number; z: number }, { x: number; y: number; z: number }] | null,
    origin?: { x: number; y: number; z: number } | null,
    axisU?: { x: number; y: number; z: number } | null,
    axisV?: { x: number; y: number; z: number } | null,
  ) => void;
  /** WP-v2 — dashed trace while defining a line workplane. */
  setWorkplaneTrace: (
    p1: { x: number; y: number; z: number } | null,
    p2: { x: number; y: number; z: number } | null,
  ) => void;
  /** Snap marker + optional ortho guides; `frame` orients the cross on the Workplane. */
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
  disposeOverlays: () => void;
};

export function createDocumentSceneSync(
  ctx: ViewportContext,
  cropLayer: CropOverlayLayer,
): DocumentSceneSync {
  const { scene } = ctx.sg;
  const {
    wallsGroup,
    doorsGroup,
    windowsGroup,
    planDoorsGroup,
    flipControlsGroup,
    camerasGroup,
    cropGroup,
    wallMat,
    wallSelectedMat,
    doorMat,
    doorSelectedMat,
    doorFrameMat,
    doorFrameSelectedMat,
    doorHardwareMat,
    doorHardwareSelectedMat,
    windowFrameMat,
    windowFrameSelectedMat,
    windowSashMat,
    windowSashSelectedMat,
    windowGlassMat,
    windowGlassSelectedMat,
    cameraLineMat,
    cameraLineSelectedMat,
    cameraConeSelectedMat,
    cameraPickGeom,
    cameraPickMat,
    cameraPickSelectedMat,
    planDoorLineMat,
    planDoorLineSelectedMat,
    flipSwingMat,
    flipHingeMat,
    flipSphereGeom,
  } = ctx.sg;

  const previewGeom = new BufferGeometry();
  // Up to 32 segments × 2 endpoints × 3 floats (arcs tessellated).
  const PREVIEW_MAX_SEGMENTS = 32;
  previewGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(PREVIEW_MAX_SEGMENTS * 2 * 3), 3),
  );
  const previewMat = new LineBasicMaterial({
    color: 0xd4a15a,
    depthTest: false,
  });
  const previewLine = new LineSegments(previewGeom, previewMat);
  previewLine.visible = false;
  previewLine.renderOrder = 5;
  scene.add(previewLine);

  const profileGeom = new BufferGeometry();
  const PROFILE_MAX_SEGMENTS = 64;
  profileGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(PROFILE_MAX_SEGMENTS * 2 * 3), 3),
  );
  const profileMat = new LineBasicMaterial({
    color: 0xffb000,
    depthTest: false,
  });
  const profileLine = new LineSegments(profileGeom, profileMat);
  profileLine.renderOrder = 6;
  profileLine.visible = false;
  scene.add(profileLine);

  const profileGripGeom = new BufferGeometry();
  // Vertices + mid-edge grips (closed ring up to ~16 edges).
  const PROFILE_MAX_GRIPS = 48;
  // 4 endpoints per cross × 3 floats
  profileGripGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(PROFILE_MAX_GRIPS * 4 * 3), 3),
  );
  const profileGripMat = new LineBasicMaterial({
    color: 0xffb000,
    depthTest: false,
  });
  const profileGrips = new LineSegments(profileGripGeom, profileGripMat);
  profileGrips.renderOrder = 7;
  profileGrips.visible = false;
  scene.add(profileGrips);

  // SK-UX-B — selected edge highlight (one segment).
  const profileEdgeGeom = new BufferGeometry();
  profileEdgeGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(6), 3),
  );
  const profileEdgeMat = new LineBasicMaterial({
    color: 0xff6a00,
    depthTest: false,
    linewidth: 2,
  });
  const profileEdgeLine = new LineSegments(profileEdgeGeom, profileEdgeMat);
  profileEdgeLine.renderOrder = 8;
  profileEdgeLine.visible = false;
  scene.add(profileEdgeLine);

  // WP-v2: patch = 4 edges; axes = 2 segments from origin
  const wpOverlayGeom = new BufferGeometry();
  wpOverlayGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array((4 + 2) * 2 * 3), 3),
  );
  const wpOverlayMat = new LineBasicMaterial({ color: 0x5b9fd4 });
  const wpOverlay = new LineSegments(wpOverlayGeom, wpOverlayMat);
  wpOverlay.renderOrder = 1;
  wpOverlay.visible = false;
  scene.add(wpOverlay);

  const wpTraceGeom = new BufferGeometry();
  wpTraceGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(6), 3),
  );
  const wpTraceMat = new LineBasicMaterial({ color: 0x5b9fd4 });
  const wpTrace = new LineSegments(wpTraceGeom, wpTraceMat);
  wpTrace.renderOrder = 2;
  wpTrace.visible = false;
  scene.add(wpTrace);

  const snapMarkerGeom = new BufferGeometry();
  snapMarkerGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(12), 3),
  );
  const snapMarkerMat = new LineBasicMaterial({ color: 0x5ec8ff });
  const snapMarker = new LineSegments(snapMarkerGeom, snapMarkerMat);
  snapMarker.visible = false;
  scene.add(snapMarker);

  const snapGuideGeom = new BufferGeometry();
  snapGuideGeom.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(6), 3),
  );
  const snapGuideMat = new LineBasicMaterial({ color: 0x5ec8ff });
  const snapGuide = new LineSegments(snapGuideGeom, snapGuideMat);
  snapGuide.visible = false;
  scene.add(snapGuide);

  const snapColors: Record<"none" | "endpoint" | "ortho" | "close", number> = {
    none: 0xb0b8c0,
    endpoint: 0x5ec8ff,
    ortho: 0x7dd87d,
    close: 0xe8b84a,
  };

  const clearGroup = (group: typeof wallsGroup, disposeGeometry: boolean) => {
    while (group.children.length) {
      const child = group.children[0]!;
      group.remove(child);
      if (disposeGeometry && child instanceof Mesh) child.geometry.dispose();
      if (disposeGeometry && child instanceof LineSegments) child.geometry.dispose();
    }
  };

  const syncWalls = (
    walls: Wall[],
    doors: Door[],
    windows: Window[],
    cameras: Camera[],
    selectedWallId: string | null,
    selectedDoorId: string | null,
    selectedWindowId: string | null,
    selectedCameraId: string | null,
    sessionCrop: ViewCrop | null = null,
    selectedCropFrameCameraId: string | null = null,
  ) => {
    clearGroup(wallsGroup, true);
    clearGroup(doorsGroup, true);
    clearGroup(windowsGroup, true);
    clearGroup(planDoorsGroup, true);
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

    const joins = computeWallJoinDirs(walls);
    for (const wall of walls) {
      const j = joins.get(wall.id);
      const openings = openingsFromHosted(wall.id, doors, windows);
      const buffer = wallMeshWithOpenings(
        wall,
        openings,
        openings.length
          ? undefined
          : {
              joinStartAway: j?.startAway ?? null,
              joinEndAway: j?.endAway ?? null,
            },
      );
      if (buffer.positions.length === 0) continue;
      const mesh = new Mesh(
        meshFromBuffer(buffer),
        wall.id === selectedWallId ? wallSelectedMat : wallMat,
      );
      mesh.userData[WALL_ID] = wall.id;
      wallsGroup.add(mesh);
    }
    for (const door of doors) {
      const host = walls.find((w) => w.id === door.wallId);
      if (!host) continue;
      const selected = door.id === selectedDoorId;
      const parts = doorAssemblyMeshes(host, door);
      const addPart = (buffer: MeshBuffer, mat: MeshLambertMaterial) => {
        if (buffer.positions.length === 0) return;
        const mesh = new Mesh(meshFromBuffer(buffer), mat);
        mesh.userData[DOOR_ID] = door.id;
        doorsGroup.add(mesh);
      };
      addPart(parts.frame, selected ? doorFrameSelectedMat : doorFrameMat);
      addPart(parts.leaf, selected ? doorSelectedMat : doorMat);
      addPart(parts.hardware, selected ? doorHardwareSelectedMat : doorHardwareMat);

      const symbol = doorPlanSymbol(host, door);
      if (symbol) {
        const geom = new BufferGeometry();
        geom.setAttribute("position", new BufferAttribute(symbol.lines, 3));
        const lines = new LineSegments(
          geom,
          selected ? planDoorLineSelectedMat : planDoorLineMat,
        );
        lines.userData[DOOR_ID] = door.id;
        planDoorsGroup.add(lines);

        if (selected) {
          for (const ctrl of symbol.flipControls) {
            const grip = new Mesh(
              flipSphereGeom,
              ctrl.kind === "swing" ? flipSwingMat : flipHingeMat,
            );
            grip.position.set(ctrl.x, ctrl.y, ctrl.z);
            const minR = screenScaledRadius(
              ctx.planWorldPerPixel(),
              FLIP_CONTROL_RADIUS_PX,
              ctrl.hitRadius,
              MAX_FLIP_CONTROL_RADIUS,
            );
            grip.scale.setScalar(minR);
            grip.userData[FLIP_CONTROL] = true;
            grip.userData[ENTITY_TYPE] = ctrl.entityType;
            grip.userData[ENTITY_ID] = ctrl.entityId;
            grip.userData[KIND] = ctrl.kind;
            flipControlsGroup.add(grip);
          }
        }
      }
    }
    for (const win of windows) {
      const host = walls.find((w) => w.id === win.wallId);
      if (!host) continue;
      const selected = win.id === selectedWindowId;
      const parts = windowAssemblyMeshes(host, win);
      const addPart = (buffer: MeshBuffer, mat: MeshLambertMaterial) => {
        if (buffer.positions.length === 0) return;
        const mesh = new Mesh(meshFromBuffer(buffer), mat);
        mesh.userData[WINDOW_ID] = win.id;
        windowsGroup.add(mesh);
      };
      addPart(parts.frame, selected ? windowFrameSelectedMat : windowFrameMat);
      addPart(parts.sash, selected ? windowSashSelectedMat : windowSashMat);
      addPart(parts.glass, selected ? windowGlassSelectedMat : windowGlassMat);

      const symbol = windowPlanSymbol(host, win);
      if (symbol) {
        const geom = new BufferGeometry();
        geom.setAttribute("position", new BufferAttribute(symbol.lines, 3));
        const lines = new LineSegments(
          geom,
          selected ? planDoorLineSelectedMat : planDoorLineMat,
        );
        lines.userData[WINDOW_ID] = win.id;
        planDoorsGroup.add(lines);

        if (selected) {
          for (const ctrl of symbol.flipControls) {
            const grip = new Mesh(
              flipSphereGeom,
              ctrl.kind === "swing" ? flipSwingMat : flipHingeMat,
            );
            grip.position.set(ctrl.x, ctrl.y, ctrl.z);
            const minR = screenScaledRadius(
              ctx.planWorldPerPixel(),
              FLIP_CONTROL_RADIUS_PX,
              ctrl.hitRadius,
              MAX_FLIP_CONTROL_RADIUS,
            );
            grip.scale.setScalar(minR);
            grip.userData[FLIP_CONTROL] = true;
            grip.userData[ENTITY_TYPE] = ctrl.entityType;
            grip.userData[ENTITY_ID] = ctrl.entityId;
            grip.userData[KIND] = ctrl.kind;
            flipControlsGroup.add(grip);
          }
        }
      }
    }
    for (const cam of cameras) {
      const selected = cam.id === selectedCameraId;
      const symbol = cameraPlanSymbol(cam);
      const geom = new BufferGeometry();
      geom.setAttribute("position", new BufferAttribute(symbol.lines, 3));
      const lines = new LineSegments(
        geom,
        selected ? cameraLineSelectedMat : cameraLineMat,
      );
      lines.userData[CAMERA_ID] = cam.id;
      camerasGroup.add(lines);

      // Plan: cone + crop frame when camera selected; grips when frame selected
      if (selected && cam.crop?.enabled) {
        const coneGeom = new BufferGeometry();
        coneGeom.setAttribute(
          "position",
          new BufferAttribute(cameraVisionConeLines(cam), 3),
        );
        const cone = new LineSegments(coneGeom, cameraConeSelectedMat);
        cone.userData[CAMERA_ID] = cam.id;
        camerasGroup.add(cone);

        const frameSelected = selectedCropFrameCameraId === cam.id;
        cropLayer.addCropOverlay(cam.crop, frameSelected, cam.id);
      }

      const pick = new Mesh(
        cameraPickGeom,
        selected ? cameraPickSelectedMat : cameraPickMat,
      );
      pick.position.set(symbol.pick.x, symbol.pick.y, symbol.pick.z);
      const r = screenScaledRadius(
        ctx.planWorldPerPixel(),
        CAMERA_PICK_RADIUS_PX,
        MIN_CAMERA_PICK_RADIUS,
      );
      pick.scale.setScalar(r);
      pick.userData[CAMERA_ID] = cam.id;
      camerasGroup.add(pick);
    }
    // Independent plan/presentation crop (clips geometry only via getClippingCrop)
    if (sessionCrop?.enabled) {
      cropLayer.addCropOverlay(
        sessionCrop,
        !selectedCameraId && !selectedCropFrameCameraId,
        null,
      );
    }
  };

  const setPreviewSegment = (
    p1: { x: number; y: number; z: number } | null,
    p2: { x: number; y: number; z: number } | null,
  ) => {
    if (!p1 || !p2) {
      previewLine.visible = false;
      previewGeom.setDrawRange(0, 0);
      return;
    }
    const arr = previewGeom.getAttribute("position") as BufferAttribute;
    const z = 0.05;
    arr.setXYZ(0, p1.x, p1.y, p1.z + z);
    arr.setXYZ(1, p2.x, p2.y, p2.z + z);
    arr.needsUpdate = true;
    previewGeom.setDrawRange(0, 2);
    previewLine.visible = true;
  };

  const setPreviewRect = (
    a: { x: number; y: number; z: number } | null,
    b: { x: number; y: number; z: number } | null,
  ) => {
    if (!a || !b) {
      previewLine.visible = false;
      previewGeom.setDrawRange(0, 0);
      return;
    }
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    const z = a.z + 0.05;
    const corners = [
      { x: minX, y: minY, z },
      { x: maxX, y: minY, z },
      { x: maxX, y: maxY, z },
      { x: minX, y: maxY, z },
    ];
    const arr = previewGeom.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < 4; i++) {
      const c0 = corners[i]!;
      const c1 = corners[(i + 1) % 4]!;
      arr.setXYZ(i * 2, c0.x, c0.y, c0.z);
      arr.setXYZ(i * 2 + 1, c1.x, c1.y, c1.z);
    }
    arr.needsUpdate = true;
    previewGeom.setDrawRange(0, 8);
    previewLine.visible = true;
  };

  const setPreviewPolyline = (
    points: { x: number; y: number; z: number }[] | null,
  ) => {
    if (!points || points.length < 2) {
      previewLine.visible = false;
      previewGeom.setDrawRange(0, 0);
      return;
    }
    const arr = previewGeom.getAttribute("position") as BufferAttribute;
    const zOff = 0.05;
    const maxSeg = PREVIEW_MAX_SEGMENTS;
    let seg = 0;
    for (let i = 0; i < points.length - 1 && seg < maxSeg; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      arr.setXYZ(seg * 2, a.x, a.y, a.z + zOff);
      arr.setXYZ(seg * 2 + 1, b.x, b.y, b.z + zOff);
      seg++;
    }
    arr.needsUpdate = true;
    previewGeom.setDrawRange(0, seg * 2);
    previewLine.visible = seg > 0;
  };

  const setProfilePolyline = (
    points: { x: number; y: number; z: number }[] | null,
    vertices: { x: number; y: number; z: number }[] | null = null,
    selectedVertex: number | null = null,
    frame: {
      normal: { x: number; y: number; z: number };
      axisU: { x: number; y: number; z: number };
      axisV: { x: number; y: number; z: number };
    } | null = null,
    selectedEdge: number | null = null,
  ) => {
    if (!points || points.length < 2) {
      profileLine.visible = false;
      profileGeom.setDrawRange(0, 0);
      profileGrips.visible = false;
      profileGripGeom.setDrawRange(0, 0);
      profileEdgeLine.visible = false;
      profileEdgeGeom.setDrawRange(0, 0);
      return;
    }
    const lift = 0.12;
    const nx = frame?.normal.x ?? 0;
    const ny = frame?.normal.y ?? 0;
    const nz = frame?.normal.z ?? 1;
    const ux = frame?.axisU.x ?? 1;
    const uy = frame?.axisU.y ?? 0;
    const uz = frame?.axisU.z ?? 0;
    const vx = frame?.axisV.x ?? 0;
    const vy = frame?.axisV.y ?? 1;
    const vz = frame?.axisV.z ?? 0;
    const arr = profileGeom.getAttribute("position") as BufferAttribute;
    let seg = 0;
    for (let i = 0; i < points.length - 1 && seg < PROFILE_MAX_SEGMENTS; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      arr.setXYZ(
        seg * 2,
        a.x + nx * lift,
        a.y + ny * lift,
        a.z + nz * lift,
      );
      arr.setXYZ(
        seg * 2 + 1,
        b.x + nx * lift,
        b.y + ny * lift,
        b.z + nz * lift,
      );
      seg++;
    }
    arr.needsUpdate = true;
    profileGeom.setDrawRange(0, seg * 2);
    profileLine.visible = seg > 0;

    // Highlight selected edge (segment index in walk order).
    if (
      selectedEdge != null &&
      selectedEdge >= 0 &&
      selectedEdge < points.length - 1
    ) {
      const a = points[selectedEdge]!;
      const b = points[selectedEdge + 1]!;
      const elift = lift + 0.03;
      const earr = profileEdgeGeom.getAttribute("position") as BufferAttribute;
      earr.setXYZ(0, a.x + nx * elift, a.y + ny * elift, a.z + nz * elift);
      earr.setXYZ(1, b.x + nx * elift, b.y + ny * elift, b.z + nz * elift);
      earr.needsUpdate = true;
      profileEdgeGeom.setDrawRange(0, 2);
      profileEdgeLine.visible = true;
    } else {
      profileEdgeLine.visible = false;
      profileEdgeGeom.setDrawRange(0, 0);
    }

    const grips = vertices && vertices.length > 0 ? vertices : [];
    // Mid-edge grips so segments read as projectable (SK-UX-B).
    const mids: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      mids.push({
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5,
        z: (a.z + b.z) * 0.5,
      });
    }
    if (grips.length === 0 && mids.length === 0) {
      profileGrips.visible = false;
      profileGripGeom.setDrawRange(0, 0);
      return;
    }
    const garr = profileGripGeom.getAttribute("position") as BufferAttribute;
    let gi = 0;
    const gripLift = lift + 0.02;
    const putCross = (
      v: { x: number; y: number; z: number },
      s: number,
    ) => {
      if (gi >= PROFILE_MAX_GRIPS) return;
      const cx = v.x + nx * gripLift;
      const cy = v.y + ny * gripLift;
      const cz = v.z + nz * gripLift;
      const base = gi * 4;
      garr.setXYZ(base + 0, cx - ux * s, cy - uy * s, cz - uz * s);
      garr.setXYZ(base + 1, cx + ux * s, cy + uy * s, cz + uz * s);
      garr.setXYZ(base + 2, cx - vx * s, cy - vy * s, cz - vz * s);
      garr.setXYZ(base + 3, cx + vx * s, cy + vy * s, cz + vz * s);
      gi++;
    };
    for (let i = 0; i < grips.length; i++) {
      putCross(grips[i]!, i === selectedVertex ? 0.34 : 0.16);
    }
    for (let i = 0; i < mids.length; i++) {
      putCross(mids[i]!, i === selectedEdge ? 0.28 : 0.11);
    }
    garr.needsUpdate = true;
    profileGripGeom.setDrawRange(0, gi * 4);
    profileGripMat.color.setHex(
      (selectedVertex != null && selectedVertex >= 0) ||
        (selectedEdge != null && selectedEdge >= 0)
        ? 0xff6a00
        : 0xffb000,
    );
    profileGrips.visible = gi > 0;
  };

  const setWorkplaneOverlay = (
    corners:
      | [
          { x: number; y: number; z: number },
          { x: number; y: number; z: number },
          { x: number; y: number; z: number },
          { x: number; y: number; z: number },
        ]
      | null,
    origin: { x: number; y: number; z: number } | null = null,
    axisU: { x: number; y: number; z: number } | null = null,
    axisV: { x: number; y: number; z: number } | null = null,
  ) => {
    if (!corners) {
      wpOverlay.visible = false;
      wpOverlayGeom.setDrawRange(0, 0);
      return;
    }
    const arr = wpOverlayGeom.getAttribute("position") as BufferAttribute;
    const lift = 0.04;
    const ring = [corners[0], corners[1], corners[2], corners[3], corners[0]];
    let i = 0;
    for (let e = 0; e < 4; e++) {
      const a = ring[e]!;
      const b = ring[e + 1]!;
      arr.setXYZ(i++, a.x, a.y, a.z + lift);
      arr.setXYZ(i++, b.x, b.y, b.z + lift);
    }
    if (origin && axisU && axisV) {
      const au = 1.2;
      const av = 1.2;
      arr.setXYZ(i++, origin.x, origin.y, origin.z + lift);
      arr.setXYZ(
        i++,
        origin.x + axisU.x * au,
        origin.y + axisU.y * au,
        origin.z + axisU.z * au + lift,
      );
      arr.setXYZ(i++, origin.x, origin.y, origin.z + lift);
      arr.setXYZ(
        i++,
        origin.x + axisV.x * av,
        origin.y + axisV.y * av,
        origin.z + axisV.z * av + lift,
      );
    }
    arr.needsUpdate = true;
    wpOverlayGeom.setDrawRange(0, i);
    wpOverlay.visible = i > 0;
  };

  const setWorkplaneTrace = (
    p1: { x: number; y: number; z: number } | null,
    p2: { x: number; y: number; z: number } | null,
  ) => {
    if (!p1 || !p2) {
      wpTrace.visible = false;
      wpTraceGeom.setDrawRange(0, 0);
      return;
    }
    const arr = wpTraceGeom.getAttribute("position") as BufferAttribute;
    const z = Math.max(p1.z, p2.z) + 0.06;
    arr.setXYZ(0, p1.x, p1.y, z);
    arr.setXYZ(1, p2.x, p2.y, z);
    arr.needsUpdate = true;
    wpTraceGeom.setDrawRange(0, 2);
    wpTrace.visible = true;
  };

  const setSnapCue = (
    point: { x: number; y: number; z: number } | null,
    kind: "none" | "endpoint" | "ortho" | "close",
    pending: { x: number; y: number; z: number } | null = null,
    frame: {
      normal: { x: number; y: number; z: number };
      axisU: { x: number; y: number; z: number };
      axisV: { x: number; y: number; z: number };
    } | null = null,
  ) => {
    const nx = frame?.normal.x ?? 0;
    const ny = frame?.normal.y ?? 0;
    const nz = frame?.normal.z ?? 1;
    const ux = frame?.axisU.x ?? 1;
    const uy = frame?.axisU.y ?? 0;
    const uz = frame?.axisU.z ?? 0;
    const vx = frame?.axisV.x ?? 0;
    const vy = frame?.axisV.y ?? 1;
    const vz = frame?.axisV.z ?? 0;
    const lift = 0.08;

    const placeCross = (
      p: { x: number; y: number; z: number },
      s: number,
      color: number,
    ) => {
      const cx = p.x + nx * lift;
      const cy = p.y + ny * lift;
      const cz = p.z + nz * lift;
      const arr = snapMarkerGeom.getAttribute("position") as BufferAttribute;
      // Cross in Workplane UV (fallback ≈ world XY when frame omitted).
      arr.setXYZ(0, cx - ux * s, cy - uy * s, cz - uz * s);
      arr.setXYZ(1, cx + ux * s, cy + uy * s, cz + uz * s);
      arr.setXYZ(2, cx - vx * s, cy - vy * s, cz - vz * s);
      arr.setXYZ(3, cx + vx * s, cy + vy * s, cz + vz * s);
      arr.needsUpdate = true;
      snapMarkerMat.color.setHex(color);
      snapMarker.visible = true;
    };

    if (!point || kind === "none") {
      // Faint cursor when free-drawing / Modificar pending without snap kind.
      if (point && pending) {
        placeCross(point, 0.12, snapColors.none);
        snapGuide.visible = false;
        previewMat.color.setHex(0xb0b8c0);
        return;
      }
      if (point) {
        placeCross(point, 0.12, snapColors.none);
        snapGuide.visible = false;
        previewMat.color.setHex(0xb0b8c0);
        return;
      }
      snapMarker.visible = false;
      snapGuide.visible = false;
      previewMat.color.setHex(0xd4a15a);
      return;
    }

    const s = kind === "close" || kind === "endpoint" ? 0.22 : 0.16;
    placeCross(point, s, snapColors[kind]);
    previewMat.color.setHex(snapColors[kind]);

    if (pending && (kind === "ortho" || kind === "close" || kind === "endpoint")) {
      const gLift = 0.04;
      const g = snapGuideGeom.getAttribute("position") as BufferAttribute;
      g.setXYZ(
        0,
        pending.x + nx * gLift,
        pending.y + ny * gLift,
        pending.z + nz * gLift,
      );
      g.setXYZ(
        1,
        point.x + nx * gLift,
        point.y + ny * gLift,
        point.z + nz * gLift,
      );
      g.needsUpdate = true;
      snapGuideMat.color.setHex(snapColors[kind]);
      snapGuide.visible = true;
    } else {
      snapGuide.visible = false;
    }
  };

  const disposeOverlays = () => {
    previewGeom.dispose();
    previewMat.dispose();
    profileGeom.dispose();
    profileMat.dispose();
    profileGripGeom.dispose();
    profileGripMat.dispose();
    profileEdgeGeom.dispose();
    profileEdgeMat.dispose();
    wpOverlayGeom.dispose();
    wpOverlayMat.dispose();
    wpTraceGeom.dispose();
    wpTraceMat.dispose();
    snapMarkerGeom.dispose();
    snapMarkerMat.dispose();
    snapGuideGeom.dispose();
    snapGuideMat.dispose();
  };

  return {
    syncWalls,
    setPreviewSegment,
    setPreviewRect,
    setPreviewPolyline,
    setProfilePolyline,
    setWorkplaneOverlay,
    setWorkplaneTrace,
    setSnapCue,
    disposeOverlays,
  };
}
