/**
 * Undo of a delete must put the entity back where it was, not at the end.
 *
 * `execute` drops the entity with `filter`, which loses its position, and the
 * undos used to `push`. Deleting the middle of three cameras and undoing
 * returned it as the last one: the tab moved, the project browser reordered,
 * and a saved `.axon` came back in a different order than it went out — all
 * without a command saying so. Document order is observable, so restoring it
 * is part of "undo returns the document to its previous state".
 */

/** An entity that was removed, with the index it occupied. */
export type Removed<T> = { index: number; item: T };

/**
 * Snapshots every entity matching `match` together with its index, in
 * ascending order, so `restoreAll` can put them back where they were.
 */
export function snapshotRemoved<T>(
  list: readonly T[],
  match: (item: T) => boolean,
  clone: (item: T) => T,
): Removed<T>[] {
  const out: Removed<T>[] = [];
  list.forEach((item, index) => {
    if (match(item)) out.push({ index, item: clone(item) });
  });
  return out;
}

/**
 * Re-inserts entries at their original indices.
 *
 * Ascending order matters: restoring the entry that sat at index `i` is only
 * correct once everything that sat before `i` is already back, so each splice
 * sees the same prefix the original array had. Entries are sorted defensively
 * in case a caller collected them out of order.
 *
 * An index past the current end clamps to the end instead of leaving a hole —
 * that only happens if the document was mutated between execute and undo, and
 * appending is a better failure than a sparse array.
 */
export function restoreAll<T>(list: T[], entries: readonly Removed<T>[]): void {
  for (const { index, item } of [...entries].sort((a, b) => a.index - b.index)) {
    list.splice(Math.min(index, list.length), 0, item);
  }
}

/** Single-entity form of {@link restoreAll}. */
export function restoreAt<T>(list: T[], index: number, item: T): void {
  list.splice(Math.min(index, list.length), 0, item);
}
