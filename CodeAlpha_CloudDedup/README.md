# CodeAlpha_CloudDedup

**CloudDedup — Data Redundancy Removal System**  
CodeAlpha Cloud Computing Task 1 implementation.

## What this project does

CloudDedup validates records before they are stored in Cloud Firestore. It:

1. normalizes title and description text;
2. calculates a SHA-256 content hash;
3. blocks exact duplicates using an atomic Firestore hash reservation;
4. compares new records with verified records using bigram similarity;
5. sends records at or above the `0.82` similarity threshold to a review queue;
6. lets the user classify a possible duplicate as a false positive (Approve) or confirmed duplicate (Reject);
7. stores only verified unique records and approved false positives;
8. records blocked duplicate events for dashboard statistics.

The application is intentionally a **single production architecture**:

**React + TypeScript + Vite → Firebase Authentication → Cloud Firestore → Firebase Hosting**

There is no separate FastAPI/PostgreSQL production backend in this submission.

## CodeAlpha Task 1 mapping

| Requirement | Implementation |
|---|---|
| Identify and classify redundant / false-positive data | SHA-256 exact detection plus similarity review queue and manual approve/reject |
| Validate new data against existing data | Normalization, hash lookup, and similarity scan before storage |
| Prevent duplicate cloud database entries | Atomic Firestore transaction creates a hash guard and verified record together |
| Append only unique and verified data | `UNIQUE` and approved `FALSE_POSITIVE` records are the only verified record statuses |
| Improve accuracy and efficiency | O(1) exact-hash lookup before the more expensive similarity scan; duplicate attempts are never added as verified records |

> Deduplication is scoped to each authenticated user's data set. This keeps one user's private records inaccessible to other users while still guaranteeing exact uniqueness inside that user's collection.

## Requirements

- Node.js 22+
- npm 10+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with:
  - Authentication → Email/Password enabled
  - Cloud Firestore enabled
  - Firebase Hosting enabled

The included Firebase config currently points to the existing `clouddedup-e4e48` project. Firebase Web App configuration values are client identifiers; database access is controlled by Authentication and `firestore.rules`.

## Clean installation and verification

```bash
cd frontend
npm ci
npm run check
npm run build
```

`npm run check` runs:

- 5 deduplication unit tests;
- source/security consistency assertions;
- TypeScript compilation.

## Local development

```bash
cd frontend
npm ci
npm run dev
```

Open the Vite URL shown in the terminal.

## Production deployment

First authenticate the Firebase CLI:

```bash
firebase login
```

Then, from `frontend/`:

```bash
npm ci
npm run check
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

After deployment, test the live URL using the scenarios in `docs/TEST_PLAN.md` before recording the final submission video.

## Repository name

The CodeAlpha instructions request a GitHub repository named in the form:

`CodeAlpha_ProjectName`

Recommended repository name for this task:

`CodeAlpha_CloudDedup`

## Submission contents

- `frontend/` — application source and Firebase deployment configuration
- `docs/ARCHITECTURE.md` — architecture and data flow
- `docs/TRACEABILITY.md` — requirement-to-code mapping
- `docs/TEST_PLAN.md` — final manual verification scenarios
- `docs/DEPLOYMENT.md` — deployment checklist
- `SUBMISSION_CHECKLIST.md` — CodeAlpha submission steps
- `evidence/TEST_REPORT.md` — automated verification performed on this package

Generated dependencies (`node_modules`) and build output (`dist`) are intentionally excluded from source control and this ZIP. Recreate them with `npm ci` and `npm run build` on the deployment machine.
