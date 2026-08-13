/**
 * SK-R1 guards: the rejection surface stays explicable as the domain grows.
 *
 * Both guards scan the real domain sources instead of a hand-kept list, because
 * a hand-kept list is exactly what drifted: before SK-R1 the copy table covered
 * every `model` code and none of the `geometry` ones, and nothing noticed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REJECTION_CODES, rejectionStatus } from "./documentMutation.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Every rejection code literal emitted anywhere under `packages/`. */
function emittedCodes(): Map<string, string> {
  const files = execFileSync("git", ["ls-files", "packages/*/src/**.ts"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((f) => f && !f.includes(".test."));

  // Rejection codes and command ids look alike (`wall.length.min` vs
  // `wall.setFamily`), so a bare literal scan cannot tell them apart. The
  // convention this enforces: a code appears either at its emission site or in
  // a `*_CODES` table. Both are greppable, which is what keeps the surface
  // enumerable — by this guard and by a person reading the code.
  const CODE = String.raw`([a-z][a-zA-Z]*\.[a-zA-Z.]+)`;
  const emission = [
    new RegExp(String.raw`\bissue\(\s*"${CODE}"`, "g"),
    new RegExp(String.raw`\bfail\(\s*"${CODE}"`, "g"),
    new RegExp(String.raw`\bcode:\s*"${CODE}"`, "g"),
  ];
  const CODES_TABLE = /\b[A-Z_]*_CODES\b[^=]*=\s*\{([\s\S]*?)\n\}/g;

  const found = new Map<string, string>();
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), "utf8");
    const add = (code: string) => {
      if (!found.has(code)) found.set(code, file);
    };
    for (const re of emission) {
      for (const m of src.matchAll(re)) add(m[1]!);
    }
    for (const table of src.matchAll(CODES_TABLE)) {
      for (const m of table[1]!.matchAll(new RegExp(`"${CODE}"`, "g"))) add(m[1]!);
    }
  }
  return found;
}

describe("SK-R1 — superficie de rechazo explicable", () => {
  it("finds the domain codes at all (guards the guard)", () => {
    const emitted = emittedCodes();
    // If the scan silently matched nothing, both guards below would pass while
    // checking nothing. A floor makes that failure loud.
    expect(emitted.size).toBeGreaterThan(15);
    expect([...emitted.keys()]).toContain("profile.selfIntersection");
    expect([...emitted.keys()]).toContain("profile.empty");
  });

  it("every emitted code has UI copy — no user meets a raw technical message", () => {
    const covered = new Set(REJECTION_CODES);
    const missing = [...emittedCodes().entries()]
      .filter(([code]) => !covered.has(code))
      .map(([code, file]) => `${code}  (${file})`);

    expect(missing, `códigos emitidos sin copia de UI:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("no orphan copy — every entry corresponds to a code somebody emits", () => {
    const emitted = emittedCodes();
    // `noop` is a control code, never a rejection; it has no copy by design.
    const orphans = REJECTION_CODES.filter((code) => !emitted.has(code));

    expect(orphans, `copia de UI para códigos que nadie emite:\n${orphans.join("\n")}`)
      .toEqual([]);
  });

  it("states rule, location and remedy — the three parts of the gate", () => {
    const located = rejectionStatus("profile.edge.short", "technical", {
      at: "edge",
      index: 2,
    });
    expect(located).toContain("demasiado corta"); // regla
    expect(located).toContain("arista 3"); // ubicación, 1-based
    expect(located).toContain("Cómo resolverlo:"); // remedio

    // A whole-profile rule has no location and must not invent one.
    const unlocated = rejectionStatus("profile.area", "technical");
    expect(unlocated).toContain("área nula");
    expect(unlocated).toContain("Cómo resolverlo:");
    expect(unlocated).not.toMatch(/vértice|arista/);
  });

  it("does not promise a remedy for a failure the user cannot fix", () => {
    // Telling someone to "resolve" a duplicate ID sends them hunting for an
    // edit that does not exist. Internal failures say what they are.
    const internal = rejectionStatus("wall.duplicateId", "technical");
    expect(internal).toContain("Fallo interno:");
    expect(internal).not.toContain("Cómo resolverlo:");
  });
});
