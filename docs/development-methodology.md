# Development Methodology

This project should prefer short, verified development loops over large untested changes. The goal is simple: catch broken work early, make regressions visible, and keep each change small enough to reason about.

## Default Workflow

1. Understand the current behavior and the existing code path.
2. Define the smallest useful change.
3. Add or identify a focused failing test when the behavior can be tested cleanly.
4. Implement the smallest change that makes the test pass.
5. Refactor only after the behavior is covered.
6. Run the relevant automated checks.
7. Manually verify user-facing flows, especially UI changes.
8. Record what was verified and any remaining risk.
9. Save reusable learnings when a bug, failed assumption, or useful pattern should influence future work.
10. Update the work log for meaningful work so future development can resume with context.
11. Commit and push completed, verified work to `main` when it is approved for delivery, so CI/CD runs.

## Methods To Use

### Test-Driven Development

Use TDD for logic-heavy code, parsing, provider behavior, data transformations, permissions, and bug fixes with clear expected outcomes.

Pros:
- Catches regressions early.
- Forces clearer APIs and boundaries.
- Gives future changes a safety net.

Cons:
- Slower at first.
- Awkward for visual/UI polish.
- Bad tests can preserve bad assumptions.

### Acceptance Tests And Behavior Checks

Use acceptance-style tests for user-visible workflows and important business rules. Describe behavior in plain terms before implementing it.

Pros:
- Reduces requirement misunderstandings.
- Keeps implementation tied to user outcomes.
- Protects core workflows from regressions.

Cons:
- Can become noisy if every tiny interaction is specified.
- Higher maintenance cost when UI flows change often.

### Continuous Verification

Every meaningful change should run the smallest relevant check first, then broader checks before handoff.

Useful commands:

```bash
npm run verify
npm run test
npm run lint
npm run build
```

Use `npm run smoke:update` when changes affect manga update behavior, providers, chapters, or scheduled update flows.

Pros:
- Finds integration failures before deployment.
- Keeps broken states short-lived.
- Gives clear evidence that a change works.

Cons:
- Slow or flaky checks can waste time.
- Checks must stay maintained to remain trusted.

### Small Vertical Slices

Build one narrow working path end to end before expanding the feature.

Pros:
- Exposes integration issues early.
- Makes progress easier to inspect.
- Reduces the blast radius of mistakes.

Cons:
- Requires discipline to avoid overbuilding.
- Some architecture work may need a short spike first.

### Time-Boxed Spikes

Use a spike when the implementation is uncertain, a dependency is unfamiliar, or a technical approach needs proof before committing.

Pros:
- Reduces unknowns before major work.
- Prevents investing in the wrong approach.
- Produces evidence for a decision.

Cons:
- Spike code can be messy and should not be merged blindly.
- Can become procrastination if not time-boxed.

### Code Review And Self-Review

Before finishing a change, review the diff as if it came from someone else.

Check:
- Does the change solve the requested behavior?
- Are important edge cases covered?
- Are errors, loading states, and empty states handled?
- Did unrelated code change?
- Are tests focused and meaningful?
- Did lint/build/test verification run?

Pros:
- Catches mistakes automated tests miss.
- Improves maintainability.
- Encourages smaller, clearer changes.

Cons:
- Can drift into style-only feedback.
- Weak reviews can become a rubber stamp.

## Done Means Verified

A change is not done just because the code was edited. It is done when the relevant checks have passed or when the remaining unverified parts are explicitly named.

For backend or utility changes:
- Run focused tests when available.
- Run `npm run test`.
- Run `npm run lint` if touched code is lint-sensitive.

For frontend changes:
- Run relevant tests and lint.
- Start the app when needed.
- Verify the changed flow in the browser.
- Check responsive behavior when layout is affected.

For provider, scraper, or update changes:
- Test the specific provider behavior.
- Run `npm run smoke:update` when the change touches update flows.
- Watch for rate limits, missing chapters, duplicates, and parsing failures.

## Enforcement

This methodology is enforced through lightweight project conventions:

- `AGENTS.md` tells AI coding agents to read and apply this document before changing code.
- `.github/pull_request_template.md` requires verification notes and a checklist for each pull request.
- `npm run verify` runs lint, tests, and the production build as the default local gate.
- `.github/workflows/ci.yml` runs `npm run verify` on pull requests and pushes to `main`.

The process is allowed to be narrower for small changes, but the reason and the exact checks run should be recorded.

## Working With AI Assistance

AI-assisted changes should be held to the same bar as human changes, with extra attention to verification.

Default AI loop:

1. Read the relevant code before editing.
2. Prefer a focused test or reproducible check.
3. Make a small change.
4. Run the check.
5. Iterate until the evidence matches the claim.
6. Report exactly what passed and what was not verified.
7. Add a short entry to `docs/learnings.md` when the work reveals something the project should remember.

## Saving Learnings

Use [learnings.md](learnings.md) as the project memory for practical lessons. This should stay concise: capture the context, the learning, and the action that will prevent the same issue or help repeat the useful pattern.

Do not log every small implementation detail. Save learnings that change how future work should be done.

## Work Traceability

Use [work-log.md](work-log.md) to record why work is happening, the plan, changed areas, verification, outcome, and links to relevant learnings. The work log is for reconstructing project state later: what we intended, what changed, how we checked it, and where a regression may have entered.

Update it when work is meaningful enough that future debugging, resumption, or release notes would benefit from the context. Tiny typo fixes do not need a log entry unless they reveal a broader lesson.

## Delivery

After a feature, fix, or coherent piece of work is complete and verified, it should be committed and pushed to `main` when approved for delivery. The existing GitHub Actions workflow runs CI on `main`, and the deploy job runs after verification succeeds.

Do not treat local completion as delivery. Delivery happens when the work is pushed, CI/CD runs, and the result is visible in the target environment.
