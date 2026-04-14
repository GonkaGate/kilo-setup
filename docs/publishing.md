# Publishing and Release Automation

This repository is set up for `release-please` style releases plus npm trusted
publishing through GitHub Actions.

Repository-side automation is checked in here. One-time GitHub and npm setup
outside the repository is still required before the first automated publish can
work.

Current package contract:

- package name: `@gonkagate/kilo-setup`
- public entrypoint: `npx @gonkagate/kilo-setup`
- release workflow: `.github/workflows/release-please.yml`
- publish workflow: `.github/workflows/publish.yml`
- trusted-publishing environment: `release`
- publish command: `npm publish --provenance --access public`

## What Is Automated

The intended ongoing flow is:

1. Changes land on `main` with conventional releasable titles such as
   `fix: ...` or `feat: ...`.
2. `release-please` opens or updates the release PR.
3. When the release PR is merged, `release-please` tags the release and updates
   versioned files.
4. The release workflow dispatches `publish.yml`.
5. `publish.yml` installs dependencies, runs `npm run ci`, performs the npm
   OIDC preflight exchange, and publishes with provenance if that version is
   not already on npm.

The version sync points currently include:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `src/constants/contract.ts`
- `.release-please-manifest.json`

For `src/constants/contract.ts`, keep the inline
`// x-release-please-version` marker on `cliVersion`. That is the same
practical pattern already used in `opencode-setup` so `release-please` keeps
the runtime contract version aligned after merge.

## Files In This Repository

Release automation is defined by these files:

- `.github/workflows/release-please.yml`
- `.github/workflows/publish.yml`
- `release-please-config.json`
- `.release-please-manifest.json`

The `release-please` config uses the `node` release type and keeps
`src/constants/contract.ts` aligned through `extra-files`.

## One-Time GitHub Setup

Create the GitHub Actions environment used by the publish workflow:

1. Open `Settings` -> `Environments` in the GitHub repository.
2. Create an environment named exactly `release`.
3. Leave secrets empty unless you have some unrelated deployment gate to add.
4. If you want protection rules, the safest simple option is to restrict the
   environment to `main` or protected branches only.

Minimum exact value:

- `Environment name`: `release`

## One-Time npm Trusted Publisher Setup

In the npm package settings for `@gonkagate/kilo-setup`, add a trusted
publisher with these exact values:

- `Publisher`: `GitHub Actions`
- `Organization or user`: `GonkaGate`
- `Repository`: `kilo-setup`
- `Workflow filename`: `publish.yml`
- `Environment name`: `release`

Important details from npm's current trusted-publishing docs:

- the workflow filename must match exactly, including `.yml`
- enter only the filename, not `.github/workflows/publish.yml`
- the repository must match `package.json` repository metadata exactly
- publishing must run on GitHub-hosted runners with `id-token: write`

## Release Title Discipline

`release-please` infers the next version from merged commit or PR titles on
`main`, so releasable changes should use conventional titles:

- `fix: ...` for a patch release
- `feat: ...` for a minor release
- `feat!: ...` or `fix!: ...` for a major release

Avoid vague titles such as `misc fixes`, `cleanup`, or `update readme` if the
change is meant to ship.

## First Enablement Checklist

Before you rely on the automated path, confirm all of these:

1. The npm scope `@gonkagate` exists and the package is owned by the correct
   npm account or organization.
2. `package.json` still points to
   `git+https://github.com/GonkaGate/kilo-setup.git`.
3. GitHub environment `release` exists.
4. npm Trusted Publisher is configured with `publish.yml` and `release`.
5. `npm run ci` passes on `main`.

## Recommended Dry Run After Setup

After the GitHub and npm settings are configured, validate the OIDC path before
the first real release:

1. Open the `Publish (npm)` workflow in GitHub Actions.
2. Run it manually with:
   - `action = check`
   - `publish_ref =` empty
3. Confirm the `OIDC preflight (token exchange)` step succeeds.

That path verifies the trusted-publishing handshake without publishing a
package.

## Day-To-Day Release Flow

After the one-time setup is done:

1. Merge releasable changes to `main` with conventional titles.
2. Review the release PR created by `release-please`.
3. Merge the release PR.
4. Watch `release-please.yml` dispatch `publish.yml`.
5. Confirm the published version on
   `https://www.npmjs.com/package/@gonkagate/kilo-setup`.

## Troubleshooting

### `ENEEDAUTH` during GitHub Actions publish

The most common causes are:

- npm Trusted Publisher values do not exactly match the repository
- the configured workflow filename is not exactly `publish.yml`
- the trusted publisher expects environment `release`, but the job uses a
  different environment or none at all
- `id-token: write` was removed from the workflow

### Release PR opens, but nothing gets published

Check:

- whether `release-please` reported `release_created == true`
- whether `publish.yml` was dispatched successfully
- whether the target version is already published on npm
- whether the `release` environment protection rules blocked the job

### Manual emergency publish

The repository still supports a manual GitHub Actions publish path through
`publish.yml` with `workflow_dispatch`.

Use `action = publish` and set `publish_ref` to the release tag you want to
publish, for example `v0.1.0`.
