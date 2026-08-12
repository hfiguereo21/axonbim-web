import { describe, expect, it } from "vitest";
import { profileFromClosedRing, profileVertices } from "./sketchProfile.js";
import {
  clearProfileEdges,
  deleteProfileVertex,
  filletProfileVertex,
  hitProfileEdge,
  offsetProfile,
  offsetProfileInPlane,
  rotateProfile,
  rotateProfileAboutAxis,
  splitProfileAtPoint,
  splitProfileEdgeByLine,
  profileEdgeMidpoint,
  translateProfile,
  translateProfileEdge,
} from "./sketchProfileEdit.js";

const z = 0;

function rect(): ReturnType<typeof profileFromClosedRing> {
  return profileFromClosedRing(
    [
      { x: 0, y: 0, z },
      { x: 4, y: 0, z },
      { x: 4, y: 3, z },
      { x: 0, y: 3, z },
    ],
    ["wall.seed"],
    true,
  );
}

describe("sketchProfileEdit", () => {
  it("hitProfileEdge finds the closest segment", () => {
    const p = rect();
    expect(hitProfileEdge(p, { x: 2, y: 0.01, z })).toBe(0);
    expect(hitProfileEdge(p, { x: 4.01, y: 1.5, z })).toBe(1);
    expect(hitProfileEdge(p, { x: 100, y: 100, z })).toBe(-1);
    expect(profileEdgeMidpoint(p, 0)).toEqual({ x: 2, y: 0, z });
  });

  it("splitProfileAtPoint inserts a vertex on an edge", () => {
    const p = rect();
    const split = splitProfileAtPoint(p, { x: 2, y: 0, z });
    const verts = profileVertices(split);
    expect(verts).toHaveLength(5);
    expect(verts[1]).toEqual({ x: 2, y: 0, z });
    expect(split.closed).toBe(true);
    expect(split.sourceWallIds).toEqual(["wall.seed"]);
    expect(split.semantic).toBe("result");
  });

  it("splitProfileAtPoint is a no-op near an existing vertex", () => {
    const p = rect();
    const same = splitProfileAtPoint(p, { x: 0.01, y: 0, z });
    expect(profileVertices(same)).toHaveLength(4);
    expect(same.edges).toHaveLength(4);
  });

  it("splitProfileEdgeByLine splits crossed edges", () => {
    const p = rect();
    // Horizontal cut through mid-height: crosses left and right vertical edges
    const next = splitProfileEdgeByLine(
      p,
      { x: -1, y: 1.5, z },
      { x: 5, y: 1.5, z },
    );
    expect(next).not.toBeNull();
    const verts = profileVertices(next!);
    expect(verts).toHaveLength(6);
    expect(verts.some((v) => Math.abs(v.x - 4) < 1e-9 && Math.abs(v.y - 1.5) < 1e-9)).toBe(
      true,
    );
    expect(verts.some((v) => Math.abs(v.x) < 1e-9 && Math.abs(v.y - 1.5) < 1e-9)).toBe(
      true,
    );
  });

  it("splitProfileEdgeByLine returns null when the line misses", () => {
    const p = rect();
    expect(
      splitProfileEdgeByLine(
        p,
        { x: -1, y: -1, z },
        { x: -0.5, y: -0.5, z },
      ),
    ).toBeNull();
  });

  it("translateProfile moves all vertices", () => {
    const p = translateProfile(rect(), { x: 10, y: -2, z: 1 });
    const verts = profileVertices(p);
    expect(verts[0]).toEqual({ x: 10, y: -2, z: 1 });
    expect(verts[2]).toEqual({ x: 14, y: 1, z: 1 });
  });

  it("translateProfileEdge moves only one edge", () => {
    const next = translateProfileEdge(rect(), 0, { x: 0, y: -1, z: 0 });
    expect(next).not.toBeNull();
    const verts = profileVertices(next!);
    expect(verts[0]).toEqual({ x: 0, y: -1, z });
    expect(verts[1]).toEqual({ x: 4, y: -1, z });
    expect(verts[2]).toEqual({ x: 4, y: 3, z });
    expect(verts[3]).toEqual({ x: 0, y: 3, z });
  });

  it("rotateProfile about Z around pivot", () => {
    const p = rotateProfile(
      profileFromClosedRing(
        [
          { x: 1, y: 0, z },
          { x: 2, y: 0, z },
          { x: 2, y: 1, z },
          { x: 1, y: 1, z },
        ],
        [],
        true,
      ),
      { x: 0, y: 0, z },
      Math.PI / 2,
    );
    const verts = profileVertices(p);
    expect(verts[0]!.x).toBeCloseTo(0);
    expect(verts[0]!.y).toBeCloseTo(1);
    expect(verts[1]!.x).toBeCloseTo(0);
    expect(verts[1]!.y).toBeCloseTo(2);
  });

  it("rotateProfileAboutAxis matches Z rotation", () => {
    const base = rect();
    const a = rotateProfile(base, { x: 2, y: 1.5, z }, Math.PI / 4);
    const b = rotateProfileAboutAxis(
      base,
      { x: 2, y: 1.5, z },
      { x: 0, y: 0, z: 1 },
      Math.PI / 4,
    );
    const va = profileVertices(a);
    const vb = profileVertices(b);
    for (let i = 0; i < va.length; i++) {
      expect(va[i]!.x).toBeCloseTo(vb[i]!.x);
      expect(va[i]!.y).toBeCloseTo(vb[i]!.y);
      expect(va[i]!.z).toBeCloseTo(vb[i]!.z);
    }
  });

  it("filletProfileVertex chamfers a corner", () => {
    const p = rect();
    const filleted = filletProfileVertex(p, 0, 0.5);
    expect(filleted).not.toBeNull();
    const verts = profileVertices(filleted!);
    expect(verts).toHaveLength(5);
    // Corner (0,0) replaced by points on adjacent edges
    expect(verts.some((v) => v.x === 0 && v.y === 0)).toBe(false);
    expect(verts.some((v) => Math.abs(v.x - 0.5) < 1e-9 && Math.abs(v.y) < 1e-9)).toBe(
      true,
    );
    expect(verts.some((v) => Math.abs(v.x) < 1e-9 && Math.abs(v.y - 0.5) < 1e-9)).toBe(
      true,
    );
  });

  it("filletProfileVertex rejects radius larger than edges", () => {
    expect(filletProfileVertex(rect(), 0, 10)).toBeNull();
  });

  it("deleteProfileVertex removes a corner", () => {
    const p = deleteProfileVertex(rect(), 1);
    expect(p).not.toBeNull();
    expect(profileVertices(p!)).toHaveLength(3);
    expect(p!.closed).toBe(true);
  });

  it("deleteProfileVertex rejects below 3 on a closed loop", () => {
    const tri = profileFromClosedRing(
      [
        { x: 0, y: 0, z },
        { x: 2, y: 0, z },
        { x: 1, y: 2, z },
      ],
      [],
      true,
    );
    expect(deleteProfileVertex(tri, 0)).toBeNull();
  });

  it("offsetProfile expands an axis-aligned rectangle", () => {
    const p = offsetProfile(rect(), 1);
    expect(p).not.toBeNull();
    const verts = profileVertices(p!);
    expect(verts).toHaveLength(4);
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    expect(Math.min(...xs)).toBeCloseTo(-1);
    expect(Math.max(...xs)).toBeCloseTo(5);
    expect(Math.min(...ys)).toBeCloseTo(-1);
    expect(Math.max(...ys)).toBeCloseTo(4);
  });

  it("offsetProfile returns null for non-rectangle", () => {
    const tri = profileFromClosedRing(
      [
        { x: 0, y: 0, z },
        { x: 2, y: 0, z },
        { x: 1, y: 2, z },
      ],
      [],
      true,
    );
    expect(offsetProfile(tri, 0.5)).toBeNull();
  });

  it("offsetProfileInPlane expands a vertical-face rectangle (U/V)", () => {
    const frame = {
      origin: { x: 0, y: 0.075, z: 0 },
      axisU: { x: 1, y: 0, z: 0 },
      axisV: { x: 0, y: 0, z: 1 },
    };
    const face = profileFromClosedRing(
      [
        { x: 0, y: 0.075, z: 0 },
        { x: 4, y: 0.075, z: 0 },
        { x: 4, y: 0.075, z: 2.7 },
        { x: 0, y: 0.075, z: 2.7 },
      ],
      ["wall.1"],
      true,
    );
    const next = offsetProfileInPlane(face, frame, 0.15);
    expect(next).not.toBeNull();
    const verts = profileVertices(next!);
    const zs = verts.map((v) => v.z);
    const xs = verts.map((v) => v.x);
    expect(Math.min(...xs)).toBeCloseTo(-0.15);
    expect(Math.max(...xs)).toBeCloseTo(4.15);
    expect(Math.min(...zs)).toBeCloseTo(-0.15);
    expect(Math.max(...zs)).toBeCloseTo(2.85);
  });

  it("clearProfileEdges empties edges and keeps sourceWallIds", () => {
    const cleared = clearProfileEdges(rect());
    expect(cleared.edges).toEqual([]);
    expect(cleared.closed).toBe(false);
    expect(cleared.sourceWallIds).toEqual(["wall.seed"]);
    expect(cleared.semantic).toBe("result");
  });
});
