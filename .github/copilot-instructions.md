# Copilot Instructions

## Primary Intent

Work fast, but keep codebase stable and reproducible.

## Execution Priorities

1. Correctness
2. Backward compatibility
3. Developer ergonomics
4. Performance

## Style Constraints

- Avoid inline JSX style attributes.
- Use external CSS or existing utility classes.
- Keep ASCII unless file already contains non-ASCII and requires it.

## Safe Workflow

- Inspect target files first.
- Apply minimal patch.
- Validate only affected scope first, then broader checks if needed.

## Default Validation Commands

- `npm run typecheck`
- `npm run test:run`
- `npm run build`

## Git Hygiene

- Do not revert unrelated user changes.
- Avoid destructive git commands.
- Keep commits focused by concern.
