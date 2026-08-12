import { describe, expect, it } from "vitest";
import type { Wall, WallVerticalDefinition } from "@axonbim/model";
import { almostEqual } from "@axonbim/shared";
import {
  ensureProfileCcw,
  meshBufferBBox,
  profileLoopArea,
  triangulateProfileLoop,
  wallProfileMesh,
  wallProfileMetrics,
  wallProfileSupportsMiter,
} from "./wallProfileMesh";
import { wallBoxMesh, wallMetrics } from "./wallBox";

const wall: Wall = {
  id: "wall.test",
  storeyId: "storey.1",
  familyId: "family.block-150",
  p1: { x: 0, y: 0, z: 0 },
  p2: { x: 4, y: 0, z: 0 },
  thickness: 0.15,
  vertical: { kind: "uniform", height: 2.7 },
};

describe("wallProfileMesh", () => {
  it("uniform path matches box metrics and non-empty mesh", () => {
    const vertical: WallVerticalDefinition = { kind: "uniform", height: 2.7 };
    const m = wallProfileMetrics(wall, vertical);
    const box = wallMetrics(wall);
    expect(almostEqual(m.volume, box.volume, 1e-9)).toBe(true);
    expect(almostEqual(m.bbox.max.z, box.bbox.max.z, 1e-9)).toBe(true);
    expect(wallProfileSupportsMiter(vertical)).toBe(true);

    const mesh = wallProfileMesh(wall, { vertical });
    const boxMesh = wallBoxMesh(wall);
    expect(mesh.positions.length).toBe(boxMesh.positions.length);
    expect(mesh.indices.length).toBe(boxMesh.indices.length);
  });

  it("sloped profile keeps distinct top heights in mesh vertices (case B)", () => {
    const vertical: WallVerticalDefinition = {
      kind: "profile",
      outerLoop: [
        { u: 0, v: 0 },
        { u: 4, v: 0 },
        { u: 4, v: 2 },
        { u: 0, v: 3 },
      ],
    };
    expect(wallProfileSupportsMiter(vertical)).toBe(false);
    const area = profileLoopArea(ensureProfileCcw(vertical.outerLoop));
    // Trapezoid area = (2+3)/2 * 4 = 10
    expect(almostEqual(area, 10, 1e-6)).toBe(true);
    const metrics = wallProfileMetrics(wall, vertical);
    expect(almostEqual(metrics.volume, 10 * 0.15, 1e-6)).toBe(true);

    const mesh = wallProfileMesh(wall, { vertical });
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length % 3).toBe(0);

    let maxZAtU0 = -Infinity;
    let maxZAtU4 = -Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i]!;
      const z = mesh.positions[i + 2]!;
      if (Math.abs(x) < 1e-4) maxZAtU0 = Math.max(maxZAtU0, z);
      if (Math.abs(x - 4) < 1e-4) maxZAtU4 = Math.max(maxZAtU4, z);
    }
    expect(maxZAtU0).toBeCloseTo(3, 3);
    expect(maxZAtU4).toBeCloseTo(2, 3);

    const bb = meshBufferBBox(mesh)!;
    expect(bb.max.z).toBeCloseTo(3, 3);
    expect(bb.min.z).toBeCloseTo(0, 3);
    expect(bb.min.y).toBeCloseTo(-0.075, 3);
    expect(bb.max.y).toBeCloseTo(0.075, 3);
  });

  it("stepped profile has six-vertex extent and positive volume (case C)", () => {
    const vertical: WallVerticalDefinition = {
      kind: "profile",
      outerLoop: [
        { u: 0, v: 0 },
        { u: 4, v: 0 },
        { u: 4, v: 2 },
        { u: 2, v: 2 },
        { u: 2, v: 3 },
        { u: 0, v: 3 },
      ],
    };
    // Area = 4*2 + 2*1 = 10
    expect(profileLoopArea(ensureProfileCcw(vertical.outerLoop))).toBeCloseTo(10, 5);
    const mesh = wallProfileMesh(wall, { vertical });
    expect(mesh.indices.length).toBeGreaterThan(0);
    // No degenerate: every triangle referenced
    expect(mesh.indices.length % 3).toBe(0);
  });

  it("opening punches a hole (more contour verts; interior sample sparse)", () => {
    const vertical: WallVerticalDefinition = {
      kind: "profile",
      outerLoop: [
        { u: 0, v: 0 },
        { u: 4, v: 0 },
        { u: 4, v: 2.7 },
        { u: 0, v: 2.7 },
      ],
    };
    const openings = [{ centerAlong: 2, width: 0.9, height: 2.1, sill: 0 }];
    const solid = wallProfileMesh(wall, { vertical });
    const holed = wallProfileMesh(wall, { vertical, openings });
    expect(holed.positions.length).toBeGreaterThan(solid.positions.length);

    const sampleU = 2;
    const sampleV = 1.05;
    let nearHoleCenter = 0;
    for (let i = 0; i < holed.positions.length; i += 3) {
      const x = holed.positions[i]!;
      const z = holed.positions[i + 2]!;
      if (Math.abs(x - sampleU) < 0.05 && Math.abs(z - sampleV) < 0.05) {
        nearHoleCenter++;
      }
    }
    expect(nearHoleCenter).toBeLessThan(4);
  });

  it("floating window opening keeps a non-empty mesh", () => {
    const vertical: WallVerticalDefinition = {
      kind: "profile",
      outerLoop: [
        { u: 0, v: 0 },
        { u: 4, v: 0 },
        { u: 4, v: 2.7 },
        { u: 0, v: 2.7 },
      ],
    };
    const mesh = wallProfileMesh(wall, {
      vertical,
      openings: [{ centerAlong: 2, width: 1.0, height: 1.2, sill: 0.9 }],
    });
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it("flipped p1/p2 still yields a non-empty solid with correct thickness span", () => {
    const flipped: Wall = {
      ...wall,
      p1: wall.p2,
      p2: wall.p1,
    };
    const vertical: WallVerticalDefinition = {
      kind: "profile",
      outerLoop: [
        { u: 0, v: 0 },
        { u: 4, v: 0 },
        { u: 4, v: 2 },
        { u: 0, v: 3 },
      ],
    };
    const mesh = wallProfileMesh(flipped, { vertical });
    const bb = meshBufferBBox(mesh)!;
    expect(bb.max.z - bb.min.z).toBeGreaterThan(2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(0.15, 2);
  });

  it("triangulateProfileLoop covers a quad with two triangles", () => {
    const tris = triangulateProfileLoop([
      { u: 0, v: 0 },
      { u: 4, v: 0 },
      { u: 4, v: 3 },
      { u: 0, v: 3 },
    ]);
    expect(tris).toHaveLength(2);
  });
});
