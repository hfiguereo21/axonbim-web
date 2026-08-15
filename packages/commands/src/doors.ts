import type { AxonDocument, Door, DoorLeafState, DoorSwing } from "@axonbim/model";
import { documentRefs, validateDoor } from "@axonbim/model";
import { checkHostedOpening } from "./hostedOpening";
import { restoreAt } from "./restoreOrder";
import { CHANGED, NOOP, rejected, type Command, type CommandResult } from "./types";

let doorSeq = 0;

export function resetDoorIdSeq(n = 0): void {
  doorSeq = n;
}

export function createDoorId(): string {
  doorSeq += 1;
  return `door.${doorSeq}`;
}

function notFound(doorId: string): CommandResult {
  return rejected({ code: "door.notFound", message: `door ${doorId}: not found` });
}

/** Entity rules, then hosted fit/overlap against the wall (F9-E2). */
function checkDoor(doc: AxonDocument, candidate: Door): CommandResult | null {
  const issue = validateDoor(candidate, documentRefs(doc));
  if (issue) return rejected(issue);
  return checkHostedOpening(doc, candidate);
}

export class CreateDoorCommand implements Command {
  readonly id: string;
  readonly type = "door.create";
  constructor(private readonly door: Door) {
    this.id = `cmd.door.create.${door.id}`;
  }

  execute(doc: AxonDocument): CommandResult {
    if (doc.doors.some((d) => d.id === this.door.id)) {
      return rejected({
        code: "door.duplicateId",
        message: `door ${this.door.id}: id already exists`,
      });
    }
    const invalid = checkDoor(doc, this.door);
    if (invalid) return invalid;
    doc.doors.push({ ...this.door });
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    doc.doors = doc.doors.filter((d) => d.id !== this.door.id);
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class DeleteDoorCommand implements Command {
  readonly id: string;
  readonly type = "door.delete";
  private snapshot: Door | null = null;
  private index = 0;

  constructor(private readonly doorId: string) {
    this.id = `cmd.door.delete.${doorId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const index = doc.doors.findIndex((d) => d.id === this.doorId);
    if (index < 0) return notFound(this.doorId);
    this.snapshot = { ...doc.doors[index] };
    this.index = index;
    doc.doors = doc.doors.filter((d) => d.id !== this.doorId);
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    if (!this.snapshot) return;
    restoreAt(doc.doors, this.index, { ...this.snapshot });
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetDoorLeafStateCommand implements Command {
  readonly id: string;
  readonly type = "door.setLeafState";
  private prev: DoorLeafState = "open";

  constructor(
    private readonly doorId: string,
    private readonly leafState: DoorLeafState,
  ) {
    this.id = `cmd.door.leaf.${doorId}.${leafState}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return notFound(this.doorId);
    const cur = d.leafState ?? "open";
    if (cur === this.leafState) return NOOP;
    const invalid = checkDoor(doc, { ...d, leafState: this.leafState });
    if (invalid) return invalid;
    this.prev = cur;
    d.leafState = this.leafState;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return;
    d.leafState = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetDoorSwingCommand implements Command {
  readonly id: string;
  readonly type = "door.setSwing";
  private prev: DoorSwing = "positive";

  constructor(
    private readonly doorId: string,
    private readonly swing: DoorSwing,
  ) {
    this.id = `cmd.door.swing.${doorId}.${swing}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return notFound(this.doorId);
    const cur = d.swing ?? "positive";
    if (cur === this.swing) return NOOP;
    const invalid = checkDoor(doc, { ...d, swing: this.swing });
    if (invalid) return invalid;
    this.prev = cur;
    d.swing = this.swing;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return;
    d.swing = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetDoorHingeCommand implements Command {
  readonly id: string;
  readonly type = "door.setHinge";
  private prev: Door["hinge"] = "start";

  constructor(
    private readonly doorId: string,
    private readonly hinge: Door["hinge"],
  ) {
    this.id = `cmd.door.hinge.${doorId}.${hinge}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return notFound(this.doorId);
    if (d.hinge === this.hinge) return NOOP;
    const invalid = checkDoor(doc, { ...d, hinge: this.hinge });
    if (invalid) return invalid;
    this.prev = d.hinge;
    d.hinge = this.hinge;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return;
    d.hinge = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetDoorFamilyCommand implements Command {
  readonly id: string;
  readonly type = "door.setFamily";
  private prevFamily = "";
  private prevWidth = 0;
  private prevHeight = 0;

  constructor(
    private readonly doorId: string,
    private readonly familyId: string,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.id = `cmd.door.family.${doorId}.${familyId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return notFound(this.doorId);
    if (
      d.familyId === this.familyId &&
      d.width === this.width &&
      d.height === this.height
    ) {
      return NOOP;
    }
    const invalid = checkDoor(doc, {
      ...d,
      familyId: this.familyId,
      width: this.width,
      height: this.height,
    });
    if (invalid) return invalid;
    this.prevFamily = d.familyId;
    this.prevWidth = d.width;
    this.prevHeight = d.height;
    d.familyId = this.familyId;
    d.width = this.width;
    d.height = this.height;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const d = doc.doors.find((x) => x.id === this.doorId);
    if (!d) return;
    d.familyId = this.prevFamily;
    d.width = this.prevWidth;
    d.height = this.prevHeight;
    doc.meta.updatedAt = new Date().toISOString();
  }
}
