# AI Workflow Rules

These are rules, not suggestions. Follow them exactly while building this project.

## Overall Approach

1. Work spec-driven. Before writing code for any feature, check `project-overview.md`, `architecture.md`, and `code-standards.md` for the relevant section. If the feature isn't described there, stop and ask instead of inventing behavior.
2. Build incrementally. Implement one feature unit at a time, get it working and reviewed, then move to the next. Do not build multiple unrelated features in the same pass.
3. Never contradict an invariant listed in `architecture.md`. If a task appears to require violating one, stop and flag the conflict instead of proceeding.

## Scoping Rules

4. Work on one feature unit at a time. A "unit" is a single server action, a single job, a single UI component, or a single database model change, not a bundle of several.
5. Do not make speculative changes. If you notice something unrelated that could be improved while working on a unit, note it separately and do not fix it as part of the current task.
6. Do not refactor existing working code unless the current task explicitly requires it. "While I'm in here" refactors are not allowed.
7. Do not add fields, endpoints, or configuration options that aren't in the spec on the assumption they'll be needed later. Build what's described now.
8. Stay inside the file organization defined in `code-standards.md`. Do not create new top-level folders or move existing files without explicit instruction.

## When to Split Work Into Smaller Steps

9. If a task touches more than one system boundary from `architecture.md` (for example, a server action, a job, and a Shopify API call), split it into separate steps: implement and verify the database layer first, then the Shopify interaction, then the server action that ties them together.
10. If a task involves both a schema change and the code that uses it, do the schema change and migration first, verify it, then write the code against it.
11. If a task can't be described in one sentence without using "and" more than once, split it.

## Handling Missing or Ambiguous Requirements

12. Do not guess. If a requirement is missing, ambiguous, or contradicts another file in the spec, stop and ask a specific question instead of picking an interpretation and proceeding.
13. When asking, state the specific gap and, where possible, the smallest set of options (e.g. "Should the conflict UI show a diff of every field, or just the fields that changed? A: full diff. B: changed fields only."). Do not ask open-ended questions when a narrow one will do.
14. Never invent business logic that isn't stated anywhere (a default price, a fallback collection, a silent retry count) without flagging it as an assumption in the same response, so it can be corrected before it's built on top of.
15. If a Shopify API detail is unknown (a field name, a required scope, a mutation's exact shape), verify it against Shopify's actual API documentation before writing code. Do not guess at a GraphQL field name.

## Files That Should Not Be Modified Without Explicit Instruction

16. Do not modify `prisma/schema.prisma` without explicit instruction, since every change here requires a migration and affects every account's data.
17. Do not modify anything in `lib/shopify/` or `lib/db/` as a side effect of an unrelated task. These are shared boundaries; changes here ripple across every feature.
18. Do not modify `architecture.md`, `project-overview.md`, or `code-standards.md` directly. Propose the change and get explicit approval before editing them.
19. Do not modify generated or vendored files (Prisma client output, shadcn/ui component internals if used, anything under `node_modules` or a `.generated` directory).

## Keeping Documentation in Sync

20. If an implementation decision changes something stated in `architecture.md` or `project-overview.md` (a new invariant, a changed boundary, a scope change), update that file in the same session, as a separate explicit step, and say so out loud. Do not let the docs silently go stale.
21. If a new invariant emerges during implementation that isn't yet written down (for example, a new rule about how retries are handled), add it to `architecture.md`'s invariants section before moving on, not after.

## Verification Checklist Before Moving to the Next Unit

Before considering a unit done, confirm all of the following:

22. The code respects every invariant in `architecture.md`. Check each one explicitly, don't assume.
23. Every database query touching products, drafts, stores, or tokens is scoped by `accountId` (and `storeId` where relevant).
24. No Shopify API call exists outside `lib/shopify/`, and no direct Prisma call exists outside `lib/db/`.
25. Server actions only validate input, call `lib/` functions, and return a typed result. No business logic sits inline in the action itself.
26. Error paths are handled explicitly (no empty catches, no silently ignored failed Shopify calls).
27. TypeScript has no `any`, and all server action inputs are validated against a schema.
28. If the unit involves push or sync, confirm the conflict detection path was actually exercised (not just the happy path), by testing a case where both sides changed.
29. Documentation is updated if anything in step 20 or 21 applies.

Only after all of these are confirmed should the next unit begin.
