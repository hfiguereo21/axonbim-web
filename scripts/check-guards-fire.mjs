#!/usr/bin/env node
/**
 * Fails when a guard stops catching what it exists to catch.
 *
 * Los guards de este repo estuvieron años sin ejercitarse: `check:history`
 * fallaba cerrado desde que se escribió porque el checkout superficial nunca le
 * daba el commit anterior, y `lint` no había corrido una sola vez en CI. Ninguno
 * estaba mal escrito — nada los había puesto a prueba. Una prueba de estrés
 * manual encontró tres evasiones (`it . skip(`, `it["skip"](`, un especificador
 * calculado en un import dinámico) que los patrones dejaban pasar.
 *
 * Este archivo convierte esa prueba en algo que corre en cada commit. Alimenta a
 * los matchers con las formas prohibidas y exige que disparen, y con código
 * legítimo y exige que callen — un guard que grita cuando no debe termina
 * desactivado, que es el mismo agujero por otro lado.
 *
 * Importa las funciones REALES (`scanLine`, `layerProblems`, `engineProblems`) y
 * no una copia de su lógica: un self-test que reimplementa el escaneo queda
 * verde mientras el guard de verdad está roto.
 *
 * Este archivo nombra las formas que prohíbe, así que está en el SKIPPED de
 * check-no-test-shortcuts — igual que el propio guard.
 */
import { engineProblems, LAYERS, layerProblems, scanLine } from "./lib/guard-rules.mjs";

const DOMAIN = LAYERS.find((l) => l.name === "dominio");
const VIEWER = LAYERS.find((l) => l.name === "viewer");
if (!DOMAIN || !VIEWER) {
  console.error("Las capas 'dominio' y 'viewer' ya no existen en LAYERS: el self-test no verifica nada.");
  process.exit(1);
}

/** `fire`: el guard debe reportar. `silent`: no debe reportar nada. */
const CASES = [
  // ── check:shortcuts: cada prohibición ──────────────────────────────────────
  ["shortcuts", "fire", 'describe.skip("x", () => {});'],
  ["shortcuts", "fire", 'it.only("x", () => {});'],
  ["shortcuts", "fire", 'test.todo("x");'],
  ["shortcuts", "fire", 'xit("x", () => {});'],
  ["shortcuts", "fire", 'xdescribe("x", () => {});'],
  ["shortcuts", "fire", "// @ts-ignore"],
  ["shortcuts", "fire", "// @ts-nocheck"],
  ["shortcuts", "fire", "// @ts-expect-error"],
  ["shortcuts", "fire", '"test": "vitest run --passWithNoTests"'],
  // Evasiones encontradas en la prueba de estrés. Nadie las escribe por
  // descuido: son formas de desactivar un test a propósito.
  ["shortcuts", "fire", 'it . skip("x", () => {});'],
  ["shortcuts", "fire", 'it["skip"]("x", () => {});'],
  ["shortcuts", "fire", "describe [ 'only' ]('x', () => {});"],
  // Código legítimo que NO debe disparar.
  ["shortcuts", "silent", 'it("hace algo", () => {});'],
  ["shortcuts", "silent", 'describe("grupo", () => {});'],
  ["shortcuts", "silent", "const skip = shouldSkip(step);"],
  ["shortcuts", "silent", 'it.each([1, 2])("caso %i", () => {});'],
  ["shortcuts", "silent", "const onlyOne = list.filter(Boolean);"],

  // ── check:layers, capa dominio ─────────────────────────────────────────────
  ["domain", "fire", 'import { useState } from "react";'],
  ["domain", "fire", 'const m = await import("three");'],
  ["domain", "fire", 'export * from "react";'],
  ["domain", "fire", 'import "react-dom/client";'],
  ["domain", "fire", 'require("zustand");'],
  ["domain", "fire", 'localStorage.getItem("x");'],
  ["domain", "fire", 'import { createViewport } from "@axonbim/viewer";'],
  // El string no es un uso, y `window`/`document` son sustantivos del dominio BIM.
  ["domain", "silent", 'const s = "localStorage.getItem";'],
  ["domain", "silent", "private readonly window: Window;"],
  ["domain", "silent", "return this.document.walls.length;"],
  ["domain", "silent", 'import { Vec3 } from "@axonbim/shared";'],

  // ── check:layers, capa viewer: Three sí, React no ──────────────────────────
  ["viewer", "silent", 'import * as THREE from "three";'],
  ["viewer", "fire", 'import { useState } from "react";'],

  // ── ADR 0021: el motor no conoce al CRM ────────────────────────────────────
  ["engine", "fire", 'import { get_session } from "$services/secService.ts";'],
  ["engine", "fire", 'import { db } from "@kaoru/db";'],
  ["engine", "fire", "const scope = { company_id: 35 };"],
  ["engine", "fire", 'const q = "SELECT wall_id FROM adm.wall";'],
  ["engine", "fire", "await import(moduleName);"],
  // El comentario que menciona la identidad prohibida no es acoplamiento, y un
  // import dinámico con literal sí es verificable.
  ["engine", "silent", "// El motor no conoce company_id ni tenant_id."],
  ["engine", "silent", 'const mod = await import("./wallProfile.ts");'],
  ["engine", "silent", 'import { Vec3 } from "@axonbim/shared";'],
];

function report(kind, code) {
  if (kind === "shortcuts") return scanLine(code);
  if (kind === "domain") return layerProblems("packages/model/src/probe.ts", code, DOMAIN);
  if (kind === "viewer") return layerProblems("packages/viewer/src/probe.ts", code, VIEWER);
  return engineProblems("packages/model/src/probe.ts", code);
}

const failures = [];
for (const [kind, expected, code] of CASES) {
  const got = report(kind, code).length > 0 ? "fire" : "silent";
  if (got !== expected) {
    failures.push(`${kind} esperaba ${expected} y obtuvo ${got}:\n    ${code}`);
  }
}

if (failures.length > 0) {
  console.error(`Guards que ya no hacen lo que prometen (${failures.length} de ${CASES.length}):\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    "\nUn caso que pasó a 'silent' es una puerta abierta; uno que pasó a 'fire' es un" +
      " falso positivo, y un guard que grita termina desactivado. Arregla el patrón," +
      " no el caso.",
  );
  process.exit(1);
}

console.log(`Guards verificados: ${CASES.length} casos (prohibiciones, evasiones y controles).`);
