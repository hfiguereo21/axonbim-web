/**
 * SK-wall-profile-v1 Bloque 6B — Modify toolkit on provisional sketch (snap + Workplane).
 */
import { projectPointOntoWorkplane, type Workplane } from "@axonbim/model";
import {
  clearProfileEdges,
  copyProfileTranslated,
  deleteProfileVertex,
  filletProfileVertex,
  hitProfileVertex,
  moveProfileVertex,
  offsetProfileInPlane,
  profileVertices,
  rotateProfileAboutAxis,
  splitProfileAtPoint,
  splitProfileEdgeByLine,
  translateProfile,
  translateProfileEdge,
  type SketchPoint,
} from "@axonbim/tools";
import type { SessionSliceCreator } from "./sliceTypes.js";

export type SketchModifyMode =
  | "vertex"
  | "move"
  | "rotate"
  | "splitPoint"
  | "splitLine"
  | "fillet"
  | "copy"
  | "offset"
  | "redraw";

/** Default equidistant offset (metres) for Desfase one-click. */
export const SKETCH_OFFSET_DISTANCE = 0.15;

function ontoWp(wp: Workplane, p: SketchPoint): SketchPoint {
  return projectPointOntoWorkplane(wp, p);
}

function clearDrawPartial(): Partial<{
  wallPending: null;
  wallHover: null;
  drawPoints: [];
  lastSnapKind: "none";
}> {
  return {
    wallPending: null,
    wallHover: null,
    drawPoints: [],
    lastSnapKind: "none",
  };
}

const H3_HINT = "preview en viewport · Terminar confirma en el documento";

function modifyStatus(mode: SketchModifyMode): string {
  switch (mode) {
    case "move":
      return `Mover — origen→destino (arista/vértice seleccionado o bucle) · ${H3_HINT}`;
    case "rotate":
      return `Rotar perfil — clic pivote → dirección (${H3_HINT})`;
    case "splitPoint":
      return `Split point — clic en arista (${H3_HINT})`;
    case "splitLine":
      return `Split line — 2 clics que crucen aristas (${H3_HINT})`;
    case "fillet":
      return `Fillet — clic en vértice, radio 0,15 m (${H3_HINT})`;
    case "copy":
      return `Copiar — clic origen → destino (${H3_HINT})`;
    case "offset":
      return `Desfase — clic ±${SKETCH_OFFSET_DISTANCE} m, Shift = contraer (${H3_HINT})`;
    case "redraw":
      return "Redibujar";
    default:
      return `Sketch — editar vértices / aristas (${H3_HINT})`;
  }
}

