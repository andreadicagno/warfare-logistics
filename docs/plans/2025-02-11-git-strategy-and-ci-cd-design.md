# Git Branching, Tagging & CI/CD Design

## Branching Model

### Permanent Branches

- **`main`** — Stable, always deployable. Every push triggers build + deploy to GitHub Pages.
- **`develop`** — Active development. All feature branches merge here.

### Temporary Branches

- **`feature/<name>`** — Created from `develop`, merged back into `develop`. Deleted after merge.
- **`hotfix/<name>`** — Created from `main` for urgent fixes. Merged into both `main` and `develop`.

### Flow

```
feature/supply-routes → develop → main (deploy)
hotfix/critical-fix → main + develop
```

### Rules

- No direct pushes to `main` — only merges from `develop` or `hotfix/*`.
- `develop` accepts direct pushes (small fixes) and merges from feature branches.
- Merge from `develop` to `main` is manual and intentional.

## Tagging & Releases

### Format

`v<major>.<minor>.<patch>` — e.g. `v0.2.0`, `v0.3.1`

### When to Tag

- After a merge from `develop` to `main` that represents a significant milestone.
- Not every merge requires a tag — only notable releases.

### What a Tag Does

- Marks a point in history on `main`.
- Used to create a GitHub Release with descriptive notes.
- Does NOT trigger deployment — deploy happens on push to `main`.

### Versioning Scheme

- `0.x.x` — Pre-release development (current phase).
- Patch (`0.1.1`) — Bugfixes.
- Minor (`0.2.0`) — New features or milestones.
- Major (`1.0.0`) — First complete playable version.
- `package.json` version updated manually at tag time.

## CI/CD Pipeline

### Workflow 1: `ci.yml` — Quality Checks

- **Trigger:** Every push on any branch + every pull request.
- **Runtime:** Bun on Ubuntu with dependency caching.
- **Steps:**
  1. Checkout code
  2. Install Bun
  3. Install dependencies (`bun install`)
  4. Lint (`bun run lint`)
  5. Typecheck (`bun run typecheck`)
  6. Test (`bun run test`)

### Workflow 2: `deploy.yml` — Build & Deploy to GitHub Pages

- **Trigger:** Push to `main` only.
- **Condition:** Runs after quality checks pass.
- **Runtime:** Bun on Ubuntu with dependency caching.
- **Steps:**
  1. Checkout code
  2. Install Bun
  3. Install dependencies (`bun install`)
  4. Build (`bun run build`)
  5. Upload build artifact (`actions/upload-pages-artifact`)
  6. Deploy to GitHub Pages (`actions/deploy-pages`)
- **GitHub Pages mode:** "GitHub Actions" (not branch-based).

### Vite Configuration Change

Add `base: '/warfare-logistics/'` to `vite.config.ts` for correct subpath serving on GitHub Pages.

## Summary

| Aspect | Decision |
|--------|----------|
| Branching | `main` + `develop` + feature/hotfix branches |
| Tagging | Semantic Versioning (`v0.x.x`) |
| Deploy trigger | Every push to `main` |
| Tag purpose | GitHub Releases with notes (no deploy trigger) |
| CI checks | All branches + PRs |
| CI tools | Bun, Biome, tsc, Vitest |
| Hosting | GitHub Pages via Actions |
