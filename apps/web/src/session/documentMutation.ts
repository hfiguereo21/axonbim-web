import type { Command, CommandResult, HistoryStack } from "@axonbim/commands";
import type { AxonDocument } from "@axonbim/model";
import type { IssueLocation } from "@axonbim/shared";
import { touchDoc } from "./touchDoc";

/** Status shown when a command ran but decided nothing changed (F5-S). */
export const NO_MUTATION_STATUS = "Sin cambios (operación no aplicada)";

/**
 * Spanish copy for every domain rule a user can hit (ADR 0017, SK-R1).
 *
 * Naming the rule is not enough: a user who cannot tell *where* it broke or
 * *what to change* is still guessing. So each entry carries the rule and the
 * remedy, and the location comes from the domain (`ValidationIssue.where`).
 *
 * `check:rejection-codes` fails the build if a code is emitted without an entry
 * here, or if an entry exists for a code nobody emits.
 */
export type RejectionCopy = {
  /**
   * `rule` — the user asked for something the model forbids, and changing the
   * input fixes it. `internal` — a stale reference or malformed data; no edit
   * the user makes will help, so promising a remedy would be a lie.
   */
  kind: "rule" | "internal";
  /** What rule stopped the operation. */
  rule: string;
  /** What the user must change to get past it, or what to do about a bug. */
  fix: string;
};

