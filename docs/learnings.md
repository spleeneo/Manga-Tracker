# Learnings Log

Use this file to capture reusable lessons from development, debugging, production issues, and AI-assisted work. Keep entries short and practical.

Add a note when:

- A bug reveals a missing test, unclear assumption, or fragile code path.
- A provider, API, or framework behaves differently than expected.
- A verification step catches something important.
- A repeated development mistake suggests a new rule or checklist item.
- A useful pattern should be reused later.
- A work-log entry reveals a decision, broken assumption, or delivery issue worth remembering.

Entry format:

```markdown
## YYYY-MM-DD - Short Title

Context:
- What were we trying to do?

Learning:
- What should we remember next time?

Action:
- Test, checklist item, code pattern, documentation update, or follow-up task.
```

## 2026-06-02 - Development Methodology Should Be Enforced

Context:
- We wanted to reduce cases where code changes appear complete but fail during real use.

Learning:
- A methodology is only useful when it is visible in the repo and connected to the normal development path.

Action:
- Added `docs/development-methodology.md`, `AGENTS.md`, a PR checklist, `npm run verify`, and CI verification.

## 2026-06-02 - Work Needs A Durable Trace

Context:
- We wanted future work to be resumable and future regressions easier to diagnose.

Learning:
- Conversation history is not enough project memory. Meaningful work should record why it happened, the plan, changed areas, verification, outcome, and any lessons learned.

Action:
- Added `docs/work-log.md` and linked it from the methodology, agent instructions, README, and PR checklist.

## 2026-06-02 - Chapter Targets Must Reuse Source Preference Rules

Context:
- A review found that quick-open chapter targets could choose a different duplicate chapter source than the visible chapter list and library summary.

Learning:
- Any endpoint that selects a single chapter from duplicate source candidates must apply the same source preference rules as the user-facing list/summary behavior.

Action:
- Updated chapter target selection to choose the boundary chapter number first, then select the preferred source candidate for that chapter number.
- Added tests for `latest` and `next-unread` duplicate-source selection.

## 2026-06-03 - Provider Error Payloads Must Stay Visible

Context:
- Investigating why MangaPlus title `100405` for Asura's Verdict did not appear or sync showed that the MangaPlus API returned an `Account Banned` error payload instead of title metadata or chapters.

Learning:
- Scrapers that convert upstream provider errors into empty results make blocked, banned, region-limited, or malformed provider states look like "no chapters found."

Action:
- Future provider fixes should distinguish upstream error payloads from true empty chapter lists and persist/report the provider failure on the source.
