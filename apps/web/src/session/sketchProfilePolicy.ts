/**
 * SK-UX-A — draw policy on face-profile seed (ADR 0018 §11).
 */
import type { SketchProfile } from "@axonbim/tools";

/** Closed result outline seeded from a host — do not append Línea onto it. */
export function isClosedResultSeed(profile: SketchProfile | null): boolean {
  return (
    !!profile &&
    profile.closed &&
    profile.semantic !== "axes" &&
    profile.edges.length >= 3
  );
}

export const CLOSED_SEED_LINE_STATUS =
  "Perfil cerrado — usa vértices, Split o Redibujar (Línea no añade aristas)";

export const CLOSED_SEED_REBUILD_STATUS =
  "Redibujar primero (vacía el provisional) para Rect/arco";
