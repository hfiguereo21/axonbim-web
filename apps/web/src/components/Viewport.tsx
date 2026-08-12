import {
  computeModelEnvelope,
  wallMaxHeightOf,
  workplanePatchCorners,
  type AxonDocument,
  type CropCorner,
  type Workplane,
} from "@axonbim/model";
import {
  hitProfileEdge,
  hitProfileVertex,
  profileToPoints,
  profileVertices,
  sampleArcCE,
  sampleArcSER,
} from "@axonbim/tools";
import { createViewport, type ViewportHandle } from "@axonbim/viewer";

function pickOnWorkplane(
  vp: ViewportHandle,
  clientX: number,
  clientY: number,
  wp: Workplane,
) {
  if (wp.kind === "storey") {
    return vp.pickGround(clientX, clientY, wp.origin.z);
  }
  return vp.pickWorkplane(clientX, clientY, {
    origin: wp.origin,
    normal: wp.normal,
  });
}
import { useEffect, useRef, useState } from "react";
import { isInsideCameraViewFrame } from "../session/cameraViewNav";
import {
  buildCameraCropScreenFrame,
  screenFrameFromCornerDrag,
  type ScreenCropFrame,
} from "../session/cropScreenFrame";
import type { OrbitPivotMode } from "../session/sessionTypes";
import { previewWallFromSketchProfile } from "../session/sketchPreviewWall";
import { routeSketchWallPointer } from "../session/sketchPointerRoute";
import {
  shouldReportWorkplanePickMiss,
  WORKPLANE_PICK_MISS_STATUS,
} from "../session/workplanePickFeedback";
import { useSessionStore } from "../sessionStore";
import { ViewOrientationGizmo } from "./ViewOrientationGizmo";

/** Orbit fallback from LR3-C envelope (derived, not SoT). */
function modelPivot(doc: AxonDocument) {
  const env = computeModelEnvelope(doc);
  if (env.empty) return { x: 0, y: 0, z: 1 };
  return { x: env.center.x, y: env.center.y, z: env.center.z };
}

