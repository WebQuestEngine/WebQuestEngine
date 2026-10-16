# Testing and Verification Guidelines

## Rule Summary
- **No Automated UX or Browser Subagent Tests**: Do not run Playwright tests, automated browser exploration, or spawn browser subagents. They waste significant time and credits.
- **Fast Logic Verification**: Use Vitest (`npm test`) for verifying all mathematical, behavioral, and architectural changes.
- **Strict Compilation Check**: Run `npm run build` (`tsc && vite build`) before marking tasks complete to verify TypeScript type safety and bundling.
