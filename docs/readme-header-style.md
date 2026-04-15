# README Header Style Proposal

This document proposes a shared header style for our public open source
repositories and includes a concrete `kilo-setup` example.

## Recommendation

Use one consistent pattern across public repositories:

1. local hero image stored in the repo as `SVG`
2. one sentence with the value proposition
3. one primary command or CTA
4. one compact row of quick links
5. one compact row of badges

This is the best balance between polish, maintenance cost, and reliability on
GitHub.

## Why This Direction

The most important README constraints are simple:

- GitHub README rendering is still Markdown-first, not a full layout system
- inline HTML works well enough for centering and image selection
- GitHub recommends relative links and image paths for repo assets
- GitHub truncates README content after `500 KiB`

That means the best-looking and least fragile headers are usually built from:

- Markdown
- a small amount of HTML such as `<p align="center">` and `<picture>`
- repo-local `SVG` or `PNG` assets
- a few curated badges

## Recommended House Style

Call this style `Branded Practical Hero`.

What it should feel like:

- product-first, not profile-readme cosplay
- visually branded, but not overloaded
- readable in both dark and light GitHub themes
- fast to scan in the first screenful
- maintainable by humans without a design tool dependency on every edit

Recommended structure:

1. hero banner with product name and short message
2. one-line value proposition under the banner
3. one visible command or install snippet
4. 4-6 quick links max
5. 3-5 badges max

## What To Avoid By Default

These elements can look fun in isolation, but they scale poorly across a
portfolio of repos:

- animated typing banners
- star-history graphs in the header
- GitHub stats cards in product READMEs
- giant badge walls
- long language switchers when the repo is not truly localized
- external hero generators as the primary banner dependency

Use those only when the repo specifically benefits from them.

## Tooling

### Safe defaults

- repo-local `SVG` hero files
- `Shields.io` for badges
- GitHub Markdown plus minimal inline HTML
- `<picture>` for dark/light theme switching

### Optional tools

- Figma, Sketch, or Canva to design the hero and export SVG
- `svgo` to optimize exported SVGs before committing

### Tools I would not make part of the default standard

- `capsule-render`
- `readme-typing-svg`
- `github-readme-stats`

Why:

- they are external runtime dependencies for the rendered README
- their public endpoints are typically best-effort
- their own docs often recommend self-hosting for reliability
- they make a shared repo standard feel inconsistent and harder to control

## Style Variants

If we want one system for all public repos, I would keep only three approved
variants.

### Variant A: CLI / SDK / Infra product

Use this for installer, CLI, SDK, proxy, backend, or tooling repos.

- hero banner
- value prop
- command
- quick links
- badges

This should be the default variant.

### Variant B: UI / demo-heavy product

Use this when the screenshot itself sells the repo.

- hero banner
- value prop
- screenshot or GIF under the fold
- quick links
- badges

### Variant C: curated list / awesome repo

Use this for directories, collections, or reference repos.

- hero banner
- one-sentence framing
- quick navigation row
- optional count/update badge row

## Shared Rules

- the header must fit into the first screenful on laptop GitHub view
- the command must be copyable without scrolling
- the value proposition must stay under 18 words if possible
- badges should communicate trust, not vanity
- screenshots belong below the header unless the repo is explicitly visual
- relative links should be used for repo assets and internal docs

## Badge Policy

Keep badges curated. Good defaults:

- package version
- supported runtime baseline
- license
- CI status

Usually avoid:

- stars
- downloads
- Discord online
- social handles

Those are more useful in community-heavy repos than in product READMEs.

## `kilo-setup` Example

I prepared a concrete hero for this repo:

- light theme: [assets/readme/kilo-setup-hero-light.svg](../assets/readme/kilo-setup-hero-light.svg)
- dark theme: [assets/readme/kilo-setup-hero-dark.svg](../assets/readme/kilo-setup-hero-dark.svg)

Recommended top-of-README snippet:

```md
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/readme/kilo-setup-hero-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./assets/readme/kilo-setup-hero-light.svg">
    <img src="./assets/readme/kilo-setup-hero-light.svg" alt="GonkaGate Kilo Setup hero banner">
  </picture>
</p>

<p align="center">
  <strong>Configure local <code>kilo</code> for GonkaGate in one safe <code>npx</code> command.</strong>
</p>

<p align="center">
  <code>npx @gonkagate/kilo-setup</code>
</p>

<p align="center">
  <a href="#shortest-start-path">Quick start</a>
  ·
  <a href="#user-vs-project-scope"><code>user</code> vs <code>project</code></a>
  ·
  <a href="./docs/how-it-works.md">How it works</a>
  ·
  <a href="./docs/security.md">Security</a>
  ·
  <a href="./docs/troubleshooting.md">Troubleshooting</a>
  ·
  <a href="./LICENSE">License</a>
</p>

<p align="center">
  <img alt="package" src="https://img.shields.io/badge/package-%40gonkagate%2Fkilo--setup-1f6feb?style=flat-square">
  <img alt="node version" src="https://img.shields.io/badge/node-%3E%3D22.14.0-0f766e?style=flat-square">
  <img alt="kilo profile" src="https://img.shields.io/badge/kilo-7.2.0-111827?style=flat-square">
  <img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-334155?style=flat-square">
</p>
```

For `kilo-setup` specifically, a static package badge is more truthful than an
`npm version` badge because the current repository state does not claim the
first automated publish is already complete.

## Why The Example Works For `kilo-setup`

- it preserves the repo's current honest and contract-driven positioning
- it surfaces the single command earlier
- it looks more polished without hiding important limitations
- it avoids vanity widgets that distract from setup trust

## Suggested Rollout

1. adopt Variant A as the default for public product repos
2. keep one shared template in a small internal repo or design doc
3. prepare one dark and one light SVG per repo
4. keep badge count low and standardized
5. treat external dynamic widgets as opt-in exceptions

## Sources

- [GitHub Docs: About the repository README file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [GitHub Docs: Basic writing and formatting syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Shields.io Docs](https://shields.io/docs)
- [Shields.io Static Badges](https://shields.io/docs/static-badges)
- [capsule-render](https://github.com/kyechan99/capsule-render)
- [readme-typing-svg](https://github.com/DenverCoder1/readme-typing-svg)
- [github-readme-stats](https://github.com/anuraghazra/github-readme-stats)
