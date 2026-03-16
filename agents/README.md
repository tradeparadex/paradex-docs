# Agents knowledge base

This folder stores persistent learnings that agents accumulate while working on this repository. The goal is to avoid repeating mistakes and to carry forward useful patterns across PRs.

## Rules

1. **Before every task**, read all files in `/agents/learnings/` to load context about the repo.
2. **After every task**, update or create a relevant learning file in `/agents/learnings/` as part of the PR. Only add factual, verified information.
3. **Do not delete** learning files unless the information is confirmed outdated.

## Learning file format

Each file in `/agents/learnings/` should follow this structure:

```markdown
# <Topic>

## Gotchas
- Things that are easy to get wrong or that caused issues in the past.

## Patterns
- Conventions and approaches that work well in this repo.

## Anti-patterns
- Approaches that have failed or should be avoided.

## Last updated
YYYY-MM-DD
```

Files can omit empty sections. Keep entries concise and factual.