export const createSketchModifySlice: SessionSliceCreator<{
  sketchModifyMode: SketchModifyMode;
  /** First click for move/rotate/copy/splitLine. */
  sketchModifyPending: SketchPoint | null;
  setSketchModifyMode: (mode: SketchModifyMode) => void;
  redrawSketchProfile: () => void;
  sketchModifyClick: (raw: SketchPoint, forceOrtho?: boolean) => void;
  deleteSelectedProfileVertex: () => void;
}> = (set, get) => ({
  sketchModifyMode: "vertex",
  sketchModifyPending: null,

  setSketchModifyMode: (mode) => {
    const s = get();
    if (!s.sketchTarget) {
      set({
        status:
          "Activa Sketch (Editar perfil) para usar Modificar sobre el provisional",
      });
      return;
    }
    if (mode === "redraw") {
      get().redrawSketchProfile();
      return;
    }
    // Keep edge/vertex selection for Mover; clear only pending.
    const clearSel = mode !== "move" && mode !== "copy";
    set({
      sketchModifyMode: mode,
      sketchModifyPending: null,
      profileVertexIndex: clearSel ? null : s.profileVertexIndex,
      profileEdgeIndex: clearSel ? null : s.profileEdgeIndex,
      activeTool: "wall",
      ...clearDrawPartial(),
      status: modifyStatus(mode),
    });
  },

  redrawSketchProfile: () => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile) {
      set({ status: "No hay perfil sketch para redibujar" });
      return;
    }
    set({
      sketchProfile: clearProfileEdges(s.sketchProfile),
      sketchProfileStroke: false,
      sketchModifyMode: "vertex",
      sketchModifyPending: null,
      profileVertexIndex: null,
      profileEdgeIndex: null,
      drawMode: "rectangle",
      activeTool: "wall",
      ...clearDrawPartial(),
      status:
        "Redibujar — provisional vacío · Rect/línea/arco en el Workplane · Terminar aplica",
    });
  },

  deleteSelectedProfileVertex: () => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile || s.profileVertexIndex == null) {
      set({ status: "Selecciona un vértice del perfil para eliminar" });
      return;
    }
    const next = deleteProfileVertex(s.sketchProfile, s.profileVertexIndex);
    if (!next) {
      set({
        status:
          "No se puede eliminar — el bucle quedaría inválido (< 3 vértices)",
      });
      return;
    }
    set({
      sketchProfile: next,
      profileVertexIndex: null,
      profileEdgeIndex: null,
      status: `Vértice eliminado · ${H3_HINT}`,
    });
  },

  sketchModifyClick: (raw, forceOrtho = false) => {
    const s = get();
    if (!s.sketchTarget || !s.sketchProfile) return;
    const wp = s.activeWorkplane;
    const p = ontoWp(wp, raw);
    const mode = s.sketchModifyMode;

    if (mode === "vertex" || mode === "redraw") return;

    if (mode === "splitPoint") {
      const before = profileVertices(s.sketchProfile).length;
      const next = splitProfileAtPoint(s.sketchProfile, p);
      const after = profileVertices(next).length;
      if (after <= before) {
        set({
          sketchModifyPending: null,
          status:
            "Split point — sin cambio (clic en el medio de una arista, no en un vértice)",
        });
        return;
      }
      set({
        sketchProfile: next,
        sketchModifyPending: null,
        profileEdgeIndex: null,
        status: `Split point — vértice insertado · ${H3_HINT}`,
      });
      return;
    }

    if (mode === "fillet") {
      const idx = hitProfileVertex(s.sketchProfile, p);
      if (idx < 0) {
        set({ status: "Fillet — clic cerca de un vértice" });
        return;
      }
      const next = filletProfileVertex(s.sketchProfile, idx, 0.15);
      if (!next) {
        set({ status: "Fillet — radio demasiado grande para esa esquina" });
        return;
      }
      set({
        sketchProfile: next,
        profileEdgeIndex: null,
        status: `Fillet aplicado · ${H3_HINT}`,
      });
      return;
    }

    if (mode === "splitLine") {
      if (!s.sketchModifyPending) {
        set({
          sketchModifyPending: p,
          status: "Split line — clic 2: fin de la traza (snap en Workplane)",
        });
        return;
      }
      const next = splitProfileEdgeByLine(
        s.sketchProfile,
        s.sketchModifyPending,
        p,
      );
      set({
        sketchProfile: next ?? s.sketchProfile,
        sketchModifyPending: null,
        profileEdgeIndex: next ? null : s.profileEdgeIndex,
        status: next
          ? `Split line — aristas divididas · ${H3_HINT}`
          : "Split line — sin intersección con el perfil",
      });
      return;
    }

    if (mode === "move" || mode === "copy") {
      if (!s.sketchModifyPending) {
        const sel =
          mode === "move" && s.profileEdgeIndex != null
            ? ` (arista ${s.profileEdgeIndex + 1})`
            : mode === "move" && s.profileVertexIndex != null
              ? ` (vértice ${s.profileVertexIndex + 1})`
              : " (bucle completo)";
        set({
          sketchModifyPending: p,
          status:
            mode === "move"
              ? `Mover${sel} — clic 2: destino (snap)`
              : "Copiar — clic 2: destino del desplazamiento",
        });
        return;
      }
      const delta = {
        x: p.x - s.sketchModifyPending.x,
        y: p.y - s.sketchModifyPending.y,
        z: p.z - s.sketchModifyPending.z,
      };
      const mag = Math.hypot(delta.x, delta.y, delta.z);
      if (mag < 1e-9) {
        set({
          sketchModifyPending: null,
          status: "Mover — destino igual al origen (sin cambio)",
        });
        return;
      }

      // Sin inicializador: las cuatro ramas de abajo (copy, arista, vértice y
      // el else) asignan `next` antes de usarlo, así que el valor inicial era
      // código muerto.
      let next: typeof s.sketchProfile;
      let label = "Perfil movido";
      if (mode === "copy") {
        next = copyProfileTranslated(s.sketchProfile, delta);
        label = "Copia desplazada";
      } else if (s.profileEdgeIndex != null) {
        const edged = translateProfileEdge(
          s.sketchProfile,
          s.profileEdgeIndex,
          delta,
        );
        if (!edged) {
          set({
            sketchModifyPending: null,
            status: "Mover arista — índice inválido",
          });
          return;
        }
        next = edged;
        label = `Arista ${s.profileEdgeIndex + 1} movida`;
      } else if (s.profileVertexIndex != null) {
        const from = profileVertices(s.sketchProfile)[s.profileVertexIndex];
        if (!from) {
          set({ sketchModifyPending: null, status: "Mover vértice — índice inválido" });
          return;
        }
        const moved = moveProfileVertex(s.sketchProfile, s.profileVertexIndex, {
          x: from.x + delta.x,
          y: from.y + delta.y,
          z: from.z + delta.z,
        });
        if (!moved) {
          set({
            sketchModifyPending: null,
            status: "No se pudo mover el vértice",
          });
          return;
        }
        next = moved;
        label = `Vértice ${s.profileVertexIndex + 1} movido`;
      } else {
        next = translateProfile(s.sketchProfile, delta);
      }

      set({
        sketchProfile: next,
        sketchModifyPending: null,
        status: `${label} · ${H3_HINT}`,
      });
      return;
    }

    if (mode === "rotate") {
      if (!s.sketchModifyPending) {
        set({
          sketchModifyPending: p,
          status: "Rotar — clic 2: dirección del ángulo (pivote = clic 1)",
        });
        return;
      }
      const pivot = s.sketchModifyPending;
      const ax = p.x - pivot.x;
      const ay = p.y - pivot.y;
      const az = p.z - pivot.z;
      const u =
        ax * wp.axisU.x + ay * wp.axisU.y + az * wp.axisU.z;
      const v =
        ax * wp.axisV.x + ay * wp.axisV.y + az * wp.axisV.z;
      const angle = Math.atan2(v, u);
      if (Math.abs(angle) < 1e-6) {
        set({
          sketchModifyPending: null,
          status: "Rotar — ángulo ~0° (sin cambio)",
        });
        return;
      }
      const next = rotateProfileAboutAxis(
        s.sketchProfile,
        pivot,
        wp.normal,
        angle,
      );
      set({
        sketchProfile: next,
        sketchModifyPending: null,
        profileEdgeIndex: null,
        status: `Rotado ${((angle * 180) / Math.PI).toFixed(1)}° · ${H3_HINT}`,
      });
      return;
    }

    if (mode === "offset") {
      const dist = forceOrtho
        ? -SKETCH_OFFSET_DISTANCE
        : SKETCH_OFFSET_DISTANCE;
      const next = offsetProfileInPlane(
        s.sketchProfile,
        {
          origin: wp.origin,
          axisU: wp.axisU,
          axisV: wp.axisV,
        },
        dist,
      );
      if (!next) {
        set({
          status:
            "Desfase — no aplicable (bucle cerrado requerido / arista degenerada)",
        });
        return;
      }
      set({
        sketchProfile: next,
        profileEdgeIndex: null,
        status: `Desfase ${dist > 0 ? "+" : ""}${dist.toFixed(2)} m · ${H3_HINT}`,
      });
    }
  },
});
