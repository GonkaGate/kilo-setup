import assert from "node:assert/strict";
import test from "node:test";
import { readText } from "./contract-helpers.js";

test("README stays usable as the first-stop GitHub and npm landing page", () => {
  const readme = readText("README.md");

  assert.match(
    readme,
    /Set up local `kilo` to use GonkaGate in one `npx` command/i,
  );
  assert.match(readme, /https:\/\/gonkagate\.com\/en/);
  assert.match(readme, /https:\/\/gonkagate\.com\/en\/docs/);
  assert.match(readme, /https:\/\/gonkagate\.com\/en\/register/);
  assert.match(readme, /## Before You Start/);
  assert.match(readme, /## Shortest Start Path/);
  assert.match(readme, /### Interactive setup/);
  assert.match(readme, /### Non-interactive setup/);
  assert.match(readme, /`user` vs `project` Scope/);
  assert.match(readme, /GONKAGATE_API_KEY/);
  assert.match(readme, /--api-key-stdin/);
  assert.match(readme, /~\/\.config\/kilo\/kilo\.jsonc/);
  assert.match(readme, /\.kilo\/kilo\.jsonc/);
  assert.match(readme, /~\/\.gonkagate\/kilo\/api-key/);
  assert.match(readme, /@kilocode\/cli@7\.2\.0/);
  assert.match(readme, /chat\/completions/);
  assert.match(readme, /qwen\/qwen3-235b-a22b-instruct-2507-fp8/);
  assert.match(readme, /no native Windows production claim yet/i);
});
