/**
 * Viewport routing for sketch clicks on a provisional profile.
 * Modificar tools must beat grip/vertex edit (otherwise UI never calls sketchModifyClick).
 */
export type SketchPointerRoute =
  | "wallClick"
  | "profileVertexPlace"
  | "profileVertexSelect"
  | "profileEdgePlace"
  | "profileEdgeSelect"
  | "none";

export function routeSketchWallPointer(opts: {
  sketchModifyMode: string;
  profileVertexIndex: number | null;
  profileEdgeIndex: number | null;
  hitVertexIndex: number;
  hitEdgeIndex: number;
  drawMode: string;
}): SketchPointerRoute {
  // Bloque 6B — Modificar (move/rotate/split/fillet/copy/…)
  if (
    opts.sketchModifyMode &&
    opts.sketchModifyMode !== "vertex" &&
    opts.sketchModifyMode !== "redraw"
  ) {
    return "wallClick";
  }

  if (opts.profileVertexIndex != null) return "profileVertexPlace";
  // SK-UX-B: selected edge places/drags like a vertex (no silent clear on Línea).
  if (opts.profileEdgeIndex != null) return "profileEdgePlace";
  if (opts.hitVertexIndex >= 0) return "profileVertexSelect";
  if (opts.hitEdgeIndex >= 0) return "profileEdgeSelect";
  if (opts.drawMode === "line" || opts.drawMode === "pickLines") {
    return "wallClick";
  }
  // Miss grip in non-draw modes: clear / no-op via profileVertexClick.
  return "profileVertexPlace";
}
