# Contributing to `@mifos-x/shared-types`

This document explains how to add or change types, handle breaking changes, and how to publish updates so dependent packages consume them correctly.

1. Update `src/index.ts`
   - Add or modify exports in `packages/shared-types/src/index.ts`.
   - Keep this package types-only: do not add runtime logic or side-effects.

2. Build locally

```bash
cd packages/shared-types
npm run build
# or from repository root
pnpm --filter @mifos-x/shared-types run build
```

This generates `dist/index.js` and `dist/index.d.ts`. Consumers rely on the `.d.ts` artifact defined in `package.json` (`types: ./dist/index.d.ts`).

3. Versioning and breaking changes
   - Follow semver. If you introduce a breaking change (rename/remove fields, change types), bump the major version and add a migration note in `CHANGELOG.md` or PR description.
   - Add a short paragraph in the PR describing which consumers will be affected and suggested migration steps.

4. Tests and usage validation
   - Add unit tests or TypeScript-only test files in a consuming package to validate type changes when practical.
   - Optionally, create a small `examples/` file in the package to show canonical usage.

5. Pull request checklist
   - Ensure `npm run build` passes locally and `dist/index.d.ts` updated.
   - Update README/TYPE_REFERENCE if new types or important semantics were added.
   - Document any deprecations or compatibility notes.

6. Consumer update
   - After merging, update the dependent packages to use the new version. In the monorepo, you may simply bump the package version and run the workspace install flow.

7. Recommended practices
   - Keep types minimal and semantically clear.
   - Prefer explicit fields over ambiguous shapes.
   - When possible, mirror canonical backend API definitions (OpenAPI, JSON Schema) or consider generating types from upstream specs.

If you want, I can add a simple `TYPE_REFERENCE.md` and wire it from `README.md`, or open a PR template that reminds maintainers to bump versions and add migration notes. Which should I do next?
