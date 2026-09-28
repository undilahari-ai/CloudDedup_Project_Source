# Automated Test Report

## Scope

This report records automated/static verification performed while preparing the cleaned Task 1 submission package.

## Results

- Deduplication helper unit tests: **5 passed / 0 failed**
  - normalization
  - stable SHA-256 hash
  - identical similarity
  - clearly different similarity
  - close-record review threshold
- Security/source consistency assertions: **passed**
  - authenticated Firestore access required
  - no public blanket read/write rule
  - per-user isolation rule present
  - document-key validation present
  - atomic `getAfter(...)` guards present
  - no old FastAPI `VITE_API_URL` production dependency
- TypeScript project compilation (`tsc -b --pretty false`): **passed**
- `npm ci --package-lock-only --ignore-scripts --offline`: **passed**
- npm lock audit result during that command: **0 vulnerabilities reported**

## Environment-specific build note

The originally supplied ZIP contained a Windows-generated `frontend/node_modules` directory. Its Vite/Rolldown optional native package was Windows-only, so that copied dependency tree cannot perform a Linux production bundle. This is an artifact-packaging problem rather than a TypeScript source error: TypeScript compilation passed before Vite reached the missing platform binding.

The cleaned submission intentionally excludes `node_modules` and stale `dist`. A deployment machine must run a fresh `npm ci` for its own operating system and then `npm run build`. This is the standard reproducible source-package workflow.

## Still required before the final CodeAlpha form submission

A live Firebase account/project is required to run the end-to-end Authentication/Firestore/Hosting cases in `docs/TEST_PLAN.md`. Those cloud-dependent tests cannot be truthfully recorded as passed until they are executed against the deployed project.
