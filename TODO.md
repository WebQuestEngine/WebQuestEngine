# 📋 QuestForge 2D - Engine Development TODOs

This document tracks upcoming tasks, feature enhancements, and polish items for the **Point & Click Quest Engine**.

---

## 🎨 1. Fix Appearance
- [ ] **UI Preset Styling**: Refine inventory bar styling and layout across all UI presets (`LucasArts 9-verbs`, `Sierra top bar`, `Context Coin`, `Direct Cursor`).
- [ ] **Item Grid & Slots**: Improve item slot border padding, hover highlights, item selection indicators, and item count tooltips.
- [ ] **Item Drag & Combine Visuals**: Add visual feedback when dragging an item onto another inventory item or hot-bar slot.
- [ ] **Custom graphics for tools and inventory**: Add custom graphics for tools and inventory slots
- [ ] **Dialog box custom graphics**: Add custom graphics for dialog boxes
- [ ] **Mouse Wheel Inventory Selection**: Display the inventory bar at the bottom during gameplay, where scrolling the mouse wheel cycles and highlights the selected inventory item, replacing verb tool selection.

---

## 🚀 2. Add Start Game Event
- [ ] **Initial Scene Event Trigger**: Create a `onStartGame` / `onSceneLoad` event hook to automatically execute actions when Chapter 1 / Initial Scene loads.
- [ ] **Automatic Intro Script Execution**: Support triggering initial dialogues, giving starting items, or running custom intro scripts automatically upon game launch.

---

## 🎬 3. Scene Transitions
- [ ] **Visual Scene Fading**: Implement smooth screen fade-out to black and fade-in when changing scenes (`StoryGraphSystem.changeScene`).
- [ ] **Transition Timing**: Coordinate player spawn positioning and camera positioning during the black screen phase before fading in.
- [ ] **Transition Presets**: Support customizable transition effects (`fade`, `wipe`, `instant`).

---

## 🍿 4. Cinematics & Cutscenes
- [ ] **Cinematic Mode**: Add a letterboxed cinematic mode that temporarily hides UI bars and disables player manual controls during cutscenes.
- [ ] **Scripted Camera Movement**: Support pan-to-position and smooth camera zooming during cutscenes (`camera.panTo(x, y)`).
- [ ] **Scripted Sequences**: Support sequential actor walking, animation triggers, and speech subtitles without requiring player interaction.
- [ ] **Skip Cutscenes & Dialog**: Allow skipping cutscenes and dialog lines by pressing the dot key (`.`) or another custom input.

---

## 🛠️ 5. Fix Tool Selection
- [x] **Wrong tool usage**: Fixed verb matching in `InteractableElement.ts` & `Engine.ts`. Clicking "Talk" or "Look" on doors/objects strictly matches matching actions or displays in-character subtitles ("The door doesn't reply.") instead of incorrectly triggering "Use" or scene transition door actions.
- [x] **Active Verb Feedback**: Active verb buttons (`.verb-btn`, `.sierra-btn`, `.coin-btn`) now highlight cleanly and stay synced with mouse wheel verb cycling and verb alias equivalency (`interact` / `use`).
- [x] **Cursor State Consistency**: Fixed cursor context updates when switching between Editor tools, spawn pickers, polygon draw mode, and Play mode.

---

## 🏗️ 6. Decouple Engine Runtime & Editor
- [x] **Full Architectural Decoupling**: Completely separated authoring canvas (`EditorCanvas.ts`) from game execution (`GameRuntime.ts`). Editor displays static frames with no animations or game audio.
- [x] **Scoped Runtime Sessions (`RuntimeContext.ts`)**: Sandboxed runtime sessions discard all state, audio nodes, and event listeners on destruction without global singleton leakage.
- [x] **Standalone Game Player & Pipeline**: Created dedicated standalone player (`src/player/main.ts`, `player.html`, `npm run dev:player`, `npm run build:game`) to bundle and run games independently from editor code.
- [x] **Engine/UI Separation & Standalone Stylesheet**: Extracted runtime HUD, subtitle, dialog, and in-game menu styles into standalone `src/engine/ui/engine-ui.css`, completely freeing `player.html` and the runtime from depending on editor CSS (`src/editor/style.css`). Introduced `IOverlayRenderer` interface to decouple runtime from concrete DOM manipulation.
- [x] **Editor File Handling Isolation**: Moved `FileAccessAdapter.ts` and `RecentProjectsManager.ts` out of `src/engine/storage/` to `src/editor/storage/`.
- [x] **Polymorphic Data Model & Legacy Normalization**: Refactored `DialogNode`, `HotspotAction`, and `StageDirective` into discriminated unions (`SpeechBeatNode`, `RouterBranchNode`, `EventListenerNode`, `ActionCinematicNode`, `AnimationDirective`, etc.) with type guards; added automatic normalization for legacy flags in `ProjectSerializer.normalize()`.
- [x] **Modularize Monolithic Controllers**: Decomposed `DialogEditor.ts` (1,003 lines down to 273 lines) by extracting `StoryboardViewController.ts` and `DialogSequenceController.ts`.

---

## 🖱️ 7. Custom Cursors
- [x] **Verb Cursors**: Supported custom image cursors per verb (`walk`, `look`, `interact`, `talk`, `pick_up`) configurable in Project Settings (`uiConfig.customCursors`).
- [x] **Inventory Item Cursors**: Selected inventory item PNG icons display smoothly at the mouse cursor location when holding an item.
- [x] **Hotspot Dynamic Cursors**: Hotspots can define custom mouse cursor graphics (`customCursorUrl`) when hovering over them.

---

