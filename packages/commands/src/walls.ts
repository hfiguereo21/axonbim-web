import type { AxonDocument, Door, Wall, WallVerticalDefinition, Window } from "@axonbim/model";
import {
  asOpeningSpec,
  cloneWallVertical,
  documentRefs,
  openingsOnWall,
  validateHostedOpening,
  validateOpeningInsideWallProfile,
  validateWall,
  validateWallVerticalDefinition,
  wallLength,
  wallVerticalEquals,
  wallVerticalFromHeight,
} from "@axonbim/model";
import { restoreAll, restoreAt, snapshotRemoved, type Removed } from "./restoreOrder";
import { CHANGED, NOOP, rejected, type Command, type CommandResult } from "./types";

export type { Command } from "./types";
export { HistoryStack } from "./history";

function almostEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

let wallSeq = 0;

export function resetWallIdSeq(n = 0): void {
  wallSeq = n;
}

export function createWallId(): string {
  wallSeq += 1;
  return `wall.${wallSeq}`;
}

function notFound(wallId: string): CommandResult {
  return rejected({ code: "wall.notFound", message: `wall ${wallId}: not found` });
}

/** Validates the wall as it would look after the change. */
function checkWall(doc: AxonDocument, candidate: Wall): CommandResult | null {
  const issue = validateWall(candidate, documentRefs(doc));
  return issue ? rejected(issue) : null;
}

export class CreateWallCommand implements Command {
  readonly id: string;
  readonly type = "wall.create";
  constructor(private readonly wall: Wall) {
    this.id = `cmd.create.${wall.id}`;
  }

