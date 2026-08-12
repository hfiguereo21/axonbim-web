import type { Command, CommandResult, HistoryStack } from "@axonbim/commands";
import type { AxonDocument } from "@axonbim/model";
import { touchDoc } from "./touchDoc";

/** Status shown when a command ran but decided nothing changed (F5-S). */
export const NO_MUTATION_STATUS = "Sin cambios (operación no aplicada)";

/**
 * Spanish copy for the domain rules a user can actually hit (ADR 0017).
 * Unmapped codes fall back to the technical message rather than hiding it.
 */
const REJECTION_TEXT: Record<string, string> = {
  "wall.height.min": "Altura de muro por debajo del mínimo (0,05 m)",
  "wall.thickness.min": "Espesor de muro por debajo del mínimo (0,05 m)",
  "wall.length.min": "Muro demasiado corto (mínimo 0,05 m)",
  "wall.family.unknown": "Esa familia de muro no existe en el documento",
  "wall.storey.unknown": "Ese nivel no existe en el documento",
  "wall.profile.heightLocked":
    "Altura bloqueada: el muro tiene perfil custom (Restablecer vía Sketch o Redibujar)",
  "wall.profile.lengthLocked":
    "Longitud bloqueada: el muro tiene perfil custom (no se puede estirar el eje)",
  "door.family.unknown": "Esa familia de puerta no existe en el documento",
  "window.family.unknown": "Esa familia de ventana no existe en el documento",
  "camera.fov.range": "El campo de visión debe estar entre 10° y 120°",
  "camera.eyeTarget.tooClose": "La cámara y su punto de mira están demasiado juntos",
  "camera.name.required": "La cámara necesita un nombre",
  "opening.endMargin": "Hueco demasiado cerca del extremo del muro",
  "opening.verticalFit": "El hueco no cabe en la altura del muro",
  "opening.overlap": "Hay otro hueco demasiado cerca",
  "opening.outsideProfile": "El hueco queda fuera del perfil del muro",
  "opening.wall.mismatch": "El hueco no pertenece a ese muro",
  "profile.vertexCount": "El perfil necesita al menos 3 vértices",
  "profile.wallLength": "La longitud del muro es demasiado corta para el perfil",
  "profile.nonFinite": "El perfil tiene coordenadas no válidas",
  "profile.u.bounds": "El perfil se sale de los extremos del muro (eje u)",
  "profile.v.belowBase": "El perfil baja por debajo de la base del muro",
  "profile.duplicateVertex": "El perfil tiene vértices duplicados consecutivos",
  "profile.edge.short": "Una arista del perfil es demasiado corta",
  "profile.selfIntersection": "El perfil se autointersecta",
  "profile.area": "El perfil tiene área nula o demasiado pequeña",
  "profile.ends": "El perfil debe alcanzar ambos extremos del muro (u=0 y u=longitud)",
  "profile.height.min": "La altura máxima del perfil es inferior al mínimo (0,05 m)",
};

export function rejectionStatus(code: string, message: string): string {
  return REJECTION_TEXT[code] ?? `Operación rechazada: ${message}`;
}

/** The parts of session state a document mutation reads. */
export type DocumentSnapshot = {
  document: AxonDocument;
  history: HistoryStack;
  documentRev: number;
};

/** State patch to hand to the store after a successful mutation. */
export type DocumentPatch = DocumentSnapshot & { status: string };

export type CommandOutcome =
  | { mutated: true; patch: DocumentPatch }
  | { mutated: false; rejected: boolean; patch: { status: string } };

/**
 * Run a command through the history stack.
 *
 * Commands mutate the document in place (that is the SoT contract), so the
 * returned `document` is a fresh shallow clone purely so React sees a new
 * reference. Neither a no-op nor a rejection is recorded, and neither may bump
 * `documentRev` nor clear the redo stack. They differ in what the user is told:
 * a no-op is not a problem, a rejection names the rule that stopped it.
 */
export function applyCommandToSession(
  snapshot: DocumentSnapshot,
  cmd: Command,
  status: string,
): CommandOutcome {
  const result: CommandResult = snapshot.history.push(cmd, snapshot.document);
  if (!result.ok) {
    return {
      mutated: false,
      rejected: true,
      patch: { status: rejectionStatus(result.code, result.message) },
    };
  }
  if (!result.changed) {
    return { mutated: false, rejected: false, patch: { status: NO_MUTATION_STATUS } };
  }
  return { mutated: true, patch: nextPatch(snapshot, status) };
}

/** `null` when there is nothing to undo (store leaves state untouched). */
export function undoInSession(
  snapshot: DocumentSnapshot,
  status: string,
): DocumentPatch | null {
  if (!snapshot.history.canUndo) return null;
  snapshot.history.undo(snapshot.document);
  return nextPatch(snapshot, status);
}

/** `null` when there is nothing to redo (store leaves state untouched). */
export function redoInSession(
  snapshot: DocumentSnapshot,
  status: string,
): DocumentPatch | null {
  if (!snapshot.history.canRedo) return null;
  snapshot.history.redo(snapshot.document);
  return nextPatch(snapshot, status);
}

function nextPatch(snapshot: DocumentSnapshot, status: string): DocumentPatch {
  return {
    document: touchDoc(snapshot.document),
    history: snapshot.history,
    documentRev: snapshot.documentRev + 1,
    status,
  };
}