function resolveOrbitPivot(
  mode: OrbitPivotMode,
  state: ReturnType<typeof useSessionStore.getState>,
): { x: number; y: number; z: number } {
  const { document: doc, selectedWallId, selectedDoorId, selectedWindowId } = state;
  const fallback = modelPivot(doc);

  if (mode !== "selection") return fallback;

  if (selectedWallId) {
    const w = doc.walls.find((x) => x.id === selectedWallId);
    if (w) {
      return {
        x: (w.p1.x + w.p2.x) / 2,
        y: (w.p1.y + w.p2.y) / 2,
        z: wallMaxHeightOf(w) * 0.5,
      };
    }
  }
  if (selectedDoorId) {
    const d = doc.doors.find((x) => x.id === selectedDoorId);
    const host = d ? doc.walls.find((w) => w.id === d.wallId) : undefined;
    if (d && host) {
      const len = Math.hypot(host.p2.x - host.p1.x, host.p2.y - host.p1.y) || 1;
      const t = Math.min(1, Math.max(0, d.centerOffset / len));
      return {
        x: host.p1.x + (host.p2.x - host.p1.x) * t,
        y: host.p1.y + (host.p2.y - host.p1.y) * t,
        z: d.sill + d.height * 0.5,
      };
    }
  }
  if (selectedWindowId) {
    const win = doc.windows.find((x) => x.id === selectedWindowId);
    const host = win ? doc.walls.find((w) => w.id === win.wallId) : undefined;
    if (win && host) {
      const len = Math.hypot(host.p2.x - host.p1.x, host.p2.y - host.p1.y) || 1;
      const t = Math.min(1, Math.max(0, win.centerOffset / len));
      return {
        x: host.p1.x + (host.p2.x - host.p1.x) * t,
        y: host.p1.y + (host.p2.y - host.p1.y) * t,
        z: win.sill + win.height * 0.5,
      };
    }
  }
  return fallback;
}

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ViewportHandle | null>(null);

  const fitViewRequest = useSessionStore((s) => s.fitViewRequest);
  const cameraPresetRequest = useSessionStore((s) => s.cameraPresetRequest);
  const cameraPreset = useSessionStore((s) => s.cameraPreset);
  const orbitPivotRequest = useSessionStore((s) => s.orbitPivotRequest);
  const orbitPivotMode = useSessionStore((s) => s.orbitPivotMode);
  const activeViewId = useSessionStore((s) => s.activeViewId);
  const activeViewKind = useSessionStore(
    (s) => s.views.find((v) => v.id === s.activeViewId)?.kind,
  );
  const visualStyle = useSessionStore((s) => s.visualStyle);
  const documentRev = useSessionStore((s) => s.documentRev);
  const walls = useSessionStore((s) => s.document.walls);
  const doors = useSessionStore((s) => s.document.doors);
  const windows = useSessionStore((s) => s.document.windows);
  const selectedWallId = useSessionStore((s) => s.selectedWallId);
  const selectedDoorId = useSessionStore((s) => s.selectedDoorId);
  const selectedWindowId = useSessionStore((s) => s.selectedWindowId);
  const selectedCameraId = useSessionStore((s) => s.selectedCameraId);
  const selectedCropFrameCameraId = useSessionStore((s) => s.selectedCropFrameCameraId);
  const cameras = useSessionStore((s) => s.document.cameras);
  const views = useSessionStore((s) => s.views);
  const cropDragLive = useSessionStore((s) => s.cropDragLive);
  const cropDragMeta = useSessionStore((s) => s.cropDragMeta);
  const cameraPoseDragLive = useSessionStore((s) => s.cameraPoseDragLive);
  const cameraViewNavEdit = useSessionStore((s) => s.cameraViewNavEdit);
  const activeTool = useSessionStore((s) => s.activeTool);
  const drawMode = useSessionStore((s) => s.drawMode);
  const sketchProfile = useSessionStore((s) => s.sketchProfile);
  const sketchTarget = useSessionStore((s) => s.sketchTarget);
  const profileVertexIndex = useSessionStore((s) => s.profileVertexIndex);
  const profileEdgeIndex = useSessionStore((s) => s.profileEdgeIndex);
  const sketchModifyMode = useSessionStore((s) => s.sketchModifyMode);
  const sketchModifyPending = useSessionStore((s) => s.sketchModifyPending);
  const activeWorkplane = useSessionStore((s) => s.activeWorkplane);
  const workplaneLinePending = useSessionStore((s) => s.workplaneLinePending);
  const wallPending = useSessionStore((s) => s.wallPending);
  const wallHover = useSessionStore((s) => s.wallHover);
  const drawPoints = useSessionStore((s) => s.drawPoints);
  const lastSnapKind = useSessionStore((s) => s.lastSnapKind);
  const elevation = activeWorkplane?.origin.z ?? 0;
  const activeCameraEntity = useSessionStore((s) => {
    const v = s.views.find((x) => x.id === s.activeViewId);
    if (v?.kind !== "camera" || !v.cameraId) return null;
    return s.document.cameras.find((c) => c.id === v.cameraId) ?? null;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const viewport = createViewport({
      canvas,
      projection: activeViewKind === "plan" ? "plan" : "perspective",
    });
    handleRef.current = viewport;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      viewport.resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      handleRef.current = null;
      viewport.dispose();
    };
    // Mount once; projection updates via setProjection below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mode = activeViewKind === "plan" ? "plan" : "perspective";
    const vp = handleRef.current;
    if (!vp) return;
    vp.setProjection(mode);
    if (activeViewKind === "camera" && activeCameraEntity) {
      vp.applyModelCamera(activeCameraEntity);
      return;
    }
    const { walls: w } = useSessionStore.getState().document;
    if (w.length) vp.fitWalls(w);
    else vp.fitEmpty();
  }, [fitViewRequest, activeViewId, activeViewKind, activeCameraEntity]);

  useEffect(() => {
    if (!cameraPreset || cameraPresetRequest <= 0) return;
    if (activeViewKind === "camera") return;
    handleRef.current?.setCameraPreset(cameraPreset);
  }, [cameraPresetRequest, cameraPreset, activeViewKind]);

  useEffect(() => {
    if (activeViewKind === "plan" || activeViewKind === "camera") return;
    const vp = handleRef.current;
    if (!vp) return;
    const pivot = resolveOrbitPivot(orbitPivotMode, useSessionStore.getState());
    vp.setOrbitPivot(pivot);
  }, [
    orbitPivotRequest,
    orbitPivotMode,
    activeViewKind,
    documentRev,
    selectedWallId,
    selectedDoorId,
    selectedWindowId,
  ]);

  useEffect(() => {
    if (activeViewKind !== "camera" || !activeCameraEntity) return;
    // While nav-edit is on, keep free look; don't snap back to document pose.
    if (cameraViewNavEdit) return;
    handleRef.current?.applyModelCamera(activeCameraEntity);
  }, [activeViewKind, activeCameraEntity, documentRev, cameraViewNavEdit]);

  // Camera view: lock zoom/orbit until double-click unlocks edit mode.
  useEffect(() => {
    const vp = handleRef.current;
    if (!vp) return;
    if (activeViewKind === "camera") {
      vp.setNavigationEnabled(cameraViewNavEdit);
      if (!cameraViewNavEdit && activeCameraEntity) {
        vp.applyModelCamera(activeCameraEntity);
      }
      return;
    }
    vp.setNavigationEnabled(true);
  }, [activeViewKind, cameraViewNavEdit, activeCameraEntity]);

  useEffect(() => {
    const camerasForSync = cameras.map((c) => {
      let next = c;
      if (cropDragMeta?.cameraId === c.id && cropDragLive) {
        next = { ...next, crop: cropDragLive };
      }
      if (cameraPoseDragLive?.cameraId === c.id) {
        next = {
          ...next,
          eye: { ...cameraPoseDragLive.eye },
          target: { ...cameraPoseDragLive.target },
        };
      }
      return next;
    });
    const activeView = views.find((v) => v.id === activeViewId);
    let sessionCrop = activeView?.kind !== "camera" ? (activeView?.crop ?? null) : null;
    if (cropDragMeta && !cropDragMeta.cameraId && cropDragLive) {
      sessionCrop = cropDragLive;
    }
    // SK-profile: hide document host; H3 show derived solid from provisional (not SoT).
    const hide = new Set(sketchProfile?.sourceWallIds ?? []);
    let wallsForSync =
      hide.size > 0 ? walls.filter((w) => !hide.has(w.id)) : walls;
    let doorsForSync =
      hide.size > 0 ? doors.filter((d) => !hide.has(d.wallId)) : doors;
    let windowsForSync =
      hide.size > 0 ? windows.filter((w) => !hide.has(w.wallId)) : windows;
    let selectedWallForSync = hide.has(selectedWallId ?? "")
      ? null
      : selectedWallId;

    if (
      sketchTarget?.kind === "wall" &&
      sketchProfile &&
      hide.has(sketchTarget.id)
    ) {
      const host = walls.find((w) => w.id === sketchTarget.id);
      if (host) {
        const preview = previewWallFromSketchProfile(host, sketchProfile);
        if (preview) {
          wallsForSync = [...wallsForSync, preview];
          doorsForSync = [
            ...doorsForSync,
            ...doors.filter((d) => d.wallId === host.id),
          ];
          windowsForSync = [
            ...windowsForSync,
            ...windows.filter((w) => w.wallId === host.id),
          ];
          if (selectedWallId === host.id) selectedWallForSync = host.id;
        }
      }
    }

    handleRef.current?.syncWalls(
      wallsForSync,
      doorsForSync,
      windowsForSync,
      camerasForSync,
      selectedWallForSync,
      selectedDoorId,
      selectedWindowId,
      selectedCameraId,
      sessionCrop,
      selectedCropFrameCameraId,
    );
  }, [
    documentRev,
    walls,
    doors,
    windows,
    cameras,
    views,
    activeViewId,
    selectedWallId,
    selectedDoorId,
    selectedWindowId,
    selectedCameraId,
    selectedCropFrameCameraId,
    cropDragLive,
    cropDragMeta,
    cameraPoseDragLive,
    sketchProfile,
    sketchTarget,
  ]);

  useEffect(() => {
    const s = useSessionStore.getState();
    const vp = handleRef.current;
    if (!vp) return;
    const crop = s.getClippingCrop();
    vp.setClippingCrop(crop?.enabled ? crop : null);
  }, [
    activeViewKind,
    documentRev,
    cameras,
    views,
    activeViewId,
    selectedCameraId,
    cropDragLive,
  ]);

  // Camera / free 3D: projected crop matte + corner grips (plan still uses world grips).
  const showCropFrame = useSessionStore((s) => {
    void s.documentRev;
    void s.views;
    void s.activeViewId;
    void s.cropDragLive;
    void s.cropDragMeta;
    if (s.views.find((v) => v.id === s.activeViewId)?.kind === "plan") return false;
    return s.getClippingCrop()?.enabled ?? false;
  });

  const [screenCrop, setScreenCrop] = useState<ScreenCropFrame | null>(null);
  const screenCropViewKeyRef = useRef<string | null>(null);
  const screenCropDraggingRef = useRef(false);

  // Screen matte chrome only (inset 8% init). Does NOT mutate Camera.crop / GPU clip — that stays from plan.
  useEffect(() => {
    if (!showCropFrame) {
      setScreenCrop(null);
      screenCropViewKeyRef.current = null;
      return;
    }
    if (screenCropDraggingRef.current) return;

    const host = hostRef.current;
    const vp = handleRef.current;
    const s = useSessionStore.getState();
    const crop = s.getClippingCrop();
    if (!host || !vp || !crop?.enabled) {
      setScreenCrop(null);
      return;
    }
    const viewKey = `${s.activeViewId}:${crop.enabled}`;
    if (screenCropViewKeyRef.current === viewKey) return;
    screenCropViewKeyRef.current = viewKey;

    const view = s.views.find((v) => v.id === s.activeViewId);
    const cam =
      view?.kind === "camera" && view.cameraId
        ? s.document.cameras.find((c) => c.id === view.cameraId)
        : undefined;
      const activeElev = s.activeWorkplane.origin.z;
      const z = cam ? (cam.eye.z + cam.target.z) / 2 : activeElev + 0.04;
    const hr = host.getBoundingClientRect();
    setScreenCrop(
      buildCameraCropScreenFrame(crop, z, (x, y, wz) => vp.clientFromWorld(x, y, wz), hr),
    );
  }, [showCropFrame, activeViewId, documentRev]);

  useEffect(() => {
    const vp = handleRef.current;
    if (!vp || !activeWorkplane) return;
    const corners = workplanePatchCorners(activeWorkplane);
    vp.setWorkplaneOverlay(
      corners,
      activeWorkplane.origin,
      activeWorkplane.axisU,
      activeWorkplane.axisV,
    );
    if (workplaneLinePending && wallHover) {
      vp.setWorkplaneTrace(workplaneLinePending, wallHover);
    } else {
      vp.setWorkplaneTrace(null, null);
    }
  }, [activeWorkplane, workplaneLinePending, wallHover, documentRev]);

  useEffect(() => {
    const vp = handleRef.current;
    if (!vp) return;
    vp.setPreviewSegment(null, null);
    vp.setPreviewRect(null, null);
    vp.setPreviewPolyline(null);
    const frame = activeWorkplane
      ? {
          normal: activeWorkplane.normal,
          axisU: activeWorkplane.axisU,
          axisV: activeWorkplane.axisV,
        }
      : null;
    if (sketchProfile && sketchProfile.edges.length > 0) {
      const pts = profileToPoints(sketchProfile);
      const verts = profileVertices(sketchProfile);
      vp.setProfilePolyline(
        pts.length >= 2 ? pts : null,
        verts,
        profileVertexIndex,
        frame,
        profileEdgeIndex,
      );
    } else {
      vp.setProfilePolyline(null);
    }

    const rebuild =
      drawMode === "rectangle" || drawMode === "arcSER" || drawMode === "arcCE";
    const modifyGuide =
      sketchModifyPending &&
      wallHover &&
      (sketchModifyMode === "move" ||
        sketchModifyMode === "copy" ||
        sketchModifyMode === "rotate" ||
        sketchModifyMode === "splitLine");

    if (modifyGuide) {
      vp.setPreviewSegment(sketchModifyPending, wallHover);
    } else if (activeTool === "wall" && (!sketchProfile || rebuild)) {
      if (drawMode === "rectangle") {
        vp.setPreviewRect(wallPending, wallHover);
      } else if (drawMode === "arcSER" && drawPoints.length >= 1 && wallHover) {
        if (drawPoints.length === 1) {
          vp.setPreviewSegment(drawPoints[0]!, wallHover);
        } else {
          const poly = sampleArcSER(drawPoints[0]!, drawPoints[1]!, wallHover);
          vp.setPreviewPolyline(poly.length >= 2 ? poly : null);
        }
      } else if (drawMode === "arcCE" && drawPoints.length >= 1 && wallHover) {
        if (drawPoints.length === 1) {
          vp.setPreviewSegment(drawPoints[0]!, wallHover);
        } else {
          const poly = sampleArcCE(drawPoints[0]!, drawPoints[1]!, wallHover);
          vp.setPreviewPolyline(poly.length >= 2 ? poly : null);
        }
      } else if (!sketchProfile) {
        vp.setPreviewSegment(wallPending, wallHover);
      } else if (wallPending && wallHover) {
        // Open provisional / chaining — show segment even with sketchProfile.
        vp.setPreviewSegment(wallPending, wallHover);
      }
    }

    // SK-UX-A: snap cue stays on while editing face profile / Modificar.
    const pendingCue =
      sketchModifyPending ??
      wallPending ??
      drawPoints[drawPoints.length - 1] ??
      null;
    if (activeTool === "wall" && wallHover) {
      vp.setSnapCue(wallHover, lastSnapKind, pendingCue, frame);
    } else if (sketchModifyPending) {
      vp.setSnapCue(sketchModifyPending, "endpoint", null, frame);
    } else {
      vp.setSnapCue(null, "none", null, frame);
    }
  }, [
    wallPending,
    wallHover,
    lastSnapKind,
    activeTool,
    drawMode,
    drawPoints,
    sketchProfile,
    profileVertexIndex,
    profileEdgeIndex,
    sketchModifyMode,
    sketchModifyPending,
    activeWorkplane,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let cropDragging = false;

    let profileDragging = false;
    /** True only after pointer moved while dragging a profile vertex. */
    let profileDragMoved = false;

    const onPointerMove = (e: PointerEvent) => {
      const s = useSessionStore.getState();
      if (cropDragging || s.cropDragMeta) {
        // Plan world grips only — camera/3D CSS grips resize in their own handlers.
        const view = s.views.find((v) => v.id === s.activeViewId);
        if (view?.kind === "plan") {
          const p = handleRef.current?.pickGround(e.clientX, e.clientY, elevation);
          if (p) s.updateCropDrag(p.x, p.y);
        }
        return;
      }
      if (profileDragging && s.sketchProfile && s.profileVertexIndex != null) {
        const vpDrag = handleRef.current;
        if (!vpDrag) return;
        const p = pickOnWorkplane(vpDrag, e.clientX, e.clientY, s.activeWorkplane);
        if (p) {
          profileDragMoved = true;
          s.profileVertexDragTo(p, e.shiftKey);
        }
        return;
      }
      if (profileDragging && s.sketchProfile && s.profileEdgeIndex != null) {
        const vpDrag = handleRef.current;
        if (!vpDrag) return;
        const p = pickOnWorkplane(vpDrag, e.clientX, e.clientY, s.activeWorkplane);
        if (p) {
          profileDragMoved = true;
          s.profileEdgeDragTo(p, e.shiftKey);
        }
        return;
      }
      if (
        s.activeTool !== "wall" &&
        s.activeTool !== "camera" &&
        s.activeTool !== "workplaneLine"
      ) {
        return;
      }
      const vpMove = handleRef.current;
      if (!vpMove) return;
      const p =
        s.activeTool === "workplaneLine" || s.activeTool === "wall"
          ? pickOnWorkplane(vpMove, e.clientX, e.clientY, s.activeWorkplane)
          : vpMove.pickGround(e.clientX, e.clientY, elevation);
      if (p) s.setWallHover(p, e.shiftKey);
    };

    const onPointerUp = () => {
      if (profileDragging) {
        profileDragging = false;
        // Click (no move) keeps the grip selected for a second click-to-place.
        // Drag-move commits and clears the selection.
        if (profileDragMoved) {
          const st = useSessionStore.getState();
          if (st.profileEdgeIndex != null) st.endProfileEdgeDrag();
          else st.endProfileVertexDrag();
        }
        profileDragMoved = false;
        return;
      }
      if (!cropDragging && !useSessionStore.getState().cropDragMeta) return;
      cropDragging = false;
      useSessionStore.getState().commitCropDrag();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const s = useSessionStore.getState();
      const vp = handleRef.current;
      if (!vp) return;

      if (s.activeTool === "workplaneSelect") {
        const wallId = vp.pickWallId(e.clientX, e.clientY);
        const hint = pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane) ?? undefined;
        s.workplaneSelectClick(wallId, hint);
        return;
      }

      // H1: Modificar / sketch provisional before selection fallthrough
      // (activeTool may briefly be "select" while sketchTarget is still set).
      const sketchModifyLive =
        Boolean(s.sketchTarget) &&
        Boolean(s.sketchProfile) &&
        s.sketchModifyMode !== "vertex" &&
        s.sketchModifyMode !== "redraw";
      const sketchWall =
        Boolean(s.sketchTarget) && Boolean(s.sketchProfile) && s.activeTool === "wall";

      /** H4: surface missed Workplane picks instead of silent return. */
      const reportWpMiss = () => {
        if (
          shouldReportWorkplanePickMiss({
            sketchTarget: Boolean(s.sketchTarget),
            sketchModifyLive,
            activeTool: s.activeTool,
          })
        ) {
          s.setStatus(WORKPLANE_PICK_MISS_STATUS);
        }
      };

      if (s.activeTool === "workplaneLine") {
        const p = pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane);
        if (p) s.workplaneLineClick(p);
        else reportWpMiss();
        return;
      }

      if (sketchModifyLive || sketchWall) {
        const rebuild =
          s.drawMode === "rectangle" ||
          s.drawMode === "arcSER" ||
          s.drawMode === "arcCE";
        if (!rebuild && s.drawMode !== "pickFace") {
          const p = pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane);
          if (!p) {
            reportWpMiss();
            return;
          }
          const hit = hitProfileVertex(s.sketchProfile!, p);
          const edgeHit = hitProfileEdge(s.sketchProfile!, p);
          const route = routeSketchWallPointer({
            sketchModifyMode: s.sketchModifyMode,
            profileVertexIndex: s.profileVertexIndex,
            profileEdgeIndex: s.profileEdgeIndex,
            hitVertexIndex: hit,
            hitEdgeIndex: edgeHit,
            drawMode: s.drawMode,
          });
          if (route === "wallClick") {
            s.wallClick(p, e.shiftKey);
            return;
          }
          if (route === "profileVertexPlace") {
            s.profileVertexClick(p, e.shiftKey);
            profileDragging = false;
            profileDragMoved = false;
            return;
          }
          if (route === "profileEdgePlace") {
            s.profileEdgeClick(p, e.shiftKey);
            profileDragging = false;
            profileDragMoved = false;
            return;
          }
          if (route === "profileVertexSelect") {
            s.profileVertexClick(p, e.shiftKey);
            profileDragging = true;
            profileDragMoved = false;
            host.setPointerCapture?.(e.pointerId);
            return;
          }
          if (route === "profileEdgeSelect") {
            s.profileEdgeClick(p, e.shiftKey);
            profileDragging = true;
            profileDragMoved = false;
            host.setPointerCapture?.(e.pointerId);
            return;
          }
          return;
        }
        if (s.activeTool === "wall") {
          if (s.drawMode === "pickLines" || s.drawMode === "pickFace") {
            const wallId = vp.pickWallId(e.clientX, e.clientY);
            if (wallId) {
              const hint =
                pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane) ??
                undefined;
              s.wallPickClick(wallId, hint ?? undefined);
              return;
            }
            if (s.drawMode === "pickLines" && s.wallPending) {
              const p = pickOnWorkplane(
                vp,
                e.clientX,
                e.clientY,
                s.activeWorkplane,
              );
              if (p) s.wallClick(p, e.shiftKey);
              else reportWpMiss();
              return;
            }
            s.setStatus("Clic en un muro (modo pick)");
            return;
          }
          const p = pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane);
          if (p) s.wallClick(p, e.shiftKey);
          else reportWpMiss();
          return;
        }
        return;
      }

      if (s.activeTool === "wall") {
        if (s.drawMode === "pickLines" || s.drawMode === "pickFace") {
          const wallId = vp.pickWallId(e.clientX, e.clientY);
          if (wallId) {
            const hint =
              pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane) ?? undefined;
            s.wallPickClick(wallId, hint ?? undefined);
            return;
          }
          if (s.drawMode === "pickLines" && s.wallPending) {
            const p = pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane);
            if (p) s.wallClick(p, e.shiftKey);
            else reportWpMiss();
            return;
          }
          s.setStatus("Clic en un muro (modo pick)");
          return;
        }
        const p = pickOnWorkplane(vp, e.clientX, e.clientY, s.activeWorkplane);
        if (p) s.wallClick(p, e.shiftKey);
        else reportWpMiss();
        return;
      }

      if (s.activeTool === "camera") {
        const p = vp.pickGround(e.clientX, e.clientY, elevation);
        if (p) s.cameraClick(p);
        return;
      }

      if (s.activeTool === "door") {
        const wallId = vp.pickWallId(e.clientX, e.clientY);
        if (!wallId) {
          s.setStatus("Clic en un muro para colocar la puerta");
          return;
        }
        const p = vp.pickGround(e.clientX, e.clientY, elevation);
        if (p) s.placeDoorOnWall(wallId, p);
        return;
      }

      if (s.activeTool === "window") {
        const wallId = vp.pickWallId(e.clientX, e.clientY);
        if (!wallId) {
          s.setStatus("Clic en un muro para colocar la ventana");
          return;
        }
        const p = vp.pickGround(e.clientX, e.clientY, elevation);
        if (p) s.placeWindowOnWall(wallId, p);
        return;
      }

      const cropGrip = vp.pickCropGrip(e.clientX, e.clientY);
      if (cropGrip) {
        cropDragging = true;
        if (cropGrip.cameraId) {
          s.setSelectedCropFrameCameraId(cropGrip.cameraId);
        }
        s.beginCropDrag(cropGrip.cameraId, cropGrip.corner);
        host.setPointerCapture?.(e.pointerId);
        return;
      }

      const cropFrame = vp.pickCropFrame(e.clientX, e.clientY);
      if (cropFrame) {
        const already = s.selectedCropFrameCameraId === cropFrame.cameraId;
        s.setSelectedCropFrameCameraId(cropFrame.cameraId);
        if (already) {
          const p = vp.pickGround(e.clientX, e.clientY, elevation);
          if (p) {
            cropDragging = true;
            s.beginCameraFrameMove(cropFrame.cameraId, p.x, p.y);
            host.setPointerCapture?.(e.pointerId);
          }
        }
        return;
      }

      const flip = vp.pickFlipControl(e.clientX, e.clientY);
      if (flip?.entityType === "door") {
        s.setSelectedDoorId(flip.entityId);
        if (flip.kind === "swing") s.flipSelectedDoorSwing();
        else s.flipSelectedDoorHinge();
        return;
      }
      if (flip?.entityType === "window") {
        s.setSelectedWindowId(flip.entityId);
        if (flip.kind === "swing") s.flipSelectedWindowSwing();
        else s.flipSelectedWindowHinge();
        return;
      }

      const cameraId = vp.pickCameraId(e.clientX, e.clientY);
      if (cameraId) {
        s.setSelectedCameraId(cameraId);
        return;
      }
      const windowId = vp.pickWindowId(e.clientX, e.clientY);
      if (windowId) {
        s.setSelectedWindowId(windowId);
        return;
      }
      const doorId = vp.pickDoorId(e.clientX, e.clientY);
      if (doorId) {
        s.setSelectedDoorId(doorId);
        return;
      }
      const id = vp.pickWallId(e.clientX, e.clientY);
      s.setSelectedWallId(id);
    };

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    return () => {
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
    };
  }, [elevation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) {
        return;
      }
      const s = useSessionStore.getState();
      if (e.key === "Escape") {
        if (s.cropDragMeta) {
          s.cancelCropDrag();
          return;
        }
        if (s.cameraViewNavEdit) {
          s.setCameraViewNavEdit(false);
          return;
        }
        if (s.sketchTarget) {
          if (s.wallPending) s.cancelWallDraw();
          else s.exitSketchOnSelection();
          return;
        }
        s.cancelWallDraw();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedCameraId) {
          e.preventDefault();
          s.deleteSelectedCamera();
          return;
        }
        if (s.selectedDoorId) {
          e.preventDefault();
          s.deleteSelectedDoor();
          return;
        }
        if (s.selectedWindowId) {
          e.preventDefault();
          s.deleteSelectedWindow();
          return;
        }
        if (s.selectedWallId) {
          e.preventDefault();
          s.deleteSelectedWall();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.runRedo();
        else s.runUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.runRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const drawing =
    activeTool === "wall" || activeTool === "door" || activeTool === "window";
  const snapLabel =
    lastSnapKind === "endpoint"
      ? "snap extremo"
      : lastSnapKind === "ortho"
        ? "snap orto"
        : lastSnapKind === "close"
          ? "snap cierre"
          : activeTool === "wall"
            ? "sin snap"
            : activeTool === "door"
              ? "clic en muro"
              : activeTool === "window"
                ? "clic en muro"
                : "";

  const onViewportDoubleClick = (e: {
    clientX: number;
    clientY: number;
    preventDefault: () => void;
  }) => {
    const host = hostRef.current;
    const vp = handleRef.current;
    const s = useSessionStore.getState();

    // SK-sel / ADR 0018: double-click wall face in elevación/3D → vertical profile sketch.
    if (vp) {
      const hit = vp.pickWallHit(e.clientX, e.clientY, s.document.walls);
      if (hit) {
        e.preventDefault();
        s.enterSketchOnElement("wall", hit.wallId, {
          face: hit.face,
          hitPoint: hit.point,
        });
        return;
      }
      const doorId = vp.pickDoorId(e.clientX, e.clientY);
      if (doorId) {
        e.preventDefault();
        s.setSelectedDoorId(doorId);
        s.enterSketchOnSelection();
        return;
      }
      const windowId = vp.pickWindowId(e.clientX, e.clientY);
      if (windowId) {
        e.preventDefault();
        s.setSelectedWindowId(windowId);
        s.enterSketchOnSelection();
        return;
      }
    }

    // Camera view: double-click toggles temporary nav edit (existing C3 behavior).
    if (activeViewKind !== "camera") return;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const lx = e.clientX - hr.left;
    const ly = e.clientY - hr.top;
    const inside = screenCrop
      ? lx >= screenCrop.left &&
        lx <= screenCrop.left + screenCrop.width &&
        ly >= screenCrop.top &&
        ly <= screenCrop.top + screenCrop.height
      : isInsideCameraViewFrame(lx, ly, hr.width, hr.height, showCropFrame);
    if (!inside) return;
    e.preventDefault();
    s.setCameraViewNavEdit(!cameraViewNavEdit);
  };

  // Grips only while camera nav is locked (not in temporary zoom/orbit edit).
  const cropGripsEnabled =
    showCropFrame && !(activeViewKind === "camera" && cameraViewNavEdit);

  const startScreenCornerDrag = (
    e: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void },
    frame: ScreenCropFrame,
    gripLocal: { left: number; top: number },
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropGripsEnabled) return;
    const host = hostRef.current;
    if (!host) return;
    const s = useSessionStore.getState();
    if (s.cameraViewNavEdit && s.views.find((v) => v.id === s.activeViewId)?.kind === "camera") {
      return;
    }

    const oppLocal = {
      left: gripLocal.left <= 1 ? frame.width : 0,
      top: gripLocal.top <= 1 ? frame.height : 0,
    };
    const hr = host.getBoundingClientRect();
    const oppClient = {
      x: hr.left + frame.left + oppLocal.left,
      y: hr.top + frame.top + oppLocal.top,
    };

    // CSS matte only — never beginCropDrag / Camera.crop (alcance de planta intacto).
    screenCropDraggingRef.current = true;
    const onMove = (ev: PointerEvent) => {
      const curClient = { x: ev.clientX, y: ev.clientY };
      setScreenCrop((prev) =>
        screenFrameFromCornerDrag(prev ?? frame, hr, oppClient, curClient),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      screenCropDraggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={drawing ? "viewport viewport--draw" : "viewport"}
      ref={hostRef}
      onDoubleClick={onViewportDoubleClick}
    >
      <canvas ref={canvasRef} className="viewport__canvas" />
      {showCropFrame && screenCrop && (
        <div
          className={
            cameraViewNavEdit
              ? "viewport__crop-frame viewport__crop-frame--screen viewport__crop-frame--nav-edit"
              : "viewport__crop-frame viewport__crop-frame--screen"
          }
          style={{
            left: screenCrop.left,
            top: screenCrop.top,
            width: screenCrop.width,
            height: screenCrop.height,
          }}
          title={
            cameraViewNavEdit
              ? "Edición de vista — Esc o doble clic para salir"
              : "Marco de vista · arrastre esquinas (no cambia crop de planta) · doble clic = zoom/órbita"
          }
        >
          {cropGripsEnabled &&
            screenCrop.corners.map((c) => {
              const cursorClass =
                (c.left <= 1 && c.top <= 1) ||
                (c.left >= screenCrop.width - 1 && c.top >= screenCrop.height - 1)
                  ? "viewport__crop-grip--nwse"
                  : "viewport__crop-grip--nesw";
              return (
                <button
                  key={`${c.corner}-${c.left}-${c.top}`}
                  type="button"
                  className={`viewport__crop-grip ${cursorClass}`}
                  style={{ left: c.left, top: c.top }}
                  aria-label={`Redimensionar marco de vista esquina ${c.corner as CropCorner}`}
                  onPointerDown={(e) => startScreenCornerDrag(e, screenCrop, c)}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              );
            })}
        </div>
      )}
      {showCropFrame && !screenCrop && (
        <div
          className={
            cameraViewNavEdit
              ? "viewport__crop-frame viewport__crop-frame--nav-edit"
              : "viewport__crop-frame"
          }
          aria-hidden
          title="Límite de recorte de vista"
        />
      )}
      <ViewOrientationGizmo
        visible={activeViewKind === "perspective"}
        onOrbit={(dx, dy) => handleRef.current?.orbitByDelta(dx, dy)}
      />
      <div className="viewport__hint" aria-hidden>
        {activeViewKind === "plan"
          ? "planta · rueda zoom · clic medio pan · grips · cámaras"
          : activeViewKind === "camera"
            ? cameraViewNavEdit
              ? "vista cámara · edición zoom/órbita · Esc o doble clic = salir (sin grips)"
              : "vista cámara · marco CSS (crop = planta) · doble clic = zoom/órbita"
            : "3D · grips de crop · rueda zoom · medio/der orbitar · gizmo · hold = órbita"}
        {" · "}
        {visualStyle}
        {drawing ? ` · muro · ${snapLabel}` : snapLabel ? ` · ${snapLabel}` : ""}
      </div>
    </div>
  );
}
