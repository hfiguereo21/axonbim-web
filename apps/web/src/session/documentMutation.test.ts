import { describe, expect, it } from "vitest";
import { CHANGED, HistoryStack, NOOP, type Command } from "@axonbim/commands";
import { createEmptyDocument, type AxonDocument } from "@axonbim/model";
import {
  NO_MUTATION_STATUS,
  applyCommandToSession,
  redoInSession,
  rejectionStatus,
  undoInSession,
} from "./documentMutation";

/** Adds one wall; `mutates: false` models a command that declines to change. */
function fakeCommand(id: string, mutates = true): Command {
  return {
    id,
    type: "test.fake",
    execute(doc: AxonDocument) {
      if (!mutates) return NOOP;
      doc.walls.push({
        id,
        storeyId: "storey.default",
        familyId: "family.block-150",
        p1: { x: 0, y: 0, z: 0 },
        p2: { x: 1, y: 0, z: 0 },
        vertical: { kind: "uniform", height: 2.7 },
        thickness: 0.15,
      });
      return CHANGED;
    },
    undo(doc: AxonDocument) {
      doc.walls = doc.walls.filter((w) => w.id !== id);
    },
  };
}

/** Models a command stopped by a domain invariant (ADR 0017). */
function rejectingCommand(code: string, message: string): Command {
  return {
    id: "rejected",
    type: "test.rejected",
    execute() {
      return { ok: false, code, message };
    },
    undo() {},
  };
}

function snapshot(document: AxonDocument, history: HistoryStack, rev = 0) {
  return { document, history, documentRev: rev };
}

describe("documentMutation (corte 7c)", () => {
  it("records a mutating command and bumps the revision", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    const out = applyCommandToSession(snapshot(doc, history, 4), fakeCommand("a"), "Hecho");

    expect(out.mutated).toBe(true);
    if (!out.mutated) return;
    expect(out.patch.documentRev).toBe(5);
    expect(out.patch.status).toBe("Hecho");
    expect(out.patch.document).not.toBe(doc);
    expect(out.patch.document.walls.map((w) => w.id)).toEqual(["a"]);
    expect(history.canUndo).toBe(true);
  });

  it("does not record a command that reports no mutation", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    const out = applyCommandToSession(
      snapshot(doc, history, 4),
      fakeCommand("noop", false),
      "Hecho",
    );

    expect(out.mutated).toBe(false);
    expect(out.patch.status).toBe(NO_MUTATION_STATUS);
    expect(history.canUndo).toBe(false);
  });

  it("keeps redo available when a command reports no mutation", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    applyCommandToSession(snapshot(doc, history), fakeCommand("a"), "Hecho");
    undoInSession(snapshot(doc, history, 1), "Deshacer");
    expect(history.canRedo).toBe(true);

    applyCommandToSession(snapshot(doc, history, 2), fakeCommand("noop", false), "Hecho");
    expect(history.canRedo).toBe(true);
  });

  it("reports the rule that rejected a command instead of «sin cambios»", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    const out = applyCommandToSession(
      snapshot(doc, history, 4),
      rejectingCommand("wall.height.min", "wall w1: height must be at least 0.05 m"),
      "Hecho",
    );

    expect(out.mutated).toBe(false);
    if (out.mutated) return;
    expect(out.rejected).toBe(true);
    expect(out.patch.status).not.toBe(NO_MUTATION_STATUS);
    // SK-R1: naming the rule is necessary but not sufficient — the status must
    // also tell the user what to change.
    expect(out.patch.status).toBe(
      "Altura de muro por debajo del mínimo (0,05 m). Cómo resolverlo: Sube la altura a 0,05 m o más",
    );
    expect(history.canUndo).toBe(false);
  });

  it("falls back to the technical message for unmapped rejection codes", () => {
    expect(rejectionStatus("some.new.rule", "wall w1: nope")).toBe(
      "Operación rechazada: wall w1: nope",
    );
  });

  it("SK-UX-A: maps profile.* rejection codes to Spanish, each with a remedy", () => {
    // SK-R1 rewrote two of these away from jargon on purpose: "se autointersecta"
    // and "perfil custom" named the rule in language the drawer does not use.
    // What each assertion still guarantees is the rule plus a way out.
    for (const [code, rule] of [
      ["profile.ends", /extremos/i],
      ["profile.selfIntersection", /se cruza consigo mismo/i],
      ["wall.profile.heightLocked", /perfil vertical propio/i],
    ] as const) {
      const text = rejectionStatus(code, "tech");
      expect(text).toMatch(rule);
      expect(text).toContain("Cómo resolverlo:");
    }
  });

  it("keeps redo available when a command is rejected", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    applyCommandToSession(snapshot(doc, history), fakeCommand("a"), "Hecho");
    undoInSession(snapshot(doc, history, 1), "Deshacer");
    expect(history.canRedo).toBe(true);

    applyCommandToSession(
      snapshot(doc, history, 2),
      rejectingCommand("wall.length.min", "wall w1: axis shorter than 0.05 m"),
      "Hecho",
    );
    expect(history.canRedo).toBe(true);
  });

  it("undo reverts the document and bumps the revision", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    applyCommandToSession(snapshot(doc, history), fakeCommand("a"), "Hecho");

    const patch = undoInSession(snapshot(doc, history, 1), "Deshacer");
    expect(patch).not.toBeNull();
    expect(patch!.documentRev).toBe(2);
    expect(patch!.status).toBe("Deshacer");
    expect(patch!.document.walls).toEqual([]);
  });

  it("redo re-applies the undone command", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    applyCommandToSession(snapshot(doc, history), fakeCommand("a"), "Hecho");
    undoInSession(snapshot(doc, history, 1), "Deshacer");

    const patch = redoInSession(snapshot(doc, history, 2), "Rehacer");
    expect(patch).not.toBeNull();
    expect(patch!.documentRev).toBe(3);
    expect(patch!.document.walls.map((w) => w.id)).toEqual(["a"]);
  });

  it("undo and redo are no-ops on empty stacks", () => {
    const doc = createEmptyDocument();
    const history = new HistoryStack();
    expect(undoInSession(snapshot(doc, history), "Deshacer")).toBeNull();
    expect(redoInSession(snapshot(doc, history), "Rehacer")).toBeNull();
  });
});
