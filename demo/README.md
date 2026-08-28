# 🧪 The Alchemist's Mystery - Demo Quest

> **⚠️ Note: Work in Progress**
> This demo quest and its assets are currently an active work in progress used for testing and demonstrating new engine capabilities, visual scripting nodes, audio cues, and cinematic choreography.

**The Alchemist's Mystery** is the official demonstration quest showcasing the core features, narrative graph system, cinematic sequencing, and puzzle mechanics of the Point & Click Quest Engine.

---

## 📜 Story Overview

Sir Ronald travels to the ancient stronghold of Eldoria to seek out the enigmatic scholar **Master Eldrin**. Legend tells of a miraculous **Elixir of Wisdom** capable of granting profound alchemical insight. To claim it, Sir Ronald must bypass the castle gate security, consult with Master Eldrin, and complete the sacred brewing ritual.

---

## 🎮 Play Online & Open in Editor

* 🕹️ **[Play Demo Quest (Fullscreen Game)](https://itaibh.github.io/WebQuestEngine/player.html)** — Play the standalone point-and-click adventure demo directly in your browser.
* 🛠️ **[Launch WebQuestEngine Studio](https://itaibh.github.io/WebQuestEngine/)** — Open the full visual authoring editor loaded with the demo project to inspect and tweak scenes, characters, dialog trees, and logic rules.

---

## 🏰 Chapters & Scenes

### Chapter 1: The Gates of Eldoria
- **Scene**: `Castle Gates` (`scene_gates`)
- **Setting**: The foggy courtyard outside the reinforced gates of Master Eldrin's stronghold.
- **Objectives**:
  1. Search the overgrown courtyard shrubs to discover the hidden **Brass Key**.
  2. Use the **Brass Key** on the heavy castle door to unlock passage.
  3. Enter the stronghold to advance to Chapter 2.

### Chapter 2: The Secret Elixir
- **Scene**: `Alchemist Laboratory` (`scene_lab`)
- **Setting**: Master Eldrin’s candle-lit laboratory filled with ancient tomes, bubbling apparatus, and a mystical cauldron.
- **Objectives**:
  1. Converse with **Master Eldrin** regarding the legendary recipe.
  2. Receive the **Glowing Crystal** catalyst.
  3. Use the **Glowing Crystal** with the bubbling cauldron to brew the **Elixir of Wisdom**.

---

## 👥 Characters & Cast

| Character | Role | Identifier | Description |
| :--- | :--- | :--- | :--- |
| **Sir Ronald** | Protagonist | `player` | Valiant knight and explorer seeking alchemical knowledge. |
| **Master Eldrin** | NPC | `npc_eldrin` | Master Alchemist and keeper of the Eldorian secrets. |

---

## 🎒 Items & Inventory

| Item | Identifier | Icon | Description |
| :--- | :--- | :--- | :--- |
| **Brass Key** | `item_key` | `assets/items/brass_key.png` | An ornate brass key hidden in the shrubbery outside the gates. |
| **Glowing Crystal** | `item_crystal` | `assets/items/glowing_crystal.png` | A radiant blue crystal catalyst gifted by Master Eldrin. |
| **Elixir of Wisdom** | `item_potion` | `assets/items/elixir.png` | The legendary sparkling elixir brewed in the laboratory cauldron. |

---

## 🧩 Walkthrough & Puzzle Solution

1. **Find the Key**: In the *Castle Gates* scene, look at the **Shrub** on the left and interact/pick up to find the **Brass Key**.
2. **Unlock the Gates**: Select the **Brass Key** from your inventory and use it on the **Castle Door** (`hotspot_gate_door`). The gate unlocks (`labUnlocked` flag set to `true`).
3. **Enter the Laboratory**: Interact with the open doorway to transition to the *Alchemist Laboratory*.
4. **Talk to Master Eldrin**: Walk up to **Master Eldrin** and speak with him. Inquire about the elixir to receive the **Glowing Crystal** in your inventory.
5. **Brew the Potion**: Select the **Glowing Crystal** from your inventory and drop/use it on the **Bubbling Cauldron** (`hotspot_cauldron`). The brewing animation and sound effects trigger, producing the **Elixir of Wisdom** and completing the quest!

---

## 🎵 Music & Audio Credits

### Scene 1 (Gates of Eldoria)
- **Track**: *Breton* by **Pufino**
- **Source**: [https://freetouse.com/music](https://freetouse.com/music)
- **License**: Free Background Music (No Copyright)

### Scene 2 (Alchemist Laboratory)
- **Track**: *Whispers of the Harp* by **Aetheric**
- **Source**: [https://freetouse.com/music](https://freetouse.com/music)
- **License**: Free To Use Music for Video
