import type { AxonDocument, DoorLeafState, DoorSwing, Window } from "@axonbim/model";
import { documentRefs, validateWindow } from "@axonbim/model";
import { checkHostedOpening } from "./hostedOpening";
import { restoreAt } from "./restoreOrder";
import { CHANGED, NOOP, rejected, type Command, type CommandResult } from "./types";

let windowSeq = 0;

export function resetWindowIdSeq(n = 0): void {
  windowSeq = n;
}

export function createWindowId(): string {
  windowSeq += 1;
  return `window.${windowSeq}`;
}

function notFound(windowId: string): CommandResult {
  return rejected({ code: "window.notFound", message: `window ${windowId}: not found` });
}

/** Entity rules, then hosted fit/overlap against the wall (F9-E2). */
function checkWindow(doc: AxonDocument, candidate: Window): CommandResult | null {
  const issue = validateWindow(candidate, documentRefs(doc));
  if (issue) return rejected(issue);
  return checkHostedOpening(doc, candidate);
}

export class CreateWindowCommand implements Command {
  readonly id: string;
  readonly type = "window.create";
  constructor(private readonly window: Window) {
    this.id = `cmd.window.create.${window.id}`;
  }

  execute(doc: AxonDocument): CommandResult {
    if (doc.windows.some((w) => w.id === this.window.id)) {
      return rejected({
        code: "window.duplicateId",
        message: `window ${this.window.id}: id already exists`,
      });
    }
    const invalid = checkWindow(doc, this.window);
    if (invalid) return invalid;
    doc.windows.push({ ...this.window });
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    doc.windows = doc.windows.filter((w) => w.id !== this.window.id);
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class DeleteWindowCommand implements Command {
  readonly id: string;
  readonly type = "window.delete";
  private snapshot: Window | null = null;
  private index = 0;

  constructor(private readonly windowId: string) {
    this.id = `cmd.window.delete.${windowId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const index = doc.windows.findIndex((w) => w.id === this.windowId);
    if (index < 0) return notFound(this.windowId);
    this.snapshot = { ...doc.windows[index] };
    this.index = index;
    doc.windows = doc.windows.filter((w) => w.id !== this.windowId);
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    if (!this.snapshot) return;
    restoreAt(doc.windows, this.index, { ...this.snapshot });
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetWindowLeafStateCommand implements Command {
  readonly id: string;
  readonly type = "window.setLeafState";
  private prev: DoorLeafState = "closed";

  constructor(
    private readonly windowId: string,
    private readonly leafState: DoorLeafState,
  ) {
    this.id = `cmd.window.leaf.${windowId}.${leafState}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return notFound(this.windowId);
    const cur = w.leafState ?? "closed";
    if (cur === this.leafState) return NOOP;
    const invalid = checkWindow(doc, { ...w, leafState: this.leafState });
    if (invalid) return invalid;
    this.prev = cur;
    w.leafState = this.leafState;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return;
    w.leafState = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetWindowSwingCommand implements Command {
  readonly id: string;
  readonly type = "window.setSwing";
  private prev: DoorSwing = "positive";

  constructor(
    private readonly windowId: string,
    private readonly swing: DoorSwing,
  ) {
    this.id = `cmd.window.swing.${windowId}.${swing}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return notFound(this.windowId);
    const cur = w.swing ?? "positive";
    if (cur === this.swing) return NOOP;
    const invalid = checkWindow(doc, { ...w, swing: this.swing });
    if (invalid) return invalid;
    this.prev = cur;
    w.swing = this.swing;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return;
    w.swing = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetWindowHingeCommand implements Command {
  readonly id: string;
  readonly type = "window.setHinge";
  private prev: Window["hinge"] = "start";

  constructor(
    private readonly windowId: string,
    private readonly hinge: Window["hinge"],
  ) {
    this.id = `cmd.window.hinge.${windowId}.${hinge}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return notFound(this.windowId);
    if (w.hinge === this.hinge) return NOOP;
    const invalid = checkWindow(doc, { ...w, hinge: this.hinge });
    if (invalid) return invalid;
    this.prev = w.hinge;
    w.hinge = this.hinge;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return;
    w.hinge = this.prev;
    doc.meta.updatedAt = new Date().toISOString();
  }
}

export class SetWindowFamilyCommand implements Command {
  readonly id: string;
  readonly type = "window.setFamily";
  private prevFamily = "";
  private prevWidth = 0;
  private prevHeight = 0;
  private prevSill = 0;

  constructor(
    private readonly windowId: string,
    private readonly familyId: string,
    private readonly width: number,
    private readonly height: number,
    private readonly sill: number,
  ) {
    this.id = `cmd.window.family.${windowId}.${familyId}`;
  }

  execute(doc: AxonDocument): CommandResult {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return notFound(this.windowId);
    if (
      w.familyId === this.familyId &&
      w.width === this.width &&
      w.height === this.height &&
      w.sill === this.sill
    ) {
      return NOOP;
    }
    const invalid = checkWindow(doc, {
      ...w,
      familyId: this.familyId,
      width: this.width,
      height: this.height,
      sill: this.sill,
    });
    if (invalid) return invalid;
    this.prevFamily = w.familyId;
    this.prevWidth = w.width;
    this.prevHeight = w.height;
    this.prevSill = w.sill;
    w.familyId = this.familyId;
    w.width = this.width;
    w.height = this.height;
    w.sill = this.sill;
    doc.meta.updatedAt = new Date().toISOString();
    return CHANGED;
  }

  undo(doc: AxonDocument): void {
    const w = doc.windows.find((x) => x.id === this.windowId);
    if (!w) return;
    w.familyId = this.prevFamily;
    w.width = this.prevWidth;
    w.height = this.prevHeight;
    w.sill = this.prevSill;
    doc.meta.updatedAt = new Date().toISOString();
  }
}
