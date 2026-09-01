# Contributing to WebQuestEngine

Thank you for your interest in contributing to WebQuestEngine!

We welcome contributions ranging from bug fixes and engine optimizations to UX improvements and documentation.

---

## 1. Reporting Issues & Proposing Features

Before writing code, check the existing issues to ensure the topic is not already being addressed.

* **Bug Reports:** Provide a clear description, reproduction steps, expected vs. actual behavior, and browser/OS details. Include screenshots or console logs if applicable.
* **Feature Requests:** Detail the use case, why it benefits the engine, and any suggested architectural implementation.
* **Picking up an Issue:** Comment on an open issue labeled `help wanted` or `good first issue` to let maintainers know you are working on it.

---

## 2. Development Setup & Workflow

### Prerequisites
* Node.js (v20+ recommended)
* npm

### Local Setup
1. Fork the repository and clone your fork:
   ```bash
   git clone [https://github.com/](https://github.com/)<your-username>/WebQuestEngine.git
   cd WebQuestEngine

```

2. Install dependencies:
```bash
npm install

```


3. Run the local development server:
```bash
npm run dev

```



---

## 3. Code Standards & Architecture

* **TypeScript:** Strictly type all components, engine state transitions, and utility functions. Avoid `any`.
* **Decoupling:** Keep the core engine logic decoupled from the visual editor and DOM rendering layers.
* **Modularity:** Maintain distinct boundaries between scene loading, asset management, character state machines, and dialogue handling.
* **Branching & Commits:**
* Create focused feature branches: `git checkout -b feat/character-pathfinding` or `fix/dialogue-overflow`.
* Use clear, conventional commit messages: `feat: add inventory drag-and-drop` or `fix: resolve canvas scaling on mobile`.



---

## 4. UI/UX & Engine Design Principles

* **Player Experience:** Ensure point-and-click interactions feel responsive, with clear hover states, immediate feedback on interactables, and zero input lag.
* **Editor Usability:** Tools within the engine editor should prioritize clean layouts, clear visual hierarchy, and sensible defaults.
* **Responsive Scaling:** Canvas views, HUD elements, and dialogue overlays must scale correctly across varying screen aspect ratios and resolutions.

---

## 5. Testing & Validation

Before submitting your changes:

1. **Typecheck & Build:** Ensure TypeScript compiles cleanly with zero errors:
```bash
npm run build

```


2. **Manual Engine Testing:**
* Test both `index.html` (editor/demo workspace) and `player.html` (standalone runtime) to confirm no breaking changes.
* Verify character movement, scene transitions, and asset loading in at least Chromium and Firefox.


3. **Automated Tests:** If modifying core systems, run and add relevant unit tests:
```bash
npm test

```



---

## 6. Submitting a Pull Request (PR)

1. Push your branch to your fork.
2. Open a Pull Request targeting the `main` branch.
3. In the PR description:
   * Reference the related issue (e.g., `Closes #12`).
   * Provide a concise summary of changes and design decisions.
   * Attach a screenshot or recording for UI/UX modifications.
4. Keep PRs focused on a single logical change to facilitate quick code review.

---

## 7. Creating a Game From Scratch: Contributor Guidelines & Integrity

WebQuestEngine's core mission is providing a fully visual, code-free authoring environment in `index.html` (complemented by the standalone runtime `player.html`). 

Any code contributions—whether fixing engine internals, refactoring state management, or introducing new tooling—must preserve and enhance this end-to-end visual workflow without requiring manual file or JSON editing.

### Non-Negotiable Workflow Guarantees

When submitting PRs or proposing engine changes, ensure the following core systems remain functional:

* **Visual Scene & Asset Authoring:**
  * Creating and organizing scenes, actors, hotspots, and items via the **Project Tree View**.
  * Positioning, scaling, and configuring scene elements directly inside the **Main Viewport**.
* **Sprite & Animation Tooling:**
  * Importing grid-based spritesheets without manual coordinate calculation.
  * Selecting and sequencing animation frames visually via the **Graphical Frame Picker**.
* **Logic & Progression Graph:**
  * Authoring triggers, events, and dialogue trees exclusively through node connections in the **Graph Editor**.
  * Ensuring changes maintain compatibility with upcoming graph-based features (e.g., narrative beats and global story milestones).
* **Zero Manual File Manipulation:**
  * Game creators should never need to open, edit, or reconcile raw manifest files by hand. The editor must serialize and deserialize all state automatically.

### Areas for Improvement & Suggestions

We actively welcome issues and PRs focused on streamlining the game creation workflow:

* **Graph Editor Enhancements:** UX improvements for node routing, sub-graphs, dialogue flow previews, and narrative beat tracking.
* **Asset & Animation Tooling:** Better visual feedback in the frame picker, automated sprite slicing, frame rate previews, and onion-skinning.
* **Canvas & Viewport Usability:** Snapping tools, multi-selection, visual polygon/navmesh editing improvements, and real-time depth-sorting previews.
* **State & Debugging:** Visual inspection tools for live variables, inventory states, and dialogue branching during in-editor playtesting.
