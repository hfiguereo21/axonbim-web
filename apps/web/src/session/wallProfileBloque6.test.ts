import { describe, expect, it } from "vitest";
import { wallMaxHeightOf } from "@axonbim/model";
import { profileFromClosedRing } from "@axonbim/tools";
import { useSessionStore } from "./createSessionStore";
import { worldRingToWallVertical } from "./worldRingToWallVertical";

function enterFaceSketch(wallId: string, face: "front" | "back" = "front") {
  useSessionStore.getState().setActiveView("view.3d.perspective");
  useSessionStore.getState().enterSketchOnElement("wall", wallId, { face });
}

describe("SK-wall-profile-v1 Bloque 6", () => {
  it("worldRingToWallVertical maps face rectangle to uniform", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    const h = wallMaxHeightOf(wall);
    const vertical = worldRingToWallVertical(wall, [
      { x: 0, y: half, z: 0 },
      { x: 4, y: half, z: 0 },
      { x: 4, y: half, z: h },
      { x: 0, y: half, z: h },
    ]);
    expect(vertical).toEqual({ kind: "uniform", height: h });
  });

  it("Terminar on face keeps same wallId (in-place profile)", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wall = useSessionStore.getState().document.walls[0]!;
    const half = wall.thickness / 2;
    const oldId = wall.id;
    enterFaceSketch(oldId);

    // Sloped top: still reaches u=0 and u=4.
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

  it("split point and move work on provisional with Workplane", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    const before = useSessionStore.getState().sketchProfile!.edges.length;

    useSessionStore.getState().setSketchModifyMode("splitPoint");
    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;
    useSessionStore.getState().wallClick({ x: 2, y: half, z: 0 });
    expect(
      useSessionStore.getState().sketchProfile!.edges.length,
    ).toBeGreaterThan(before);

    useSessionStore.getState().setSketchModifyMode("move");
    useSessionStore.getState().setSnapEnabled(false);
    useSessionStore.getState().wallClick({ x: 0, y: half, z: 0 });
    useSessionStore.getState().wallClick({ x: 0, y: half, z: 0.25 });
    const zs = useSessionStore
      .getState()
      .sketchProfile!.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    expect(Math.min(...zs)).toBeGreaterThan(0.1);
  });

  it("H1: after setTool(select), Modificar still transforms provisional", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;

    // Zombie path: Seleccionar left activeTool on select while sketch still open.
    useSessionStore.getState().setTool("select");
    expect(useSessionStore.getState().activeTool).toBe("select");
    expect(useSessionStore.getState().sketchTarget).not.toBeNull();

    useSessionStore.getState().setSketchModifyMode("move");
    expect(useSessionStore.getState().activeTool).toBe("wall");
    useSessionStore.getState().setSnapEnabled(false);
    useSessionStore.getState().wallClick({ x: 0, y: half, z: 0 });
    useSessionStore.getState().wallClick({ x: 0, y: half, z: 0.3 });
    const zs = useSessionStore
      .getState()
      .sketchProfile!.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    expect(Math.min(...zs)).toBeGreaterThan(0.15);
  });

  it("SK-UX-A: Línea does not append onto closed result seed", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    const edgesBefore = useSessionStore.getState().sketchProfile!.edges.length;
    useSessionStore.getState().setDrawMode("line");
    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;
    useSessionStore.getState().wallClick({ x: 1, y: half, z: 1 });
    useSessionStore.getState().wallClick({ x: 2, y: half, z: 1.5 });
    const s = useSessionStore.getState();
    expect(s.sketchProfile!.edges.length).toBe(edgesBefore);
    expect(s.status).toMatch(/Redibujar|vértices|Split/i);
  });

  it("SK-UX-B: select edge and Mover translates that edge only", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;
    useSessionStore.getState().selectProfileEdge(0);
    expect(useSessionStore.getState().profileEdgeIndex).toBe(0);

    useSessionStore.getState().setSketchModifyMode("move");
    useSessionStore.getState().setSnapEnabled(false);
    useSessionStore.getState().wallClick({ x: 0, y: half, z: 0 });
    useSessionStore.getState().wallClick({ x: 0, y: half, z: 0.4 });
    expect(useSessionStore.getState().status).toMatch(/Arista 1 movida/i);
    const zs = useSessionStore
      .getState()
      .sketchProfile!.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    expect(Math.min(...zs)).toBeGreaterThan(0.15);
  });

  it("SK-UX-B: second click projects selected edge without Mover ribbon", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;
    useSessionStore.getState().setSnapEnabled(false);
    useSessionStore.getState().setDrawMode("line");
    // Select bottom edge via mid hit, then place (was clearing selection before).
    useSessionStore.getState().wallClick({ x: 2, y: half, z: 0.02 });
    expect(useSessionStore.getState().profileEdgeIndex).toBe(0);
    useSessionStore.getState().wallClick({ x: 2, y: half, z: 0.5 });
    expect(useSessionStore.getState().status).toMatch(/proyectada|Arista/i);
    expect(useSessionStore.getState().profileEdgeIndex).toBeNull();
    const zs = useSessionStore
      .getState()
      .sketchProfile!.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    expect(Math.min(...zs)).toBeGreaterThan(0.2);
  });

  it("H2: Desfase offsets closed face profile in Workplane UV", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().setTool("wall");
    useSessionStore.getState().wallClick({ x: 0, y: 0, z: 0 });
    useSessionStore.getState().wallClick({ x: 4, y: 0, z: 0 });
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    enterFaceSketch(wallId);
    const before = useSessionStore.getState().sketchProfile!;
    const zsBefore = before.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    const zMaxBefore = Math.max(...zsBefore);

    const half = useSessionStore.getState().document.walls[0]!.thickness / 2;
    useSessionStore.getState().setSketchModifyMode("offset");
    useSessionStore.getState().wallClick({ x: 2, y: half, z: 1 });
    const after = useSessionStore.getState().sketchProfile!;
    const zs = after.edges.flatMap((e) => [e.p1.z, e.p2.z]);
    expect(Math.max(...zs)).toBeGreaterThan(zMaxBefore + 0.1);
  });

  it("Redibujar clears provisional edges only", () => {
    useSessionStore.getState().newProject();
    useSessionStore.getState().openDemo();
    const wallId = useSessionStore.getState().document.walls[0]!.id;
    const wallsBefore = useSessionStore.getState().document.walls.length;
    enterFaceSketch(wallId);
    useSessionStore.getState().redrawSketchProfile();
    const s = useSessionStore.getState();
    expect(s.sketchTarget?.id).toBe(wallId);
    expect(s.sketchProfile?.edges).toHaveLength(0);
    expect(s.document.walls).toHaveLength(wallsBefore);
  });
});