const REJECTION_TEXT: Record<string, RejectionCopy> = {
  "wall.height.min": {
    kind: "rule",
    rule: "Altura de muro por debajo del mínimo (0,05 m)",
    fix: "Sube la altura a 0,05 m o más",
  },
  "wall.thickness.min": {
    kind: "rule",
    rule: "Espesor de muro por debajo del mínimo (0,05 m)",
    fix: "Usa un espesor de 0,05 m o más, o elige otra familia",
  },
  "wall.length.min": {
    kind: "rule",
    rule: "Muro demasiado corto (mínimo 0,05 m)",
    fix: "Separa los extremos hasta al menos 0,05 m",
  },
  "wall.family.unknown": {
    kind: "rule",
    rule: "Esa familia de muro no existe en el documento",
    fix: "Elige una familia del catálogo del proyecto",
  },
  "wall.storey.unknown": {
    kind: "rule",
    rule: "Ese nivel no existe en el documento",
    fix: "Elige un nivel existente en el navegador de proyecto",
  },
  "wall.profile.heightLocked": {
    kind: "rule",
    rule: "Altura bloqueada: el muro tiene perfil vertical propio",
    fix: "Edita el perfil con Sketch, o usa Restablecer para volver a altura simple",
  },
  "wall.profile.lengthLocked": {
    kind: "rule",
    rule: "Longitud bloqueada: el muro tiene perfil vertical propio",
    fix: "Edita el perfil con Sketch, o usa Restablecer antes de estirar el eje",
  },
  "door.family.unknown": {
    kind: "rule",
    rule: "Esa familia de puerta no existe en el documento",
    fix: "Elige una familia del catálogo del proyecto",
  },
  "window.family.unknown": {
    kind: "rule",
    rule: "Esa familia de ventana no existe en el documento",
    fix: "Elige una familia del catálogo del proyecto",
  },
  "camera.fov.range": {
    kind: "rule",
    rule: "El campo de visión debe estar entre 10° y 120°",
    fix: "Ajusta el FOV dentro de ese rango",
  },
  "camera.eyeTarget.tooClose": {
    kind: "rule",
    rule: "La cámara y su punto de mira están demasiado juntos",
    fix: "Aleja el punto de mira de la posición de cámara",
  },
  "camera.name.required": {
    kind: "rule",
    rule: "La cámara necesita un nombre",
    fix: "Escribe un nombre no vacío",
  },
  "opening.endMargin": {
    kind: "rule",
    rule: "Hueco demasiado cerca del extremo del muro",
    fix: "Desplázalo hacia el centro del muro",
  },
  "opening.verticalFit": {
    kind: "rule",
    rule: "El hueco no cabe en la altura del muro",
    fix: "Baja el antepecho, reduce la altura del hueco, o sube la del muro",
  },
  "opening.overlap": {
    kind: "rule",
    rule: "Hay otro hueco demasiado cerca",
    fix: "Sepáralo del hueco vecino o borra uno de los dos",
  },
  "opening.outsideProfile": {
    kind: "rule",
    rule: "El hueco queda fuera del perfil del muro",
    fix: "Muévelo a una zona donde el muro tenga material",
  },
  "opening.wall.mismatch": {
    kind: "rule",
    rule: "El hueco no pertenece a ese muro",
    fix: "Selecciona el muro anfitrión correcto",
  },
  "opening.wall.unknown": {
    kind: "rule",
    rule: "El muro anfitrión del hueco no existe en el documento",
    fix: "El muro se borró: deshaz la operación o vuelve a colocar el hueco",
  },
  "profile.vertexCount": {
    kind: "rule",
    rule: "El perfil necesita al menos 3 vértices",
    fix: "Añade vértices hasta cerrar una figura con superficie",
  },
  "profile.wallLength": {
    kind: "rule",
    rule: "La longitud del muro es demasiado corta para el perfil",
    fix: "Alarga el muro a 0,05 m o más antes de editar su perfil",
  },
  "profile.nonFinite": {
    kind: "rule",
    rule: "El perfil tiene coordenadas no válidas",
    fix: "Rehaz ese tramo del trazado",
  },
  "profile.u.bounds": {
    kind: "rule",
    rule: "El perfil se sale de los extremos del muro (eje u)",
    fix: "Mueve el vértice dentro de la longitud del muro",
  },
  "profile.v.belowBase": {
    kind: "rule",
    rule: "El perfil baja por debajo de la base del muro",
    fix: "Sube el vértice hasta la base o por encima",
  },
  "profile.duplicateVertex": {
    kind: "rule",
    rule: "El perfil tiene vértices duplicados consecutivos",
    fix: "Borra el vértice repetido o sepáralo del anterior",
  },
  "profile.edge.short": {
    kind: "rule",
    rule: "Una arista del perfil es demasiado corta (mínimo 0,05 m)",
    fix: "Alarga esa arista o une sus dos vértices en uno",
  },
  "profile.selfIntersection": {
    kind: "rule",
    rule: "El perfil se cruza consigo mismo",
    fix: "Deshaz el cruce: el contorno debe cerrarse sin cortarse",
  },
  "profile.area": {
    kind: "rule",
    rule: "El perfil tiene área nula o demasiado pequeña",
    fix: "Abre la figura: tal como está no encierra superficie",
  },
  "profile.ends": {
    kind: "rule",
    rule: "El perfil debe alcanzar ambos extremos del muro (u=0 y u=longitud)",
    fix: "Extiende el contorno hasta tocar los dos extremos",
  },
  "profile.height.min": {
    kind: "rule",
    rule: "La altura máxima del perfil es inferior al mínimo (0,05 m)",
    fix: "Sube el punto más alto del contorno",
  },
  "profile.empty": {
    kind: "rule",
    rule: "Perfil vacío o con segmentos por debajo del mínimo (0,05 m)",
    fix: "Traza un contorno con segmentos de 0,05 m o más",
  },
  "profile.openings": {
    kind: "rule",
    rule: "No se puede reemplazar: hay puertas o ventanas en los muros del perfil",
    fix: "Borra los huecos antes de reemplazar, o edita el perfil vertical in situ",
  },
  "profile.footprint.one": {
    kind: "rule",
    rule: "La huella no es un muro caja convertible",
    fix: "Ajústala a un rectángulo, o redibuja con Rect o por ejes",
  },
  "profile.face.shape": {
    kind: "rule",
    rule: "Contorno vertical incompleto",
    fix: "Cierra el contorno: necesita al menos 3 vértices",
  },
  "profile.loop.inset": {
    kind: "rule",
    rule: "No se pudieron recuperar los ejes desde el anillo exterior",
    fix: "Simplifica el contorno, o dibújalo por ejes en vez de por contorno",
  },
  "profile.axes.short": {
    kind: "rule",
    rule: "Segmentos demasiado cortos (mínimo 0,05 m)",
    fix: "Alarga los segmentos por debajo del mínimo",
  },
  "profile.sources.missing": {
    kind: "internal",
    rule: "Los muros de este perfil ya no están en el documento",
    fix: "Se borraron durante la edición: deshaz o sal del croquis",
  },
  "crop.bounds.inverted": {
    kind: "rule",
    rule: "La región de recorte tiene el mínimo por encima del máximo",
    fix: "Arrastra el marco para que el mínimo quede por debajo del máximo",
  },
  "crop.z.inverted": {
    kind: "rule",
    rule: "El rango vertical de recorte está invertido",
    fix: "Ajusta el rango para que la cota inferior sea menor que la superior",
  },
  "camera.crop.required": {
    kind: "rule",
    rule: "Esta cámara necesita una región de recorte definida",
    fix: "Define el marco de recorte antes de guardar la cámara",
  },
  "wall.notFound": {
    kind: "internal",
    rule: "El muro al que apunta la operación ya no está en el documento",
    fix: "Se borró o cambió mientras operabas: deshaz y vuelve a seleccionarlo",
  },
  "door.notFound": {
    kind: "internal",
    rule: "La puerta a la que apunta la operación ya no está en el documento",
    fix: "Se borró o cambió mientras operabas: deshaz y vuelve a seleccionarla",
  },
  "window.notFound": {
    kind: "internal",
    rule: "La ventana a la que apunta la operación ya no está en el documento",
    fix: "Se borró o cambió mientras operabas: deshaz y vuelve a seleccionarla",
  },
  "camera.notFound": {
    kind: "internal",
    rule: "La cámara a la que apunta la operación ya no está en el documento",
    fix: "Se borró o cambió mientras operabas: deshaz y vuelve a seleccionarla",
  },
  "wall.duplicateId": {
    kind: "internal",
    rule: "Ya existe un muro con ese identificador",
    fix: "Fallo interno de asignación de IDs: deshaz y repórtalo",
  },
  "door.duplicateId": {
    kind: "internal",
    rule: "Ya existe una puerta con ese identificador",
    fix: "Fallo interno de asignación de IDs: deshaz y repórtalo",
  },
  "window.duplicateId": {
    kind: "internal",
    rule: "Ya existe una ventana con ese identificador",
    fix: "Fallo interno de asignación de IDs: deshaz y repórtalo",
  },
  "camera.duplicateId": {
    kind: "internal",
    rule: "Ya existe una cámara con ese identificador",
    fix: "Fallo interno de asignación de IDs: deshaz y repórtalo",
  },
  "wall.id.invalid": {
    kind: "internal",
    rule: "El muro no tiene un identificador válido",
    fix: "Dato corrupto: no es algo que puedas corregir editando; deshaz y repórtalo",
  },
  "camera.id.invalid": {
    kind: "internal",
    rule: "La cámara no tiene un identificador válido",
    fix: "Dato corrupto: no es algo que puedas corregir editando; deshaz y repórtalo",
  },
  "door.id.invalid": {
    kind: "internal",
    rule: "La puerta no tiene un identificador válido",
    fix: "Dato corrupto: no es algo que puedas corregir editando; deshaz y repórtalo",
  },
  "window.id.invalid": {
    kind: "internal",
    rule: "La ventana no tiene un identificador válido",
    fix: "Dato corrupto: no es algo que puedas corregir editando; deshaz y repórtalo",
  },
  "door.wall.unknown": {
    kind: "internal",
    rule: "El muro anfitrión de la puerta no existe en el documento",
    fix: "El muro se borró: deshaz la operación o vuelve a colocar la puerta",
  },
  "window.wall.unknown": {
    kind: "internal",
    rule: "El muro anfitrión de la ventana no existe en el documento",
    fix: "El muro se borró: deshaz la operación o vuelve a colocar la ventana",
  },
  "crop.invalid": {
    kind: "internal",
    rule: "La región de recorte no es un objeto válido",
    fix: "Dato corrupto: deshaz y repórtalo",
  },
  "crop.enabled.invalid": {
    kind: "internal",
    rule: "El interruptor de recorte tiene un valor no válido",
    fix: "Dato corrupto: deshaz y repórtalo",
  },
  "crop.bounds.invalid": {
    kind: "internal",
    rule: "Los límites del recorte no son números válidos",
    fix: "Dato corrupto: deshaz y repórtalo",
  },
  "crop.z.invalid": {
    kind: "internal",
    rule: "El rango vertical del recorte no son números válidos",
    fix: "Dato corrupto: deshaz y repórtalo",
  },
};

/** Codes with UI copy — exported so the guard can compare against the domain. */
export const REJECTION_CODES: readonly string[] = Object.keys(REJECTION_TEXT);

function locationText(where: IssueLocation | undefined): string {
  if (!where) return "";
  const ordinal = where.index + 1;
  return where.at === "vertex" ? ` (vértice ${ordinal})` : ` (arista ${ordinal})`;
}

/**
 * Rule + location + remedy (SK-R1 gate).
 *
 * An unmapped code still shows its technical message rather than hiding it, but
 * that path is a defect: `check:rejection-codes` fails the build before a new
 * code can reach a user without copy.
 */
export function rejectionStatus(
  code: string,
  message: string,
  where?: IssueLocation,
): string {
  const copy = REJECTION_TEXT[code];
  if (!copy) return `Operación rechazada: ${message}`;
  const lead = copy.kind === "internal" ? "Fallo interno" : "Cómo resolverlo";
  return `${copy.rule}${locationText(where)}. ${lead}: ${copy.fix}`;
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
      patch: { status: rejectionStatus(result.code, result.message, result.where) },
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
