import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMatchesAll,
  assertMirroredSkillDirectory,
  readText,
} from "./contract-helpers.js";

const mirroredSkillDirectories = [
  "code-simplification",
  "coding-prompt-normalizer",
  "node-security-review",
  "opencode-compatibility-audit",
  "planning-and-task-breakdown",
  "spec-first-brainstorming",
  "technical-design-review",
  "typescript-coder",
  "typescript-coder-plan-spec",
  "typescript-error-modeling-and-boundaries",
  "typescript-node-esm-compiler-runtime",
  "typescript-public-api-design",
  "typescript-refactoring-and-simplification-patterns",
  "typescript-runtime-boundary-modeling",
  "typescript-systematic-debugging",
  "typescript-type-safety-review",
  "verification-before-completion",
] as const;

test("mirrored skill assets stay aligned across .agents and .claude", () => {
  for (const skillDirectory of mirroredSkillDirectories) {
    assertMirroredSkillDirectory(skillDirectory);
  }
});

test("AGENTS documents the mirrored skill pack", () => {
  const agents = readText("AGENTS.md");

  assertMatchesAll(agents, [
    /\.agents\/skills\//,
    /\.claude\/skills\//,
    /mirrored skill pack/i,
  ]);
});

test("the imported skill pack includes the expected high-value entries", () => {
  const typescriptCoder = readText(".agents/skills/typescript-coder/SKILL.md");
  const verification = readText(
    ".agents/skills/verification-before-completion/SKILL.md",
  );
  const securityReview = readText(
    ".agents/skills/node-security-review/SKILL.md",
  );
  const planning = readText(
    ".agents/skills/planning-and-task-breakdown/SKILL.md",
  );

  assert.match(typescriptCoder, /typescript-coder/);
  assert.match(verification, /verification-before-completion/i);
  assert.match(securityReview, /node-security-review/);
  assert.match(planning, /Planning and Task Breakdown/);
});
