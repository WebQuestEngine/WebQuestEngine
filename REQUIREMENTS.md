# 📜 WebQuestEngine - Comprehensive System Requirements Specification (SRS)

This document serves as the single source of truth and official requirements reference for **WebQuestEngine** (QuestForge 2D), compiled from [README.md](file:///home/itaibh/Projects/PointAndClickQuestEngine/README.md), [TODO.md](file:///home/itaibh/Projects/PointAndClickQuestEngine/TODO.md), and core architectural specifications.

---

## 1. System Overview & Objective

**WebQuestEngine** is a modern, browser-based **2D Point & Click Adventure Game Engine & Authoring Studio** built with **TypeScript**, **PixiJS**, and **Vite**.

The objective is to enable game creators, writers, and narrative designers to build, design, and playtest classic 90s-style graphic adventure games (inspired by LucasArts classics like *Monkey Island*, *Day of the Tentacle*, *Fate of Atlantis* and Sierra titles like *King's Quest*) through an intuitive visual editor running natively in the browser without requiring code.

---

## 2. Architectural Principles & Non-Functional Requirements

| Req ID | Principle | Specification |
| :--- | :--- | :--- |
| **NFR-01** | **Strict Decoupling** | The Authoring Editor (`src/editor/`) and the Engine Runtime (`src/engine/`) must be strictly decoupled. The Editor Canvas must render static frames without executing game logic (no AI walking, no audio playback, no dialogue triggers). |
| **NFR-02** | **Scoped Runtime Sessions** | Game execution must run within an isolated `RuntimeContext`. Exiting Play Mode must tear down the PIXI application, audio nodes, and event listeners with **zero global singleton leakage** or lingering state. |
| **NFR-03** | **Standalone Player Pipeline** | The engine must support packaging and running games in a standalone distributable runner (`player.html`, `src/player/main.ts`, `npm run dev:player`, `npm run build:game`) with zero editor overhead. |
| **NFR-04** | **Resolution Independence** | Games author at a reference resolution (default `1920x1080`) and adapt to any browser window size with pixel-perfect letterboxing and coordinate projection. |
| **NFR-05** | **Zero-Error TypeScript Strictness** | All source code must pass strict TypeScript type checks and Vite bundling (`npm run build`) with 0 errors and 0 warnings. |

---

## 3. Detailed Functional Requirements by Module

### Module 1: Editor & Authoring Studio

* **REQ-ED-01 (Project Hierarchy Tree)**:
  * Display a collapsible visual tree hierarchy of the entire project: Chapters ➔ Scenes ➔ Layers, Objects (Hotspots), Characters, and WalkPaths.
  * Support lock toggles (`🔒`/`🔓`) at every hierarchy level. Locking a parent cascade-locks all children; unlocking a child unlocks all ancestor nodes.
  * Selecting a node in the tree must highlight the corresponding element in the Inspector and Canvas **without reloading or flickering the scene viewport**.
  * Context menu and action buttons for adding, duplicating, moving, and deleting chapters, scenes, layers, hotspots, characters, and items.
* **REQ-ED-02 (Dedicated Editor Canvas & Multi-Input Navigation)**:
  * Render static scene layout with interactive gizmos: walkpath polygon vertices, perspective vanishing rays, spawn point markers, and element bounding boxes.
  * Smooth pan via **Middle-click drag**, **Right-click drag**, **Spacebar + Left-click drag**, and **Alt/Shift + Left-click drag**.
  * Zoom controls via Mouse Wheel and Zoom Widget (`Zoom In`, `Zoom Out`, `1:1 Reset`, `Fit Viewport`).
* **REQ-ED-03 (Interactive Inspector & Property Editing)**:
  * Real-time property inspection and editing for Project Settings, Viewport Settings, Scenes, Layers, Hotspots, Characters, WalkPaths, and Items.
  * Inline thumbnail previews for all referenced image textures, spritesheets, and inventory icons.
* **REQ-ED-04 (Visual WalkPath Polygon Editor)**:
  * Draw, edit, add, and remove vertices of walkable floor polygons directly on the canvas.
  * Real-time 2.5D depth perspective configuration (`minY`, `maxY`, `minScale`, `maxScale`) with interactive horizon lines.
* **REQ-ED-05 (Visual Dialogue Tree Flowchart Studio)**:
  * Node-based visual graph editor (`DialogEditor.ts`) to connect branching NPC dialogues, router nodes, response choices, condition flags, and voiceover audio files.
* **REQ-ED-06 (Story Flow Graph)**:
  * High-level visual node graph (`StoryGraphView.ts`) representing chapter progression, scene links, and global narrative branches.
* **REQ-ED-07 (Local File Persistence & Project Serialization)**:
  * Save and Load project files locally via Web File System Access API / file picker.
  * Global `Ctrl+S` / `Cmd+S` keyboard shortcut active across all editor panels.
  * Undo / Redo history management (`Ctrl+Z` / `Ctrl+Y`).

---

### Module 2: Scene Graph, Layers & 2.5D Navigation

* **REQ-SCN-01 (Multi-Layer Parallax Display)**:
  * Support unlimited visual layers per scene with independent properties: `zIndex`, `parallaxX`, `parallaxY`, `scaleX`, `scaleY`, `opacity`, and `visible`.
* **REQ-SCN-02 (Dynamic Y-Depth Sorting)**:
  * Automatic depth sorting for all entities (characters, dynamic objects) based on their ground Y-coordinate.
* **REQ-SCN-03 (Obstacle Avoidance & Pathfinding)**:
  * A* / Dijkstra pathfinding algorithm calculating optimal waypoints within concave/convex walkpath polygons.
  * Automatic target clamping (`clampToWalkable`) to find the closest valid walkable coordinate for any off-mesh click.
* **REQ-SCN-04 (Perspective Scaling)**:
  * Dynamic scaling of character sprites based on vertical position along the WalkPath perspective gradient.

---

### Module 3: Character & Actor System

* **REQ-CHR-01 (Animated Directional Sprites)**:
  * Support directional sprite sheets with frame-based animations (`idle`, `walk`, `talk`, `pick_up`, and custom animations).
  * 8-way directional calculation (`down`, `down_right`, `right`, `up_right`, `up`, `up_left`, `left`, `down_left`) with horizontal mirroring for left-facing states.
* **REQ-CHR-02 (Walk-to-Object on Interaction)**:
  * When clicking an interactive scene element (hotspot, character, item), the player character must first pathfind to the nearest valid walkable point near that object, turn to face the object, and only then execute the action.
* **REQ-CHR-03 (Static Editor Display)**:
  * In Editor Mode, characters must remain static on their initial spawn frame with perspective scaling applied, without running walk or idle animations.

---

### Module 4: Interactive Hotspots & Scoped Logic Rules

* **REQ-ACT-01 (Polygon Hitbox Detection)**:
  * Support custom multi-point polygon hitboxes for interactive hotspots with precise point-in-polygon mouse hover and click detection.
* **REQ-ACT-02 (Multi-Verb Action Dispatching)**:
  * Define distinct outcomes per verb: `walk`, `look`, `interact`/`use`, `talk`, `pick_up`, or item use (`requireItemId`).
* **REQ-ACT-03 (Scoped Condition Flags & Outcomes)**:
  * Evaluate conditions before execution: `requireFlag`, `notFlag`, and `requireItemId`.
  * Support multi-step action outcomes: `text` (subtitles/speech), `playAnimation`, `sfxUrl`, `setFlag`, `giveItemId`, `dialogId`, `targetSceneId`, and `targetSpawnPoint`.
* **REQ-ACT-04 (Default Action Resolution Rule)**:
  * For objects and hotspots that have actions other than "look at" (e.g. `talk`, `interact`, `use`, `pick_up`, scene transitions), use the first such action as default.
  * If only "look at" exists, use it.
  * Otherwise, default to "walk".
  
---

### Module 5: UI Presets, Custom Cursors & Input Controls

* **REQ-UI-01 (HUD Presets)**:
  * Support 4 selectable UI layout presets configurable in Project Settings:
    1. **LucasArts 9-Verbs**: Bottom verb grid (`Give`, `Open`, `Close`, `Pick Up`, `Look At`, `Talk To`, `Use`, `Push`, `Pull`) + inventory tray.
    2. **Sierra Top Bar**: Top icon bar with auto-collapsible verb tools.
    3. **Context Coin**: Radial/floating action coin appearing on element click.
    4. **Direct Cursor**: Streamlined one-click contextual verb matching.
* **REQ-UI-02 (Custom Cursors)**:
  * Support custom PNG cursor graphics per verb (`walk`, `look`, `interact`, `talk`, `pick_up`) defined in `uiConfig.customCursors`.
  * Display held inventory item icon dynamically following the cursor.
  * Support per-hotspot custom cursor overrides (`customCursorUrl`).
* **REQ-UI-03 (Right-Click "Look At")**:
  * Suppress browser default context menu ("Save image as...").
  * Right-clicking on an object or NPC immediately triggers the "Look At" action.
  * Right-clicking while holding an item deselects the item and returns to standard walking.
* **REQ-UI-04 (Hover Labels & Verbs)**:
  * Render contextual hover text (e.g. *"Look at Ancient Gate"*, *"Use Golden Key on Heavy Oak Door"*).

---

### Module 6: Inventory System & Item Combinations

* **REQ-INV-01 (Item Collection & UI Synchronization)**:
  * Register items with `id`, `name`, `description`, and `iconUrl`.
  * When an action or dialogue awards an item (`giveItemId` / `giveItem`), the item must **immediately render into the visible inventory bar and grid modal**.
* **REQ-INV-02 (Held Item Management)**:
  * Selecting an item attaches its icon to the cursor follower.
  * Held items must automatically deselect and revert to standard walking immediately upon use or when transitioning between scenes.
* **REQ-INV-03 (Mouse Wheel Inventory Cycling)**:
  * Scrolling the mouse wheel strictly cycles through collected inventory items (and deselecting), without toggling or selecting tool verbs.
* **REQ-INV-04 (Item Combinations & Drag-and-Drop)**:
  * Support combining two inventory items (`combineWith[targetItemId]`) to produce a new item, trigger flags, and play notification messages.
  * Drag-and-drop support for dragging items from inventory slots onto scene hotspots or other inventory slots.

---

### Module 7: Dialogue & Voiceover System

* **REQ-DLG-01 (Branching Dialogue Trees)**:
  * Graph-based dialogues supporting speaker name, dialogue text, portrait thumbnail, and audio voiceover.
  * Conditional player response choices filtered dynamically by story flags (`requiredFlag`, `notFlag`).
* **REQ-DLG-02 (In-World Speech Bubbles & Subtitles)**:
  * Subtitle text overlays anchored dynamically above speaking character heads in world-space coordinates.
* **REQ-DLG-03 (Dialogue Outcomes)**:
  * Dialogue choices and nodes can award items (`giveItem`), set flags (`setFlag`), play voiceover clips (`voiceAudioUrl`), or trigger scene changes.

---

### Module 8: Audio System

* **REQ-AUD-01 (Scene Background Music)**:
  * Per-scene background music tracks (`backgroundMusicUrl`) with smooth volume crossfading on scene changes.
* **REQ-AUD-02 (Voiceover Audio)**:
  * Synchronized playback of dialogue voice lines with automatic subtitle duration timing.
* **REQ-AUD-03 (Action SFX)**:
  * Trigger sound effects for object interactions, door opening, item pickup, and inventory combinations.
* **REQ-AUD-04 (Play Mode Audio Clean-Up)**:
  * Exiting Play Mode must immediately stop all music, voice, and SFX streams with zero residual audio.

---

### Module 9: Game Flow, Scene Transitions & Cinematics

* **REQ-FLW-01 (Start Game Event / Intro Script)**:
  * Trigger `onStartGame` / `onSceneLoad` event hook to automatically execute opening dialogue, give initial items, or run intro cutscenes on game launch.
* **REQ-FLW-02 (Scene Transitions & Screen Fading)**:
  * Smooth fade-to-black and fade-in transitions when changing scenes (`changeScene`), hiding asset loading and positioning camera before fade-in.
  * Support transition presets (`fade`, `wipe`, `instant`).
* **REQ-FLW-03 (Cinematics & Letterboxed Cutscenes)**:
  * Letterboxed cinematic mode temporarily hiding UI HUDs and disabling player manual controls.
  * Scripted camera movements (`camera.panTo(x, y)` and zoom) and scripted actor sequences.
* **REQ-FLW-04 (Global Lifecycle Events & Triggers)**:
  * Project-level event triggers (`onGameStart`, `onChapterStart`, `onChapterEnd`, `onGameEnd`/Victory, `onFlagChange`, `onItemCollected`, `onTimerExpire`).

---

### Module 10: Settings, Main Menu, Persistence & Achievements

* **REQ-OPT-01 (Settings Dialog & Volume Controls)**:
  * In-game modal with volume sliders (Master, Music, SFX, Voiceover), subtitle speed slider, fullscreen toggle, and UI scale settings.
* **REQ-OPT-02 (Main Menu & Title Screen)**:
  * Customizable game title screen with `Start New Game`, `Continue Game`, multi-slot `Save / Load Game`, `Settings`, and `Credits`.
* **REQ-OPT-03 (Achievements System)**:
  * Define achievements (`id`, `title`, `description`, `iconUrl`, `isSecret`).
  * Unlock triggers via actions, dialogue, combinations, or flags (`unlockAchievement`).
  * Animated toast notification banner on unlock + in-game achievements viewing modal.

---

## 4. Requirements Traceability & Implementation Status Matrix

| ID | Module / Feature Requirement | Source | Current Status | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **REQ-ED-01** | Visual Project Tree Hierarchy | `README.md` | 🔧 **NEEDS FIX** | Tree rendered; **Fix needed**: Prevent scene reload/viewport disappear on node selection. |
| **REQ-ED-02** | Editor Canvas & Navigation (Pan/Zoom) | `README.md` | ✅ **COMPLETED** | Spacebar, Middle/Right drag, Zoom Widget (In/Out/Reset/Fit) operational. |
| **REQ-ED-03** | Interactive Inspector & Thumbnails | `README.md` | ✅ **COMPLETED** | Inline image thumbnails and full property editing. |
| **REQ-ED-04** | Visual WalkPath & Horizon Editor | `README.md` | ✅ **COMPLETED** | Polygon vertex editor and perspective scaling lines functional. |
| **REQ-ED-05** | Visual Dialogue Tree Studio | `README.md` | ✅ **COMPLETED** | Node graph flowchart editor with branch linking. |
| **REQ-ED-06** | Story Flow Graph View | `README.md` | ✅ **COMPLETED** | High-level chapter and scene story graph view. |
| **REQ-ED-07** | Local Save/Load & Undo/Redo | `README.md` | ✅ **COMPLETED** | FileAccessAdapter, ProjectSerializer, global `Ctrl+S`, `Ctrl+Z` history. |
| **REQ-NFR-01** | Engine Runtime & Editor Decoupling | `TODO.md` §6 | ✅ **COMPLETED** | `EditorCanvas.ts` (static) separated from `GameRuntime.ts` (active session). |
| **REQ-NFR-02** | Scoped Runtime Sessions | `TODO.md` §6 | ✅ **COMPLETED** | Sandboxed `RuntimeContext` with clean teardown on Play Mode exit. |
| **REQ-NFR-03** | Standalone Player Distribution | `TODO.md` §6 | ✅ **COMPLETED** | Dedicated runner (`player.html`, `src/player/main.ts`, `npm run build:game`). |
| **REQ-SCN-01** | Multi-Layer Parallax Display | `README.md` | ✅ **COMPLETED** | Parallax scaling, opacity, and layer reordering functional. |
| **REQ-SCN-02** | Dynamic Y-Depth Sorting | `README.md` | ✅ **COMPLETED** | Real-time actor and object depth ordering. |
| **REQ-SCN-03** | Dijkstra Pathfinding & Clamping | `TODO.md` §5 | ✅ **COMPLETED** | Pathfinding within polygons and `clampToWalkable` functional. |
| **REQ-SCN-04** | Perspective Scaling | `README.md` | ✅ **COMPLETED** | Vertical perspective gradient scaling applied to actors. |
| **REQ-CHR-01** | 8-Way Animated Directional Sprites | `README.md` | ✅ **COMPLETED** | Directional spritesheets with horizontal mirroring. |
| **REQ-CHR-02** | Walk-to-Object Before Interaction | User Request | ✅ **COMPLETED** | Protagonist pathfinds to nearest valid point before executing actions. |
| **REQ-CHR-03** | Static Frame in Editor Mode | User Request | ✅ **COMPLETED** | Character animations frozen on spawn frame in Editor Canvas. |
| **REQ-ACT-01** | Polygon Hotspots & Hitboxes | `README.md` | ✅ **COMPLETED** | Point-in-polygon hover and click detection. |
| **REQ-ACT-02** | Multi-Verb Action Matching | `TODO.md` §5 | ✅ **COMPLETED** | Strict verb matching (`walk`, `look`, `interact`, `talk`, `pick_up`, `use`). |
| **REQ-ACT-03** | Scoped Condition Flags & Outcomes | `README.md` | ✅ **COMPLETED** | Flags, item rewards, sfx, dialogue triggers, and scene switches. |
| **REQ-UI-01** | HUD Presets (LucasArts, Sierra, Coin, Direct) | `TODO.md` §1 | ✅ **COMPLETED** | 4 layout presets supported and switchable. |
| **REQ-UI-02** | Custom Cursors (Verbs, Items, Hotspots) | `TODO.md` §7 | ✅ **COMPLETED** | Custom cursor follower active for verbs, held items, and hotspots. |
| **REQ-UI-03** | Right-Click "Look At" & Deselect | User Request | ✅ **COMPLETED** | Canvas context menu prevented; right click triggers Look At or deselect. |
| **REQ-UI-04** | Contextual Hover Labels | `TODO.md` §1 | ✅ **COMPLETED** | Action and object hover labels rendered cleanly. |
| **REQ-INV-01** | Instant Inventory UI Refresh | User Request | ✅ **COMPLETED** | Immediate slot render when items are awarded. |
| **REQ-INV-02** | Held Item Auto-Reset | User Request | ✅ **COMPLETED** | Item deselected on use and upon changing scenes. |
| **REQ-INV-03** | Mouse Wheel Inventory-Only Cycling | `TODO.md` §1 | ✅ **COMPLETED** | Wheel strictly cycles collected inventory items without picking tool verbs. |
| **REQ-INV-04** | Item Combinations & Drag-and-Drop | `TODO.md` §1 | ⏳ **QUEUED** | Drag visual feedback and combining items in inventory slots. |
| **REQ-DLG-01** | Branching Dialogue Trees & Choices | `README.md` | ✅ **COMPLETED** | Conditional choices, flags, and node routing. |
| **REQ-DLG-02** | In-World Subtitles / Speech Bubbles | `README.md` | ✅ **COMPLETED** | Overhead speech bubbles anchored to speaker positions. |
| **REQ-AUD-01** | Scene Background Music Crossfading | `TODO.md` §9 | ✅ **COMPLETED** | Per-scene audio with crossfading and exit stop. |
| **REQ-AUD-02** | Dialogue Voiceover Audio Sync | `TODO.md` §9 | ✅ **COMPLETED** | Voice audio playback synchronized with dialogue nodes. |
| **REQ-AUD-03** | Custom Action SFX Triggers | `TODO.md` §9 | ✅ **COMPLETED** | Audio sound effects on actions and pickups. |
| **REQ-FLW-01** | Start Game Trigger & Intro Script | `TODO.md` §2 | ⏳ **QUEUED** | `onStartGame` / `onSceneLoad` auto-executing opening cutscenes/items. |
| **REQ-FLW-02** | Scene Transitions (Screen Fade In/Out) | `TODO.md` §3 | ⏳ **QUEUED** | Screen fade transitions during `changeScene`. |
| **REQ-FLW-03** | Cinematics & Letterboxed Mode | `TODO.md` §4 | ⏳ **QUEUED** | Letterbox mode, disabled player controls, scripted camera pans. |
| **REQ-FLW-04** | Global Game Events & Triggers | `TODO.md` §8 | ⏳ **QUEUED** | Project-wide lifecycle triggers (`onChapterStart`, `onGameEnd`, `onFlagChange`). |
| **REQ-OPT-01** | Settings Dialog & Volume Sliders | `TODO.md` §10 | ⏳ **QUEUED** | Master, Music, SFX, Voice sliders, subtitle speed, display settings. |
| **REQ-OPT-02** | Main Menu & Title Screen System | `TODO.md` §11 | ⏳ **QUEUED** | Title screen, New Game, Continue, Save/Load slots. |
| **REQ-OPT-03** | Achievements System & Popups | `TODO.md` §12 | ⏳ **QUEUED** | Achievements data, unlock triggers, toast notifications, viewer screen. |
