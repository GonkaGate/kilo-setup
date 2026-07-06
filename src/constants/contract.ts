export const CONTRACT_METADATA = {
  binName: "kilo-setup",
  binPath: "bin/gonkagate-kilo.js",
  cliVersion: "0.8.0", // x-release-please-version
  packageName: "@gonkagate/kilo-setup",
  publicEntrypoint: "npx @gonkagate/kilo-setup",
  publicState:
    "Installer runtime fetches the GonkaGate chat-completions model catalog from /v1/models after safe API-key intake for @kilocode/cli >=7.2.0 installs.",
  secondaryBinName: "gonkagate-kilo",
  upstreamKilo: {
    checkedAt: "2026-04-29",
    investigatedVersion: "7.2.0",
    minimumVersion: "7.2.0",
    packageName: "@kilocode/cli",
    supportedVersionRange: ">=7.2.0",
  },
} as const;
