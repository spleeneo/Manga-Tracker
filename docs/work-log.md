# Work Log

Use this file to leave a trace of meaningful work so it can be resumed, reviewed, debugged, and learned from later.

Add or update an entry when starting a feature, bug fix, refactor, investigation, or production-relevant change. Keep entries concise, but include enough context that someone can pick up the work without rereading the whole conversation.

Entry format:

```markdown
## YYYY-MM-DD - Short Work Title

Why:
- What problem, user need, risk, or opportunity motivated this work?

Plan:
- The intended approach or checklist.

Changed:
- Files, modules, routes, or behaviors changed.

Verification:
- Commands run, browser flows checked, CI status, or what could not be verified.

Outcome:
- Done, partially done, blocked, reverted, or follow-up needed.

Learnings:
- Link to `docs/learnings.md` entry when this work reveals a reusable lesson.
```

## 2026-06-02 - Development Process Guardrails

Why:
- We wanted to reduce broken changes by making the development methodology visible, enforceable, and reusable across future work.

Plan:
- Document the methodology.
- Add repo-level AI instructions.
- Add a pull request checklist.
- Add a local verification command.
- Align CI with the local verification command.
- Add places to record future learnings and work state.

Changed:
- Added `docs/development-methodology.md`.
- Added `docs/learnings.md`.
- Added `docs/work-log.md`.
- Added `AGENTS.md`.
- Added `.github/pull_request_template.md`.
- Added `npm run verify`.
- Updated CI to run `npm run verify`.
- Updated `README.md` documentation links.

Verification:
- Ran `npm run verify` after adding the methodology and CI enforcement. It passed with existing lint warnings about `<img>` usage, 134 passing tests, and a successful production build.
- Later additions were documentation-only and were reviewed by diff.

Outcome:
- Approved for delivery on 2026-06-02. The work will be committed and pushed to `main` so CI/CD runs and production deployment is triggered by the existing workflow.

Learnings:
- See `docs/learnings.md`: "2026-06-02 - Development Methodology Should Be Enforced".

## 2026-06-02 - App Review After Process Guardrails

Why:
- We wanted to use the new methodology immediately to review the current application state and the active working tree.

Plan:
- Read the repository instructions and methodology.
- Inspect the current working tree.
- Review app-facing changes first, especially chapter/progress behavior.
- Run `npm run verify`.
- Report findings first, with file and line references.

Changed:
- Added this work-log entry only.

Verification:
- Ran `npm run verify`. It passed with 7 existing lint warnings about `<img>` usage, 134 passing tests, and a successful production build.

Outcome:
- Review completed. Findings were identified around chapter target source selection and test coverage.

Learnings:
- No new reusable learning logged yet; fix work should add one if the issue confirms a broader rule.

## 2026-06-02 - Fix Chapter Target Source Selection

Why:
- The app review found that quick chapter buttons could open a different duplicate-source version than the chapter list or library summary would prefer.

Plan:
- Add focused route tests for chapter target selection across duplicate sources.
- Update the target API helper to find the target chapter number first.
- Select the preferred candidate for that chapter number using source ranking.
- Run focused tests, then full verification.

Changed:
- `src/lib/chapters.ts`
- `src/app/api/manga/[slug]/chapters/route.ts`
- `tests/api/manga-chapters.route.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/api/manga-chapters.route.test.ts`: 7 tests passed.
- Ran `npm run verify`: passed with 7 existing `<img>` lint warnings, 136 passing tests, and a successful production build.
- Ran `npm run verify` again before delivery: passed with the same 7 existing `<img>` lint warnings, 136 passing tests, and a successful production build.

Outcome:
- Approved for delivery on 2026-06-02. Chapter targets now choose the boundary chapter number first, then prefer the best source candidate for that chapter number.

Learnings:
- See `docs/learnings.md`: "2026-06-02 - Chapter Targets Must Reuse Source Preference Rules".
