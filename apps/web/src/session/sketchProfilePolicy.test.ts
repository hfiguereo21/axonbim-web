import { describe, expect, it } from "vitest";
import { profileFromClosedRing } from "@axonbim/tools";
import {
  CLOSED_SEED_LINE_STATUS,
  isClosedResultSeed,
} from "./sketchProfilePolicy";

describe("sketchProfilePolicy", () => {
  it("detects closed result seeds", () => {
    const closed = profileFromClosedRing(
      [
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 2, y: 0, z: 1 },
        { x: 0, y: 0, z: 1 },
      ],
      ["wall.1"],
      true,
    );
    expect(isClosedResultSeed(closed)).toBe(true);
    expect(isClosedResultSeed({ ...closed, semantic: "axes" })).toBe(false);
    expect(isClosedResultSeed({ ...closed, closed: false })).toBe(false);
    expect(isClosedResultSeed(null)).toBe(false);
    expect(CLOSED_SEED_LINE_STATUS).toMatch(/Redibujar/i);
  });
});
