/**
 * SK-UX-A — draw policy on face-profile seed (ADR 0018 §11).
 */
import type { SketchProfile } from "@axonbim/tools";

/** Closed result outline seeded from a host — do not append Línea onto it. */
export function isClosedResultSeed(profile: SketchProfile | null): boolean {
  return (
    // `profile !== null` y no `Boolean(profile)`: TypeScript estrecha el tipo
    // con la comparación explícita, no con la llamada a Boolean, y sin eso los
    // tres accesos de abajo son "possibly null".
    profile !== null &&
    profile.closed &&
    profile.semantic !== "axes" &&
    profile.edges.length >= 3
  );
}

export const CLOSED_SEED_LINE_STATUS =
  "Perfil cerrado — usa vértices, Split o Redibujar (Línea no añade aristas)";

export const CLOSED_SEED_REBUILD_STATUS =
  "Redibujar primero (vacía el provisional) para Rect/arco";