## ⚡ 8. Global Events & Triggers
- [ ] **Global Lifecycle Events**: Add project-level event triggers (`onGameStart`, `onChapterStart`, `onChapterEnd`, `onGameEnd`/Victory, `onFlagChange`, `onItemCollected`, `onTimerExpire`).
- [ ] **Global Event Actions**: Support executing script actions, dialogue triggers, victory screens/credits, music playback, or scene transitions from global events without requiring a hotspot click.

---

## 🎵 9. Audio System
- [x] **Background Music per Scene**: Support background music audio files per scene (`backgroundMusicUrl`) with smooth fading between scene transitions.
- [x] **Recorded Dialogues / Voiceover Support**: Add voiceover audio file fields to dialogue nodes (`voiceAudioUrl`) with automatic subtitle duration sync.
- [x] **Custom Action Sound Effects**: Support custom sound effect triggers on actions (`sfxUrl`) for door opening, item pickup, brewing potions, and inventory interactions.
- [ ] **Restrict Voiceover to Dialogue Nodes**: Dialog system responses/choices should not contain audio files directly; if voiceover audio is required, connect the choice to a separate dialog speech node instead.

---

## ⚙️ 10. Settings Dialog & Volume Controls
- [ ] **Audio Volume Sliders**: Add interactive volume controls for Master Volume, Music Volume, Sound Effects (SFX) Volume, and Voiceover Volume.
- [ ] **In-Game Settings Modal**: Create an accessible settings dialog accessible during gameplay and from the main menu.
- [ ] **Display & Gameplay Preferences**: Support subtitle text speed sliders, fullscreen mode toggle, and UI scaling options.

---

## 🏠 11. Main Menu / Home Page System
- [ ] **Main Menu Screen**: Add a customizable game Title / Home Page screen shown when launching published games.
- [ ] **Game Actions**: Include `Start New Game`, `Continue Game` (auto-load latest save), and multi-slot `Save / Load Game` management.
- [ ] **Settings & Custom Screens**: Include direct access to the Settings Panel, plus support for custom buttons/modal screens such as `Credits`, `Controls`, and `Quit Game`.

---

## 🏆 12. Achievements System
- [ ] **Achievement Definitions**: Support defining achievements in project data (`id`, `title`, `description`, `iconUrl`, `isSecret`, `isUnlocked`).
- [ ] **Action & Script Unlock Triggers**: Allow unlocking achievements via hotspot actions, dialogue completion, item combinations, or story flags (`unlockAchievement('first_potion')`).
- [ ] **In-Game Toast Notifications**: Display an animated toast notification banner when an achievement is unlocked during gameplay.
- [ ] **Achievements Screen / Modal**: Accessible achievements menu displaying progress, icons, unlock timestamps, and secret achievement placeholders.

---

## 🎭 13. Character Visualization System
- [x] **Decouple Character Visuals and Animations from Data**: Separate character visual representation and animation from character data into a dedicated character visualization system, allowing games to use different systems for rendering characters (e.g. spritesheets, skeletal animation, procedural meshes).
- [ ] **Create Editors for Each Visualization System**: Provide dedicated in-editor configuration tools, inspectors, and studio modals for each visualization system (Sprite Sheet picker, Procedural Character Studio, and Skeletal Rig Importer & Studio).

---

## 💬 14. Dialog System
- [ ] **Wait for Dialog Line to Finish**: Wait for the current dialog line/speech subtitle to finish before showing player response options.
- [ ] **Skip Dialog & Cutscenes**: Allow skipping dialog lines and cutscenes by pressing the dot key (`.`) or another custom input.

---

## 💾 15. Studio Asset Persistence & Export Pipeline
- [ ] **Hosted Studio Asset Persistence**: Persist uploaded images and sound files in browser storage (IndexedDB / Origin Private File System) so user-uploaded assets survive reloads without manual `public/` folder copying.
- [ ] **Self-Contained Game Export / Packager**: Build a self-contained ZIP export tool allowing users to bundle their project JSON and all custom assets into a deployable static site.

---

## 📱 16. Mobile & Touch Input Support
- [ ] **Touch Gesture Recognition**: Support `touchstart`, `touchmove`, and `touchend` events in `InputHandler.ts` for walking, examining hotspots, and dragging inventory items on mobile/tablets.
- [ ] **Mobile HUD & Touch Controls**: Add tap-to-interact and long-press context coin trigger for touch screens.

---

## 📐 17. Project Format Versioning & Migrations
- [ ] **Formal Schema Versioning**: Introduce a formal JSON schema and semver `version` field validation.
- [ ] **Migration Pipeline**: Create a version-by-version migrator (`v1.0.0` -> `v1.1.0`) to safely update older project JSONs as new features are added.

---

## 🛡️ 18. Tooling, Guardrails & Documentation
- [ ] **ESLint & Prettier Setup**: Configure linters and mechanical boundary checks ensuring clean imports and enforcing architectural invariants (e.g. engine never importing from editor).
- [ ] **Unified Check Script**: Add a unified `npm run check` script (`tsc --noEmit`, ESLint, Vitest) and wire it into GitHub Actions CI.
- [ ] **Agent & Architectural Documentation**: Create `AGENTS.md` (and a `CLAUDE.md` pointer) detailing repository architecture rules, scoped event bus lifecycles, and design patterns.
- [ ] **Documentation Drift Cleanup**: Consolidate product naming across docs (`WebQuestEngine` / `QuestForge 2D`) and sync `REQUIREMENTS.md` matrix with implemented features.

---

## 🎮 19. Refactor InputHandler Controller
- [ ] **Decompose InputHandler**: Modularize `InputHandler.ts` (~600 lines) into focused sub-handlers (`VerbSelector`, `HotspotInteractionResolver`, `ItemDragController`).


