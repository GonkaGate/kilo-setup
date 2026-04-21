# README Header Style Proposal

This document proposes a shared header style for our public open source
repositories and includes a concrete `kilo-setup` example.

## Recommendation

Use one consistent pattern across public repositories:

1. small official GonkaGate logo
2. repository name as the main heading
3. one sentence with the value proposition
4. one primary command or CTA
5. one compact row of quick links
6. one compact row of badges

This is the best balance between polish, maintenance cost, and reliability on
GitHub.

## Why This Direction

The most important README constraints are simple:

- GitHub README rendering is still Markdown-first, not a full layout system
- inline HTML works well enough for lightweight branding
- GitHub truncates README content after `500 KiB`

That means the least fragile headers are usually built from:

- Markdown
- a small amount of HTML such as `<p>` and `<img>`
- a few curated badges

## Recommended House Style

Call this style `Branded Text-First Header`.

What it should feel like:

- product-first, not profile-readme cosplay
- branded, but not decorative
- readable in both dark and light GitHub themes without alternate assets
- fast to scan in the first screenful
- maintainable without a design tool dependency on every edit

Recommended structure:

1. small official logo
2. repository name
3. one-line value proposition
4. one visible command or install snippet
5. 4-6 quick links max
6. 3-5 badges max

## What To Avoid By Default

These elements can look fun in isolation, but they scale poorly across a
portfolio of repos:

- AI-generated hero art
- animated typing banners
- star-history graphs in the header
- GitHub stats cards in product READMEs
- giant badge walls
- long language switchers when the repo is not truly localized
- custom image banners unless the repo truly needs a visual hero

Use those only when the repo specifically benefits from them.

## Tooling

### Safe defaults

- official GonkaGate logo asset committed into the repo
- `Shields.io` for badges
- GitHub Markdown plus minimal inline HTML

### Tools I would not make part of the default standard

- `capsule-render`
- `readme-typing-svg`
- `github-readme-stats`

Why:

- they are external runtime dependencies for the rendered README
- their public endpoints are typically best-effort
- their own docs often recommend self-hosting for reliability
- they make a shared repo standard feel inconsistent and harder to control
- AI-generated repo art is hard to keep on-brand at scale

## Style Variants

If we want one system for all public repos, I would keep only three approved
variants.

### Variant A: CLI / SDK / Infra product

Use this for installer, CLI, SDK, proxy, backend, or tooling repos.

- small logo
- repo name
- value prop
- command
- quick links
- badges

This should be the default variant.

### Variant B: UI / demo-heavy product

Use this when the screenshot itself sells the repo.

- small logo
- repo name
- value prop
- screenshot or GIF under the fold, not in the header
- quick links
- badges

### Variant C: curated list / awesome repo

Use this for directories, collections, or reference repos.

- small logo
- repo name
- one-sentence framing
- quick navigation row
- optional count/update badge row

## Shared Rules

- the header must fit into the first screenful on laptop GitHub view
- the command must be copyable without scrolling
- the value proposition must stay under 18 words if possible
- badges should communicate trust, not vanity
- screenshots belong below the header unless the repo is explicitly visual
- the logo should be official, not AI-generated
- the header should work even if all images fail except the small logo

## Badge Policy

Keep badges curated. Good defaults:

- package version
- supported runtime baseline
- license
- CI status
- optional product-owned resource links when they help users leave GitHub for
  the right next step

Usually avoid:

- stars
- downloads
- Discord online
- vanity social badges

Those are more useful in community-heavy repos than in product READMEs.

## `kilo-setup` Example

Recommended top-of-README snippet:

````md
<p>
  <img src="./assets/readme/gonkagate-logo.png" alt="GonkaGate logo" width="28" height="28">
</p>

# kilo-setup

Set up local `kilo` to use GonkaGate in one `npx` command.

```bash
npx @gonkagate/kilo-setup
```

[Quick start](#shortest-start-path) ·
[`user` vs `project`](#user-vs-project-scope) ·
[How it works](./docs/how-it-works.md) ·
[Security](./docs/security.md) ·
[Troubleshooting](./docs/troubleshooting.md) ·
[License](./LICENSE)

![Package](https://img.shields.io/badge/package-%40gonkagate%2Fkilo--setup-6E63FF?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D22.14.0-4DA2FF?style=flat-square)
![Kilo](https://img.shields.io/badge/kilo-7.2.0-35D6FF?style=flat-square)
![License](https://img.shields.io/badge/license-Apache--2.0-2A2A2A?style=flat-square)

[![Website](https://img.shields.io/badge/Website-gonkagate.com-111827?style=flat-square)](https://gonkagate.com/en)
[![Docs](https://img.shields.io/badge/Docs-API%20Guides-2563EB?style=flat-square)](https://gonkagate.com/en/docs)
[![API%20Key](https://img.shields.io/badge/API%20Key-Dashboard-F97316?style=flat-square)](https://gonkagate.com/en/register)
[![Telegram](https://img.shields.io/badge/Telegram-%40gonkagate-229ED9?style=flat-square&logo=telegram&logoColor=white)](https://t.me/gonkagate)
[![X](https://img.shields.io/badge/X-%40gonkagate-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/gonkagate)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-GonkaGate-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/gonkagate)
````

## Why The Example Works For `kilo-setup`

- it preserves the repo's current honest and contract-driven positioning
- it surfaces the single command earlier
- it stays branded without relying on AI-generated art
- it keeps first-party resource links close to the CTA without turning into a
  vanity badge wall
- it avoids fragile banner assets

## Suggested Rollout

1. adopt Variant A as the default for public product repos
2. keep one shared template in a small internal repo or design doc
3. keep badge count low and standardized
4. use the official GonkaGate logo consistently
5. treat custom header art as an exception, not the default

## Sources

- [GitHub Docs: About the repository README file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [GitHub Docs: Basic writing and formatting syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Shields.io Docs](https://shields.io/docs)
- [Shields.io Static Badges](https://shields.io/docs/static-badges)
- [GonkaGate website](https://gonkagate.com/en)
- local GonkaGate logo asset copied from the frontend brand assets
