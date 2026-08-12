import { describe, expect, it } from "vitest";
import { routeSketchWallPointer } from "./sketchPointerRoute";

describe("routeSketchWallPointer", () => {
  it("routes Modificar modes to wallClick even on vertex hit", () => {
    for (const mode of [
      "move",
      "copy",
      "rotate",
      "splitPoint",
      "splitLine",
      "fillet",
    ] as const) {
      expect(
        routeSketchWallPointer({
          sketchModifyMode: mode,
          profileVertexIndex: null,
          profileEdgeIndex: null,
          hitVertexIndex: 2,
          hitEdgeIndex: -1,
          drawMode: "line",
        }),
      ).toBe("wallClick");
    }
  });

  it("keeps grip select when modify mode is vertex", () => {
    expect(
      routeSketchWallPointer({
        sketchModifyMode: "vertex",
        profileVertexIndex: null,
        profileEdgeIndex: null,
        hitVertexIndex: 1,
        hitEdgeIndex: -1,
        drawMode: "line",
      }),
    ).toBe("profileVertexSelect");
  });

  it("places selected vertex before draw fallthrough", () => {
    expect(
      routeSketchWallPointer({
        sketchModifyMode: "vertex",
        profileVertexIndex: 0,
        profileEdgeIndex: null,
        hitVertexIndex: -1,
        hitEdgeIndex: -1,
        drawMode: "line",
      }),
    ).toBe("profileVertexPlace");
  });

  it("SK-UX-B: selects edge when no vertex hit", () => {
    expect(
      routeSketchWallPointer({
        sketchModifyMode: "vertex",
        profileVertexIndex: null,
        profileEdgeIndex: null,
        hitVertexIndex: -1,
        hitEdgeIndex: 2,
        drawMode: "line",
      }),
    ).toBe("profileEdgeSelect");
  });

  it("SK-UX-B: places selected edge before Línea miss clear", () => {
    expect(
      routeSketchWallPointer({
        sketchModifyMode: "vertex",
        profileVertexIndex: null,
        profileEdgeIndex: 1,
        hitVertexIndex: -1,
        hitEdgeIndex: -1,
        drawMode: "line",
      }),
    ).toBe("profileEdgePlace");
  });
});
