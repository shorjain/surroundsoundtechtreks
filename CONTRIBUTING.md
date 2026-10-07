# Working together
1. Pull main before starting work.
2. Create a branch: `git switch -c feat/room-joining`.
3. Keep each change focused. Copy env examples locally; never commit credentials.
4. Run `npm ci && npm run build` in frontend/. Check the API health endpoint for backend changes.
5. Commit and push your branch, then open a pull request into main.
6. Explain what changed and how you checked it. Ask a teammate to review before merging.

Commit frontend/package-lock.json whenever dependencies change. Python requirements currently use
compatible version ranges; agree on a lockfile workflow before production release.
