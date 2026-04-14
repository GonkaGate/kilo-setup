export const CONTRACT_METADATA = {
  binName: "kilo-setup",
  binPath: "bin/gonkagate-kilo.js",
  cliVersion: "0.2.1", // x-release-please-version
  packageName: "@gonkagate/kilo-setup",
  publicEntrypoint: "npx @gonkagate/kilo-setup",
  publicState:
    "Installer runtime is shipped with a validated curated Qwen default for exact @kilocode/cli@7.2.0 installs, without an installer-owned output-token clamp.",
  secondaryBinName: "gonkagate-kilo",
  upstreamKilo: {
    checkedAt: "2026-04-14",
    investigatedVersion: "7.2.0",
    minimumVersion: "proof-gate-pending",
    packageName: "@kilocode/cli",
  },
} as const;
