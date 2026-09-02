# WebQuestEngine
[![Sponsor](https://img.shields.io/badge/-Sponsor%20on%20GitHub-ea4aaa?style=flat-square&logo=github&logoColor=white)](https://github.com/sponsors/itaibh)
![license](https://img.shields.io/badge/license-MIT-green)

> ⚠️ **Work in Progress (WIP)**: WebQuestEngine is currently under active development. Features and engine interfaces are subject to rapid evolution.

---

## 🎮 Play the Live Demo Quest

Experience the engine in action with our sample quest, **The Alchemist's Mystery**:

* 🕹️ **[Play Demo Quest (Fullscreen Game)](https://webquestengine.github.io/WebQuestEngine/player.html)** — Play the standalone point-and-click adventure demo directly in your browser.
* 🛠️ **[Launch WebQuestEngine Studio](https://webquestengine.github.io/WebQuestEngine/)** — Open the full visual authoring editor loaded with the demo project to inspect and tweak scenes, characters, dialog trees, and logic rules.

---

## 🎯 Project Objective

**WebQuestEngine** is a modern, browser-based **2D Point & Click Adventure Game Engine & Authoring Studio** built with **TypeScript**, **PixiJS**, and **Vite**. 

The goal of this project is to empower game creators, writers, and narrative designers to build, design, and playtest classic 90s-style graphic adventure games (inspired by LucasArts classics like *Monkey Island* and Sierra titles) through an intuitive visual editor—all running natively in the browser without requiring code.

---

## ✨ Key Features

* 🌳 **Visual Project Tree Hierarchy**: Organizes chapters, scenes, characters, objects, and quest items into an interactive tree view with immediate inspector synchronisation.
* 🎬 **Multi-Layer Parallax & WalkPath Editor**: Edit background/foreground layers, dynamic depth perspective scaling, and walkable floor polygons.
* 🔀 **Scoped Logic Rule Builder**: Configure interaction outcomes using an intuitive `WHEN ➔ IF ➔ THEN` rule builder supporting scoped flags (`player:hasKey`, `quest:labUnlocked`, `shrub:searched`).
* 💬 **Branching Dialogue Tree Studio**: Create interactive NPC conversations with conditional dialogue choices, speaker portraits, item rewards, and state triggers.
* 🖼️ **Asset & Graphic Thumbnails**: Live inline thumbnail previews for textures, spritesheets, and quest item icons.
* 🎮 **Full-Screen Playtest Mode**: Switch seamlessly between 1:1 editor mode and full-screen immersive playtesting with a single click.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* `npm` or `yarn`

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/itaibh/WebQuestEngine.git
cd WebQuestEngine

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser at `http://localhost:5173` to launch the **WebQuestEngine Studio**.

### Production Build

```bash
# Typecheck and bundle for production
npm run build
```

---

## 📄 License

MIT License. See `LICENSE` for details.
