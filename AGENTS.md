# Working on Twinclue

Read SPEC.md first. It is the product. This file is how we build it.

## Stack
- Node.js 22, TypeScript (strict), ES modules.
- Fastify for HTTP, `ws` for the overlay WebSocket, `vitest` for tests, `zod` for validating model output and config.
- Overlays and the control panel are plain HTML, CSS and a small amount of browser JavaScript served by Fastify.
  No frontend framework. They must look good at 1920x1080 as an OBS browser source with a transparent background.
- Twitch: Helix API and EventSub over WebSocket. No IRC.
- No database for the MVP: state in memory, persisted to `data/session.json` so a restart can resume a session.

## How we work
- Build one vertical slice at a time and keep `npm test` green after every slice.
- Every module gets unit tests. Twitch and the model are behind interfaces so tests use fakes.
- Small, readable functions. Comments only where the reason is not obvious.
- Never commit secrets. Configuration comes from `.env` (see `.env.example`). Never print tokens in logs.
- User-facing text (overlay, chat replies, README) is plain, friendly English. No em dashes. No arrows like -> in
  user-facing text.
- When something in SPEC.md is ambiguous, choose the simplest behaviour that keeps the game fair, and write the
  decision in DECISIONS.md.

## Definition of done for a slice
- Tests pass, `npm run typecheck` passes, the feature works against a real Twitch channel or is clearly marked as
  a fake for tests only.
