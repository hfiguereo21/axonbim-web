/**
 * Undo of a delete restores position, not just presence.
 *
 * The four Delete*Command dropped the entity with `filter` and put it back
 * with `push`, so undoing a delete moved the entity to the end of its array.
 * Document order is observable — camera tabs, project browser, `.axon`
 * round-trip — so an undo that reorders is an undo that did not undo.
 */
import { describe, expect, it } from "vitest";
import {
  createEmptyDocument,
  defaultCameraCrop,
  type Camera,
  type Door,
  type Wall,
  type Window,
} from "@axonbim/model";
import {
  DeleteCameraCommand,
  DeleteDoorCommand,
  DeleteWallCommand,
  DeleteWindowCommand,
} from "./index";

function wall(id: string, partial: Partial<Wall> = {}): Wall {
  return {
    id,
    storeyId: "storey.default",
    familyId: "family.block-150",
    p1: { x: 0, y: 0, z: 0 },
    p2: { x: 6, y: 0, z: 0 },
    thickness: 0.15,
    vertical: { kind: "uniform", height: 2.7 },
    ...partial,
  };
}

function door(id: string, wallId: string, centerOffset: number): Door {
  return {
    id,
    wallId,
    familyId: "family.door-90",
    centerOffset,
    width: 0.9,
    height: 2.1,
    sill: 0,
    hinge: "start",
    swing: "positive",
    leafState: "open",
  };
}

function windowAt(id: string, wallId: string, centerOffset: number): Window {
  return {
    id,
    wallId,
    familyId: "family.window-90x120",
    centerOffset,
    width: 0.9,
    height: 1.2,
    sill: 0.9,
    hinge: "start",
    swing: "positive",
    leafState: "closed",
  };
}

function camera(id: string, name: string): Camera {
  const eye = { x: 0, y: 0, z: 1.7 };
  const target = { x: 4, y: 0, z: 1.7 };
  return { id, name, eye, target, fov: 45, crop: defaultCameraCrop(eye, target, 45) };
}

const ids = (list: readonly { id: string }[]): string[] => list.map((e) => e.id);

describe("delete + undo restores document order", () => {
  it("camera deleted from the middle returns to the middle", () => {
    const doc = createEmptyDocument("t");
    doc.cameras = [camera("cam.1", "A"), camera("cam.2", "B"), camera("cam.3", "C")];

    const cmd = new DeleteCameraCommand("cam.2");
    expect(cmd.execute(doc).ok).toBe(true);
    expect(ids(doc.cameras)).toEqual(["cam.1", "cam.3"]);

    cmd.undo(doc);
    expect(ids(doc.cameras)).toEqual(["cam.1", "cam.2", "cam.3"]);
  });

  it("door deleted from the front returns to the front", () => {
    const doc = createEmptyDocument();
    doc.walls = [wall("wall.1")];
    doc.doors = [door("door.1", "wall.1", 1), door("door.2", "wall.1", 3), door("door.3", "wall.1", 5)];

    const cmd = new DeleteDoorCommand("door.1");
    expect(cmd.execute(doc).ok).toBe(true);
    expect(ids(doc.doors)).toEqual(["door.2", "door.3"]);

    cmd.undo(doc);
    expect(ids(doc.doors)).toEqual(["door.1", "door.2", "door.3"]);
  });

  it("window deleted from the end returns to the end", () => {
    const doc = createEmptyDocument();
    doc.walls = [wall("wall.1")];
    doc.windows = [
      windowAt("win.1", "wall.1", 1),
      windowAt("win.2", "wall.1", 3),
      windowAt("win.3", "wall.1", 5),
    ];

    const cmd = new DeleteWindowCommand("win.3");
    expect(cmd.execute(doc).ok).toBe(true);
    cmd.undo(doc);
    expect(ids(doc.windows)).toEqual(["win.1", "win.2", "win.3"]);
  });

  it("wall deleted from the middle restores itself and interleaves its openings back", () => {
    const doc = createEmptyDocument();
    doc.walls = [wall("wall.1"), wall("wall.2"), wall("wall.3")];
    // Openings of wall.2 sit between openings of the walls that survive, so a
    // naive undo would append them after door.4 / win.4 instead of interleaving.
    doc.doors = [
      door("door.1", "wall.1", 1),
      door("door.2", "wall.2", 1),
      door("door.3", "wall.2", 3),
      door("door.4", "wall.3", 1),
    ];
    doc.windows = [
      windowAt("win.1", "wall.1", 4),
      windowAt("win.2", "wall.2", 4),
      windowAt("win.3", "wall.3", 4),
    ];

    const cmd = new DeleteWallCommand("wall.2");
    expect(cmd.execute(doc).ok).toBe(true);
    expect(ids(doc.walls)).toEqual(["wall.1", "wall.3"]);
    expect(ids(doc.doors)).toEqual(["door.1", "door.4"]);
    expect(ids(doc.windows)).toEqual(["win.1", "win.3"]);

    cmd.undo(doc);
    expect(ids(doc.walls)).toEqual(["wall.1", "wall.2", "wall.3"]);
    expect(ids(doc.doors)).toEqual(["door.1", "door.2", "door.3", "door.4"]);
    expect(ids(doc.windows)).toEqual(["win.1", "win.2", "win.3"]);
  });

  it("two deletes undone in history order (reverse) restore the original order", () => {
    const doc = createEmptyDocument("t");
    doc.cameras = [
      camera("cam.1", "A"),
      camera("cam.2", "B"),
      camera("cam.3", "C"),
      camera("cam.4", "D"),
    ];

    const first = new DeleteCameraCommand("cam.2");
    const second = new DeleteCameraCommand("cam.4");
    expect(first.execute(doc).ok).toBe(true);
    expect(second.execute(doc).ok).toBe(true);
    expect(ids(doc.cameras)).toEqual(["cam.1", "cam.3"]);

    // HistoryStack undoes newest first.
    second.undo(doc);
    first.undo(doc);
    expect(ids(doc.cameras)).toEqual(["cam.1", "cam.2", "cam.3", "cam.4"]);
  });

  it("redo after undo deletes the same entity and undoes back into place", () => {
    const doc = createEmptyDocument();
    doc.walls = [wall("wall.1")];
    doc.doors = [door("door.1", "wall.1", 1), door("door.2", "wall.1", 3), door("door.3", "wall.1", 5)];

    const cmd = new DeleteDoorCommand("door.2");
    expect(cmd.execute(doc).ok).toBe(true);
    cmd.undo(doc);
    expect(ids(doc.doors)).toEqual(["door.1", "door.2", "door.3"]);

    expect(cmd.execute(doc).ok).toBe(true);
    expect(ids(doc.doors)).toEqual(["door.1", "door.3"]);
    cmd.undo(doc);
    expect(ids(doc.doors)).toEqual(["door.1", "door.2", "door.3"]);
  });

  it("entity identity survives the round trip, not just its position", () => {
    const doc = createEmptyDocument();
    doc.walls = [wall("wall.1"), wall("wall.2", { thickness: 0.3 })];

    const cmd = new DeleteWallCommand("wall.1");
    expect(cmd.execute(doc).ok).toBe(true);
    cmd.undo(doc);

    expect(doc.walls[0].id).toBe("wall.1");
    expect(doc.walls[0].thickness).toBe(0.15);
    expect(doc.walls[1].thickness).toBe(0.3);
  });
});
