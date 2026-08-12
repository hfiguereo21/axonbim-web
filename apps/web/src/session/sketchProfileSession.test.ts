import { describe, expect, it } from "vitest";
import { wallMaxHeightOf } from "@axonbim/model";
import { profileFromClosedRing, profileVertices } from "@axonbim/tools";
import { useSessionStore } from "./createSessionStore";

/** Bloque 5: vertical profile entry requires perspective + face. */
function enterFaceSketch(wallId: string, face: "front" | "back" = "front") {
  useSessionStore.getState().setActiveView("view.3d.perspective");
  useSessionStore.getState().enterSketchOnElement("wall", wallId, { face });
}

describe("SK-replace — provisional free profile → new walls", () => {
  it("loads host face outline (length × height), not the axis", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().setDrawMode("line");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 3, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;

    enterFaceSketch(wall.id);
    const s = useSessionStore.getState();
    expect(s.sketchProfile).not.toBeNull();
    expect(s.sketchProfile?.semantic).toBe("result");
    expect(s.sketchProfile?.edges).toHaveLength(4);
    expect(s.sketchProfile?.closed).toBe(true);
    expect(s.sketchProfile?.sourceWallIds).toEqual([wall.id]);
    expect(s.activeWorkplane.kind).toBe("surface");
    const zs = s.sketchProfile!.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(wallMaxHeightOf(wall), 5);
    expect(s.document.walls).toHaveLength(1);
  });

  it("SK-UX-A: miss grip with line on closed seed does not append", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 3, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    expect(useSessionStore.getState().sketchProfile?.edges).toHaveLength(4);

    useSessionStore.getState().setDrawMode("line");
    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;
    // Interior face point (not on an edge) — must not append.
    useSessionStore.getState().wallClick({ x: 1.5, y: half, z: 1.2 });
    useSessionStore.getState().wallClick({ x: 2.0, y: half, z: 1.5 });
    const s = useSessionStore.getState();
    expect(s.sketchProfile!.edges).toHaveLength(4);
    expect(s.status).toMatch(/Redibujar|vértices|Split|arista/i);
    expect(s.document.walls).toHaveLength(1);
  });

  it("moves one vertex freely on the face without constraining the rectangle", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 2, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    enterFaceSketch(wall.id);

    // Top-right corner of face rectangle ≈ (2, +half, height)
    const h = wallMaxHeightOf(wall);
    useSessionStore.getState().profileVertexClick({ x: 2, y: half, z: h });
    useSessionStore.getState().profileVertexClick({ x: 2, y: half, z: h + 0.8 });

    expect(useSessionStore.getState().document.walls).toHaveLength(1);
    expect(useSessionStore.getState().document.walls[0]!.id).toBe(wall.id);

    const verts = profileVertices(useSessionStore.getState().sketchProfile!);
    const moved = verts.find(
      (v) => Math.abs(v.x - 2) < 1e-5 && Math.abs(v.z - (h + 0.8)) < 1e-5,
    );
    expect(moved).toBeTruthy();
  });

  it("Terminar replaces host: lengthened face keeps same id when valid", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    const h = wallMaxHeightOf(wall);
    const oldId = wall.id;
    enterFaceSketch(oldId);

    // Taller uniform rectangle on same length (in-place).
    useSessionStore.setState({
      sketchProfile: profileFromClosedRing(
        [
          { x: 0, y: half, z: 0 },
          { x: 4, y: half, z: 0 },
          { x: 4, y: half, z: h + 0.4 },
          { x: 0, y: half, z: h + 0.4 },
        ],
        [oldId],
        true,
      ),
    });

    useSessionStore.getState().finishSketchOnSelection();
    const after = useSessionStore.getState();
    expect(after.sketchTarget).toBeNull();
    expect(after.document.walls).toHaveLength(1);
    const next = after.document.walls[0]!;
    expect(next.id).toBe(oldId);
    expect(wallMaxHeightOf(next)).toBeCloseTo(h + 0.4, 2);
  });

  it("skewed face silhouette Terminar keeps same wallId (in-place profile)", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    const oldId = wall.id;
    enterFaceSketch(oldId);

    useSessionStore.setState({
      sketchProfile: profileFromClosedRing(
        [
          { x: 0, y: half, z: 0 },
          { x: 4, y: half, z: 0 },
          { x: 4, y: half, z: 2.0 },
          { x: 0, y: half, z: 3.0 },
        ],
        [oldId],
        true,
      ),
    });
    useSessionStore.getState().finishSketchOnSelection();

    const after = useSessionStore.getState();
    expect(after.document.walls).toHaveLength(1);
    expect(after.document.walls[0]!.id).toBe(oldId);
    expect(after.document.walls[0]!.vertical.kind).toBe("profile");
    expect(after.sketchTarget).toBeNull();
  });

  it("WP-01: enter sketch from plan is rejected (doc intact)", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 2, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    const before = structuredClone(useSessionStore.getState().document);
    useSessionStore.getState().setActiveView("view.plan.level1");
    useSessionStore.getState().enterSketchOnElement("wall", wallId, { face: "front" });
    const s = useSessionStore.getState();
    expect(s.sketchTarget).toBeNull();
    expect(s.status).toMatch(/planta/i);
    expect(s.document.walls).toEqual(before.walls);
  });

  it("invalid short profile does not mutate on Terminar", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 2, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);

    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;
    // SK-UX-A: Rect only after Redibujar clears the closed seed.
    useSessionStore.getState().redrawSketchProfile();
    useSessionStore.getState().setDrawMode("rectangle");
    useSessionStore.getState().wallClick({ x: 0, y: half, z: 0 });
    useSessionStore.getState().wallClick({ x: 0.02, y: half, z: 0.02 });

    const before = structuredClone(useSessionStore.getState().document.walls[0]!);
    useSessionStore.getState().finishSketchOnSelection();
    const s = useSessionStore.getState();
    expect(s.document.walls[0]!.p1.x).toBeCloseTo(before.p1.x);
    expect(s.document.walls[0]!.p2.x).toBeCloseTo(before.p2.x);
    expect(s.sketchProfile).not.toBeNull();
  });

  it("rectangle rebuild on face stays provisional until Terminar (same id)", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().setDrawMode("line");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    const h = wallMaxHeightOf(wall);
    enterFaceSketch(wall.id);
    expect(useSessionStore.getState().sketchProfile?.semantic).toBe("result");

    useSessionStore.setState({
      sketchProfile: profileFromClosedRing(
        [
          { x: 0, y: half, z: 0 },
          { x: 4, y: half, z: 0 },
          { x: 4, y: half, z: h + 0.5 },
          { x: 0, y: half, z: h + 0.5 },
        ],
        [wall.id],
        true,
      ),
    });
    expect(useSessionStore.getState().document.walls).toHaveLength(1);

    useSessionStore.getState().finishSketchOnSelection();
    const next = useSessionStore.getState().document.walls[0]!;
    expect(next.id).toBe(wall.id);
    expect(wallMaxHeightOf(next)).toBeCloseTo(h + 0.5, 2);
  });
  it("Terminar without host mutation keeps the sketch profile", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 2, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    useSessionStore.getState().finishSketchOnSelection();
    const s = useSessionStore.getState();
    expect(s.sketchTarget?.id).toBe(wallId);
    expect(s.sketchProfile).not.toBeNull();
    expect(s.status).toMatch(/Sin cambios/i);
    expect(s.document.walls[0]!.id).toBe(wallId);
  });

  it("WP-02/03: face opts / surface WP seed length × height", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    useSessionStore.getState().setActiveView("view.3d.perspective");
    useSessionStore.getState().setWorkplaneFromSurface(wall.id, "front");
    useSessionStore.getState().enterSketchOnElement("wall", wall.id);
    const s = useSessionStore.getState();
    expect(s.activeWorkplane.kind).toBe("surface");
    expect(s.activeWorkplane.host?.face).toBe("front");
    expect(s.sketchProfile?.edges).toHaveLength(4);
    expect(s.sketchProfile?.semantic).toBe("result");
    const zs = s.sketchProfile!.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(wallMaxHeightOf(wall), 5);
  });

  it("vertex place snaps to another face corner", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    const h = wallMaxHeightOf(wall);
    enterFaceSketch(wall.id);

    useSessionStore.getState().profileVertexClick({ x: 4, y: half, z: h });
    useSessionStore.getState().profileVertexClick({
      x: 0.05,
      y: half,
      z: h + 0.02,
    });
    const verts = useSessionStore
      .getState()
      .sketchProfile!.edges.flatMap((e) => [e.p1, e.p2]);
    const atOriginTop = verts.some(
      (v) => Math.abs(v.x) < 1e-5 && Math.abs(v.z - h) < 1e-5,
    );
    const kind = useSessionStore.getState().lastSnapKind;
    expect(kind === "endpoint" || atOriginTop).toBe(true);
  });

  it("cancel discards provisional edits", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 2, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    const h = wallMaxHeightOf(wall);
    enterFaceSketch(wall.id);
    useSessionStore.getState().profileVertexClick({ x: 2, y: half, z: h });
    useSessionStore.getState().profileVertexClick({ x: 2, y: half, z: h + 1 });
    useSessionStore.getState().exitSketchOnSelection();
    expect(useSessionStore.getState().document.walls[0]!.p2.x).toBeCloseTo(2);
    expect(useSessionStore.getState().document.walls[0]!.id).toBe(wall.id);
    expect(useSessionStore.getState().sketchProfile).toBeNull();
  });
});
