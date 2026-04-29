export const CONTRACT_METADATA = {
  binName: "kilo-setup",
  binPath: "bin/gonkagate-kilo.js",
  cliVersion: "0.3.3", // x-release-please-version
  packageName: "@gonkagate/kilo-setup",
  publicEntrypoint: "npx @gonkagate/kilo-setup",
  publicState:
    "Installer runtime is shipped with a validated curated Kimi K2.6 default for @kilocode/cli >=7.2.0 installs, with installer-managed limit.output = 8192 for compatibility.",
  secondaryBinName: "gonkagate-kilo",
  upstreamKilo: {
    checkedAt: "2026-04-29",
    investigatedVersion: "7.2.0",
    minimumVersion: "7.2.0",
    packageName: "@kilocode/cli",
    supportedVersionRange: ">=7.2.0",
  },
} as const;
