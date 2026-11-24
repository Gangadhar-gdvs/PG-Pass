<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Agent Rules & Engineering Principles

## 1. Git Command Restriction
- **DO NOT run Git-related commands directly** (`git add`, `git commit`, `git push`, `git checkout`, `git reset`, etc.) unless the user explicitly requests you to run a specific git command in their prompt.
- The repository owner manages Git operations directly.

## 2. Direct Problem Solving & Fast, Lean Execution
- **Pinpoint the exact issue first:** For any task or error, immediately identify the specific root cause and apply the simplest, most direct fix.
- **Zero overthinking / zero overengineering:** Never overcomplicate normal tasks, write redundant abstraction layers, or spend unnecessary time on routine operations. Deep exploration is strictly reserved for genuinely complex architectural problems.
- **Concise communication:** Keep explanations short, clear, and focused on the solution without unnecessary text.

## 3. Human-Friendly User Error Messages
- End-users (residents, tenants, owners) should **NEVER** see internal infrastructure instructions or developer setup errors (e.g., "Enable in Firebase Console", "Missing service account", internal stack traces) that they cannot fix.
- User-facing UI messages must always be polite, clear, and actionable (e.g., "Google sign-in is currently unavailable. Please sign in with email or contact the PG administrator.").

## 4. Centralized System Logging & Admin Error Dashboard
- All technical errors, authentication failures, API errors, and system exceptions must be captured and persisted in the `system_logs` Firestore collection.
- All technical diagnostics (error code, stack trace, timestamp, route/context) must be clearly presented in the `/admin` Super Admin Portal so the project owner can monitor and resolve issues immediately.

