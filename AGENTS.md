# Repository Instructions

Read [docs/development-methodology.md](docs/development-methodology.md) before making code changes in this repository.

Default working rule:

1. Prefer small, verified changes.
2. Use test-driven development for logic-heavy code and bug fixes with clear expected behavior.
3. Use acceptance-style checks for important user workflows.
4. Run the smallest relevant test first, then broader verification before handoff.
5. For UI changes, verify the changed flow in the browser when the app can be run locally.
6. Report exactly what passed and what was not verified.
7. Save reusable lessons in `docs/learnings.md` when a bug, failed assumption, or useful pattern should influence future work.
8. Update `docs/work-log.md` for meaningful features, fixes, refactors, investigations, and production-relevant changes. Record why the work is happening, the plan, what changed, verification, outcome, and links to learnings.
9. After a complete piece of work is verified, commit it and push it to `main` by default. The user has given standing approval for verified work in this repository to be delivered this way. Do not wait for separate delivery approval unless the user explicitly asks to keep the work local, pause before delivery, or avoid pushing. Pushing to `main` triggers the CI/CD pipeline.

Minimum verification before calling a change done:

```bash
npm run verify
```

If `npm run verify` is too broad for the change or cannot run, run the most relevant focused checks and explain the gap.

Use `npm run smoke:update` when changes affect manga providers, chapter parsing, scheduled updates, or update-cycle behavior.

Do not leave substantial work only in conversation memory. Preserve the state in `docs/work-log.md` so it can be picked up later and used to understand where a future regression may have been introduced.