  execute(doc: AxonDocument): CommandResult {
    if (doc.walls.some((w) => w.id === this.wall.id)) {
      return rejected({
        code: "wall.duplicateId",
        message: `wall ${this.wall.id}: id already exists`,
      });
    }
    const invalid = checkWall(doc, this.wall);
    if (invalid) return invalid;
    doc.walls.push({
      ...this.wall,
      p1: { ...this.wall.p1 },
      p2: { ...this.wall.p2 },
      vertical: cloneWallVertical(this.wall.vertical),
    });
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    doc.walls = doc.walls.filter((w) => w.id !== this.wall.id);
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class DeleteWallCommand implements Command {
  readonly id: string;
  readonly type = "wall.delete";
  private snapshot: Wall | null = null;
  private index = 0;
  private doorSnapshots: Removed<Door>[] = [];
  private windowSnapshots: Removed<Window>[] = [];

  constructor(private readonly wallId: string) {
    this.id = `cmd.delete.${wallId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const index = doc.walls.findIndex((w) => w.id === this.wallId);
    if (index < 0) return notFound(this.wallId);
    const found = doc.walls[index];
    this.snapshot = {
      ...found,
      p1: { ...found.p1 },
      p2: { ...found.p2 },
      vertical: cloneWallVertical(found.vertical),
    };
    this.index = index;
    // Openings of this wall can sit anywhere in the arrays, so each one keeps
    // its own index: undo has to interleave them back among the openings of
    // the walls that were never deleted.
    this.doorSnapshots = snapshotRemoved(
      doc.doors,
      (d) => d.wallId === this.wallId,
      (d) => ({ ...d }),
    );
    this.windowSnapshots = snapshotRemoved(
      doc.windows,
      (w) => w.wallId === this.wallId,
      (w) => ({ ...w }),
    );
    doc.walls = doc.walls.filter((w) => w.id !== this.wallId);
    doc.doors = doc.doors.filter((d) => d.wallId !== this.wallId);
    doc.windows = doc.windows.filter((w) => w.wallId !== this.wallId);
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    if (!this.snapshot) return;
    restoreAt(doc.walls, this.index, {
      ...this.snapshot,
      p1: { ...this.snapshot.p1 },
      p2: { ...this.snapshot.p2 },
      vertical: cloneWallVertical(this.snapshot.vertical),
    });
    restoreAll(
      doc.doors,
      this.doorSnapshots.map(({ index, item }) => ({ index, item: { ...item } })),
    );
    restoreAll(
      doc.windows,
      this.windowSnapshots.map(({ index, item }) => ({ index, item: { ...item } })),
    );
    doc.meta.updatedAt = new Date().toISOString();
  }
}

/** SK-profile — update wall axis in place (preserves id / openings when they still fit). */
export class SetWallEndpointsCommand implements Command {
  readonly id: string;
  readonly type = "wall.setEndpoints";
  private prev: { p1: Wall["p1"]; p2: Wall["p2"] } | null = null;

  constructor(
    private readonly wallId: string,
    private readonly p1: Wall["p1"],
    private readonly p2: Wall["p2"],
  ) {
    this.id = `cmd.endpoints.${wallId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w) return notFound(this.wallId);
    if (
      w.p1.x === this.p1.x &&
      w.p1.y === this.p1.y &&
      w.p1.z === this.p1.z &&
      w.p2.x === this.p2.x &&
      w.p2.y === this.p2.y &&
      w.p2.z === this.p2.z
    ) {
      return NOOP;
    }
    const candidate: Wall = {
      ...w,
      p1: { ...this.p1 },
      p2: { ...this.p2 },
    };
    if (w.vertical.kind === "profile") {
      const oldLen = wallLength(w);
      const newLen = wallLength(candidate);
      if (!almostEqual(oldLen, newLen, 1e-6)) {
        return rejected({
          code: "wall.profile.lengthLocked",
          message: `wall ${this.wallId}: cannot change length while a custom vertical profile is set`,
        });
      }
    }
    const invalid = checkWall(doc, candidate);
    if (invalid) return invalid;
    const hosted = [
      ...doc.doors.filter((d) => d.wallId === w.id),
      ...doc.windows.filter((win) => win.wallId === w.id),
    ];
    for (const h of hosted) {
      const others = openingsOnWall(w.id, doc.doors, doc.windows, h.id);
      const fit = validateHostedOpening(asOpeningSpec(h), candidate, others);
      if (fit) return rejected(fit);
    }
    this.prev = { p1: { ...w.p1 }, p2: { ...w.p2 } };
    w.p1 = { ...this.p1 };
    w.p2 = { ...this.p2 };
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w || !this.prev) return;
    w.p1 = { ...this.prev.p1 };
    w.p2 = { ...this.prev.p2 };
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetWallHeightCommand implements Command {
  readonly id: string;
  readonly type = "wall.setHeight";
  private prev: WallVerticalDefinition | null = null;

  constructor(
    private readonly wallId: string,
    private readonly height: number,
  ) {
    this.id = `cmd.height.${wallId}.${height}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w) return notFound(this.wallId);
    if (w.vertical.kind === "profile") {
      return rejected({
        code: "wall.profile.heightLocked",
        message: `wall ${this.wallId}: use Restablecer perfil / SetWallVerticalProfile to change a custom profile`,
      });
    }
    const next = wallVerticalFromHeight(this.height);
    if (wallVerticalEquals(w.vertical, next)) return NOOP;
    const invalid = checkWall(doc, { ...w, vertical: next });
    if (invalid) return invalid;
    // Openings must still fit the new uniform height.
    const hosted = [
      ...doc.doors.filter((d) => d.wallId === w.id),
      ...doc.windows.filter((win) => win.wallId === w.id),
    ];
    const candidate: Wall = { ...w, vertical: next };
    for (const h of hosted) {
      const others = openingsOnWall(w.id, doc.doors, doc.windows, h.id);
      const fit = validateHostedOpening(asOpeningSpec(h), candidate, others);
      if (fit) return rejected(fit);
    }
    this.prev = cloneWallVertical(w.vertical);
    w.vertical = next;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w || !this.prev) return;
    w.vertical = cloneWallVertical(this.prev);
    doc.meta.updatedAt = new Date().toISOString();
  }
}

/**
 * ADR 0018 / SK-wall-profile-v1 Bloque 4 — set vertical definition in place.
 * Preserves wallId, openings (when they still fit), family, thickness, storey.
 */
export class SetWallVerticalProfileCommand implements Command {
  readonly id: string;
  readonly type = "wall.setVerticalProfile";
  private prev: WallVerticalDefinition | null = null;

  constructor(
    private readonly wallId: string,
    private readonly nextVertical: WallVerticalDefinition,
  ) {
    this.id = `cmd.vertical.${wallId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w) return notFound(this.wallId);

    const next = cloneWallVertical(this.nextVertical);
    if (wallVerticalEquals(w.vertical, next)) return NOOP;

    const len = wallLength(w);
    const profileIssue = validateWallVerticalDefinition(next, len);
    if (profileIssue) return rejected(profileIssue);

    const candidate: Wall = { ...w, vertical: next };
    const invalid = checkWall(doc, candidate);
    if (invalid) return invalid;

    const hosted = [
      ...doc.doors.filter((d) => d.wallId === w.id),
      ...doc.windows.filter((win) => win.wallId === w.id),
    ];
    for (const h of hosted) {
      const spec = asOpeningSpec(h);
      const inside = validateOpeningInsideWallProfile(spec, candidate, next);
      if (inside) return rejected(inside);
      const others = openingsOnWall(w.id, doc.doors, doc.windows, h.id);
      const fit = validateHostedOpening(spec, candidate, others);
      if (fit) return rejected(fit);
    }

    this.prev = cloneWallVertical(w.vertical);
    w.vertical = next;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w || !this.prev) return;
    w.vertical = cloneWallVertical(this.prev);
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetWallThicknessCommand implements Command {
  readonly id: string;
  readonly type = "wall.setThickness";
  private prev = 0;

  constructor(
    private readonly wallId: string,
    private readonly thickness: number,
  ) {
    this.id = `cmd.thickness.${wallId}.${thickness}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w) return notFound(this.wallId);
    if (w.thickness === this.thickness) return NOOP;
    const invalid = checkWall(doc, { ...w, thickness: this.thickness });
    if (invalid) return invalid;
    this.prev = w.thickness;
    w.thickness = this.thickness;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w) return;
    w.thickness = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetWallFamilyCommand implements Command {
  readonly id: string;
  readonly type = "wall.setFamily";
  private prevFamily = "";
  private prevThickness = 0;

  constructor(
    private readonly wallId: string,
    private readonly familyId: string,
    private readonly thickness: number,
  ) {
    this.id = `cmd.family.${wallId}.${familyId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w) return notFound(this.wallId);
    if (w.familyId === this.familyId && w.thickness === this.thickness) return NOOP;
    const invalid = checkWall(doc, {
      ...w,
      familyId: this.familyId,
      thickness: this.thickness,
    });
    if (invalid) return invalid;
    this.prevFamily = w.familyId;
    this.prevThickness = w.thickness;
    w.familyId = this.familyId;
    w.thickness = this.thickness;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.walls.find((x) => x.id === this.wallId);
    if (!w) return;
    w.familyId = this.prevFamily;
    w.thickness = this.prevThickness;
    doc.meta.updatedAt = new Date().toISOString();
  }
}
