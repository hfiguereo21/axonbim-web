import type { AxonDocument, ValidationIssue } from "@axonbim/model";
import type { IssueLocation } from "@axonbim/shared";

/**
 * Outcome of running a command (ADR 0017).
 *
 * Three distinct cases, because a boolean conflated them and the UI could only
 * ever say "nothing changed":
 * - `ok: true, changed: true`  → the document was mutated; history records it.
 * - `ok: true, changed: false` → nothing to do (same value); not an error.
 * - `ok: false`                → rejected; the document is untouched and the
 *   redo stack must survive. `code` identifies the rule, `message` explains it,
 *   and `where` carries the offending vertex/edge when the rule knows one so the
 *   UI can point at it instead of only describing it (SK-R1).
 */
export type CommandResult =
  | { ok: true; changed: true }
  | { ok: true; changed: false; code: "noop" }
  | { ok: false; code: string; message: string; where?: IssueLocation };

export const CHANGED: CommandResult = { ok: true, changed: true };
export const NOOP: CommandResult = { ok: true, changed: false, code: "noop" };

export function rejected(issue: ValidationIssue): CommandResult {
  // Forwarding `where` is the whole point: this boundary used to drop it, so a
  // located rule arrived at the UI indistinguishable from an unlocated one.
  return issue.where
    ? { ok: false, code: issue.code, message: issue.message, where: issue.where }
    : { ok: false, code: issue.code, message: issue.message };
}

/** True when the command mutated the document. */
export function didChange(result: CommandResult): boolean {
  return result.ok && result.changed;
}

export interface Command {
  readonly id: string;
  readonly type: string;
  execute(doc: AxonDocument): CommandResult;
  undo(doc: AxonDocument): void;
}
