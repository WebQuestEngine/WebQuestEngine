import { ProjectData, SceneData, CharacterData } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';

export interface SelectionTarget {
  type: 'project' | 'chapter' | 'scene' | 'walkpath' | 'layer' | 'hotspot' | 'character' | 'item';
  id?: string;
  sceneId?: string;
}

export class ProjectTreeView {
  public element: HTMLElement;
  private project: ProjectData | null = null;
  private selectedNodeId: string | null = null;
  private collapsedNodes: Set<string> = new Set();
  private activeContextMenu: HTMLElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'editor-tree-sidebar';
    this.render();

    // Close active context menu on global click/scroll
    document.addEventListener('click', () => this.closeContextMenu());
    document.addEventListener('contextmenu', (e) => {
      if (!this.element.contains(e.target as Node)) {
        this.closeContextMenu();
      }
    });

    // Listen to selection events from editor/engine to highlight tree nodes bi-directionally
    EventBus.getInstance().on('editor:element_selected', (payload: { type: string; id: string; sceneId?: string }) => {
      if (payload.type === 'scene') {
        this.selectedNodeId = `scene_${payload.id}`;
      } else if (payload.type === 'walkpath') {
        this.selectedNodeId = `walkpath_${payload.sceneId || payload.id}`;
      } else if (payload.type === 'layer') {
        this.selectedNodeId = `layer_${payload.id}`;
      } else if (payload.type === 'hotspot') {
        this.selectedNodeId = `hotspot_${payload.id}`;
      } else if (payload.type === 'character') {
        this.selectedNodeId = `character_${payload.id}`;
      } else if (payload.type === 'item') {
        this.selectedNodeId = `item_${payload.id}`;
      }
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_layer', (id: string) => {
      this.selectedNodeId = `layer_${id}`;
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_hotspot', (id: string) => {
      this.selectedNodeId = `hotspot_${id}`;
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_character', (id: string) => {
      this.selectedNodeId = `character_${id}`;
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_item', (id: string) => {
      this.selectedNodeId = `item_${id}`;
      this.renderContent();
    });

    EventBus.getInstance().on('editor:select_walkpath', (sceneId: string) => {
      this.selectedNodeId = `walkpath_${sceneId}`;
      this.renderContent();
    });

    EventBus.getInstance().on('editor:project_updated', () => {
      this.renderContent();
    });

    EventBus.getInstance().on('editor:toggle_lock', (target: { type: string; id?: string; sceneId?: string }) => {
      if (target) {
        this.toggleLock(target.type, target.id, target.sceneId);
      }
    });
  }

  public setProject(project: ProjectData): void {
    this.project = project;
    this.renderContent();
  }

  public selectNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.renderContent();
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="tree-header" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; font-family:var(--font-heading);">📖 Quest Hierarchy</span>
          <button class="btn" id="btn-collapse-all" style="font-size:0.65rem; padding:2px 6px;">Collapse</button>
        </div>
        
        <!-- Top Action Toolbar -->
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:4px;">
          <button class="btn btn-primary" id="btn-tree-add-ch" style="font-size:0.65rem; padding:4px 2px;" title="Add New Chapter">+ Chapter</button>
          <button class="btn btn-primary" id="btn-tree-add-sc" style="font-size:0.65rem; padding:4px 2px;" title="Add New Scene">+ Scene</button>
          <button class="btn btn-primary" id="btn-tree-add-obj" style="font-size:0.65rem; padding:4px 2px;" title="Add Interactive Object">+ Object</button>
          <button class="btn btn-primary" id="btn-tree-add-layer" style="font-size:0.65rem; padding:4px 2px;" title="Add Background Layer">+ Layer</button>
          <button class="btn btn-primary" id="btn-tree-add-char" style="font-size:0.65rem; padding:4px 2px;" title="Add NPC Character">+ NPC</button>
          <button class="btn btn-primary" id="btn-tree-add-item" style="font-size:0.65rem; padding:4px 2px;" title="Add Quest Item">+ Item</button>
        </div>
      </div>
      <div class="tree-content" id="tree-root-container"></div>
    `;

    this.element.querySelector('#btn-tree-add-ch')?.addEventListener('click', () => this.addChapter());
    this.element.querySelector('#btn-tree-add-sc')?.addEventListener('click', () => this.addScene());
    this.element.querySelector('#btn-tree-add-obj')?.addEventListener('click', () => this.addHotspot());
    this.element.querySelector('#btn-tree-add-layer')?.addEventListener('click', () => this.addLayer());
    this.element.querySelector('#btn-tree-add-char')?.addEventListener('click', () => this.addCharacter());
    this.element.querySelector('#btn-tree-add-item')?.addEventListener('click', () => this.addItem());

    this.element.querySelector('#btn-collapse-all')?.addEventListener('click', () => {
      if (!this.project) return;
      this.project.chapters.forEach(ch => {
        this.collapsedNodes.add(`chapter_${ch.id}`);
        this.collapsedNodes.add(`scenes_folder_${ch.id}`);
        this.collapsedNodes.add(`characters_folder_${ch.id}`);
        this.collapsedNodes.add(`items_folder_${ch.id}`);
      });
      this.project.scenes.forEach(sc => {
        this.collapsedNodes.add(`scene_${sc.id}`);
        this.collapsedNodes.add(`background_folder_${sc.id}`);
        this.collapsedNodes.add(`objects_folder_${sc.id}`);
      });
      this.renderContent();
    });
  }

  public isNodeLocked(type: string, id?: string, sceneId?: string): boolean {
    if (!this.project) return false;

    if (type === 'chapter' && id) {
      const ch = this.project.chapters.find(c => c.id === id);
      return !!ch?.locked;
    }

    if (type === 'scene' && id) {
      const sc = this.project.scenes.find(s => s.id === id);
      if (sc?.locked) return true;
      const ch = this.project.chapters[0];
      return !!ch?.locked;
    }

    if (type === 'background_folder' && sceneId) {
      const sc = this.project.scenes.find(s => s.id === sceneId);
      if (sc?.locked) return true;
      return sc?.layers.length ? sc.layers.every(l => l.locked) : false;
    }

    if (type === 'objects_folder' && sceneId) {
      const sc = this.project.scenes.find(s => s.id === sceneId);
      if (sc?.locked) return true;
      return sc?.hotspots.length ? sc.hotspots.every(h => h.locked) : false;
    }

    if (type === 'characters_folder') {
      const sc = sceneId ? this.project.scenes.find(s => s.id === sceneId) : this.project.scenes[0];
      if (sc?.locked) return true;
      return sc?.characters.length ? sc.characters.every(c => c.locked) : false;
    }

    if (type === 'layer' && id && sceneId) {
      const sc = this.project.scenes.find(s => s.id === sceneId);
      if (sc?.locked) return true;
      const l = sc?.layers.find(x => x.id === id);
      return !!l?.locked;
    }

    if (type === 'hotspot' && id && sceneId) {
      const sc = this.project.scenes.find(s => s.id === sceneId);
      if (sc?.locked) return true;
      const h = sc?.hotspots.find(x => x.id === id);
      return !!h?.locked;
    }

    if (type === 'character' && id) {
      const sc = sceneId ? this.project.scenes.find(s => s.id === sceneId) : this.project.scenes[0];
      if (sc?.locked) return true;
      const c = sc?.characters.find(x => x.id === id);
      return !!c?.locked;
    }

    if (type === 'walkpath' && sceneId) {
      const sc = this.project.scenes.find(s => s.id === sceneId);
      if (sc?.locked) return true;
      const wp = sc?.walkPaths[0];
      return !!wp?.locked;
    }

    return false;
  }

  private renderLockBtn(type: string, id?: string, sceneId?: string): string {
    const locked = this.isNodeLocked(type, id, sceneId);
    return `
      <span class="tree-lock-btn ${locked ? 'locked' : ''}"
            data-locktype="${type}"
            data-lockid="${id || ''}"
            data-locksceneid="${sceneId || ''}"
            title="${locked ? 'Locked (Click to Unlock)' : 'Unlocked (Click to Lock)'}">
        ${locked ? '🔒' : '🔓'}
      </span>
    `;
  }

  public toggleLock(type: string, id?: string, sceneId?: string): void {
    if (!this.project) return;
    const currentlyLocked = this.isNodeLocked(type, id, sceneId);
    const newLock = !currentlyLocked;

    if (newLock) {
      // Locking a parent -> Automatically locks everything inside it!
      if (type === 'chapter' && id) {
        const ch = this.project.chapters.find(c => c.id === id);
        if (ch) ch.locked = true;
        this.project.scenes.forEach(sc => {
          sc.locked = true;
          sc.layers.forEach(l => l.locked = true);
          sc.hotspots.forEach(h => h.locked = true);
          sc.characters.forEach(c => c.locked = true);
          sc.walkPaths.forEach(wp => wp.locked = true);
        });
      } else if (type === 'scene' && id) {
        const sc = this.project.scenes.find(s => s.id === id);
        if (sc) {
          sc.locked = true;
          sc.layers.forEach(l => l.locked = true);
          sc.hotspots.forEach(h => h.locked = true);
          sc.characters.forEach(c => c.locked = true);
          sc.walkPaths.forEach(wp => wp.locked = true);
        }
      } else if (type === 'background_folder' && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        if (sc) sc.layers.forEach(l => l.locked = true);
      } else if (type === 'objects_folder' && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        if (sc) sc.hotspots.forEach(h => h.locked = true);
      } else if (type === 'characters_folder') {
        this.project.scenes.forEach(sc => sc.characters.forEach(c => c.locked = true));
      } else if (type === 'layer' && id && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        const l = sc?.layers.find(x => x.id === id);
        if (l) l.locked = true;
      } else if (type === 'hotspot' && id && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        const h = sc?.hotspots.find(x => x.id === id);
        if (h) h.locked = true;
      } else if (type === 'character' && id) {
        this.project.scenes.forEach(sc => {
          const c = sc.characters.find(x => x.id === id);
          if (c) c.locked = true;
        });
      } else if (type === 'walkpath' && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        const wp = sc?.walkPaths[0];
        if (wp) wp.locked = true;
      }
    } else {
      // Unlocking a child -> Automatically unlocks all parents up the tree hierarchy!
      if (type === 'layer' && id && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        const l = sc?.layers.find(x => x.id === id);
        if (l) l.locked = false;
        if (sc) sc.locked = false;
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'hotspot' && id && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        const h = sc?.hotspots.find(x => x.id === id);
        if (h) h.locked = false;
        if (sc) sc.locked = false;
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'character' && id) {
        this.project.scenes.forEach(sc => {
          const c = sc.characters.find(x => x.id === id);
          if (c) c.locked = false;
          sc.locked = false;
        });
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'walkpath' && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        const wp = sc?.walkPaths[0];
        if (wp) wp.locked = false;
        if (sc) sc.locked = false;
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'background_folder' && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        if (sc) {
          sc.layers.forEach(l => l.locked = false);
          sc.locked = false;
        }
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'objects_folder' && sceneId) {
        const sc = this.project.scenes.find(s => s.id === sceneId);
        if (sc) {
          sc.hotspots.forEach(h => h.locked = false);
          sc.locked = false;
        }
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'characters_folder') {
        this.project.scenes.forEach(sc => {
          sc.characters.forEach(c => c.locked = false);
          sc.locked = false;
        });
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'scene' && id) {
        const sc = this.project.scenes.find(s => s.id === id);
        if (sc) sc.locked = false;
        if (this.project.chapters[0]) this.project.chapters[0].locked = false;
      } else if (type === 'chapter' && id) {
        const ch = this.project.chapters.find(c => c.id === id);
        if (ch) ch.locked = false;
      }
    }

    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
  }

  private renderContent(): void {
    const container = this.element.querySelector('#tree-root-container');
    if (!container || !this.project) return;

    let html = '';

    for (const ch of this.project.chapters) {
      const chKey = `chapter_${ch.id}`;
      const isChCollapsed = this.collapsedNodes.has(chKey);

      html += `
        <div class="tree-group">
          <div class="tree-item ${this.selectedNodeId === chKey ? 'selected' : ''}" data-nodeid="${chKey}" data-type="chapter" data-id="${ch.id}">
            <span class="tree-toggler" data-key="${chKey}">${isChCollapsed ? '▶' : '▼'}</span>
            <span style="flex:1;">📖 ${ch.title}</span>
            ${this.renderLockBtn('chapter', ch.id)}
          </div>

          ${!isChCollapsed ? `
            <div class="tree-children">
              <!-- SCENES FOLDER -->
              ${this.renderScenesFolder(ch.id)}

              <!-- CHARACTERS FOLDER -->
              ${this.renderCharactersFolder(ch.id)}

              <!-- ITEMS FOLDER -->
              ${this.renderItemsFolder(ch.id)}
            </div>
          ` : ''}
        </div>
      `;
    }

    container.innerHTML = html;
    this.attachEvents();
  }

  private renderScenesFolder(chapterId: string): string {
    if (!this.project) return '';
    const folderKey = `scenes_folder_${chapterId}`;
    const isCollapsed = this.collapsedNodes.has(folderKey);

    let html = `
      <div class="tree-group tree-node">
        <div class="tree-item ${this.selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="scenes_folder">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span>📂 Scenes (${this.project.scenes.length})</span>
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${this.project.scenes.map(sc => {
      const scKey = `scene_${sc.id}`;
      const wpKey = `walkpath_${sc.id}`;
      const isScCollapsed = this.collapsedNodes.has(scKey);
      return `
                <div class="tree-group tree-node">
                  <div class="tree-item ${this.selectedNodeId === scKey ? 'selected' : ''}" data-nodeid="${scKey}" data-type="scene" data-id="${sc.id}">
                    <span class="tree-toggler" data-key="${scKey}">${isScCollapsed ? '▶' : '▼'}</span>
                    <span style="flex:1;">🎬 ${sc.name}</span>
                    ${this.renderLockBtn('scene', sc.id)}
                  </div>

                  ${!isScCollapsed ? `
                    <div class="tree-children">
                      <!-- 1. Layers Folder (Parallax Layers) -->
                      ${this.renderBackgroundFolder(sc)}

                      <!-- 2. Objects Folder (Interactive Hotspots) -->
                      ${this.renderObjectsFolder(sc)}

                      <!-- 3. WalkPath Polygon Node -->
                      <div class="tree-item tree-node ${this.selectedNodeId === wpKey ? 'selected' : ''}" data-nodeid="${wpKey}" data-type="walkpath" data-sceneid="${sc.id}">
                        <span style="flex:1;">🚶 WalkPath Polygon</span>
                        ${this.renderLockBtn('walkpath', undefined, sc.id)}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
    }).join('')}
          </div>
        ` : ''}
      </div>
    `;
    return html;
  }

  private renderBackgroundFolder(scene: SceneData): string {
    const folderKey = `background_folder_${scene.id}`;
    const isCollapsed = this.collapsedNodes.has(folderKey);

    let html = `
      <div class="tree-group tree-node">
        <div class="tree-item ${this.selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="background_folder" data-sceneid="${scene.id}">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span style="flex:1;">📂 Layers (${scene.layers.length})</span>
          ${this.renderLockBtn('background_folder', undefined, scene.id)}
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${scene.layers.map((l, lIdx) => {
              const lKey = `layer_${l.id}`;
              return `
                <div class="tree-item tree-node layer-tree-node ${this.selectedNodeId === lKey ? 'selected' : ''}"
                     draggable="true"
                     data-nodeid="${lKey}"
                     data-type="layer"
                     data-id="${l.id}"
                     data-sceneid="${scene.id}"
                     data-idx="${lIdx}">
                  <span style="flex:1;">🖼️ ${l.name}</span>
                  ${this.renderLockBtn('layer', l.id, scene.id)}
                  <span class="tree-layer-actions">
                    <button class="tree-action-btn btn-tree-layer-up" data-sceneid="${scene.id}" data-id="${l.id}" title="Move Backwards">⬆️</button>
                    <button class="tree-action-btn btn-tree-layer-down" data-sceneid="${scene.id}" data-id="${l.id}" title="Move Forwards">⬇️</button>
                    <button class="tree-action-btn btn-tree-layer-dup" data-sceneid="${scene.id}" data-id="${l.id}" title="Duplicate Layer">📋</button>
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
    return html;
  }

  private renderObjectsFolder(scene: SceneData): string {
    const folderKey = `objects_folder_${scene.id}`;
    const isCollapsed = this.collapsedNodes.has(folderKey);

    let html = `
      <div class="tree-group tree-node">
        <div class="tree-item ${this.selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="objects_folder" data-sceneid="${scene.id}">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span style="flex:1;">📂 Objects (${scene.hotspots.length})</span>
          ${this.renderLockBtn('objects_folder', undefined, scene.id)}
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${scene.hotspots.map(hs => {
      const hsKey = `hotspot_${hs.id}`;
      return `
                <div class="tree-item tree-node ${this.selectedNodeId === hsKey ? 'selected' : ''}" data-nodeid="${hsKey}" data-type="hotspot" data-id="${hs.id}" data-sceneid="${scene.id}">
                  <span style="flex:1;">🎯 ${hs.name}</span>
                  ${this.renderLockBtn('hotspot', hs.id, scene.id)}
                </div>
              `;
    }).join('')}
          </div>
        ` : ''}
      </div>
    `;
    return html;
  }

  private renderCharactersFolder(chapterId: string): string {
    if (!this.project) return '';
    const folderKey = `characters_folder_${chapterId}`;
    const isCollapsed = this.collapsedNodes.has(folderKey);

    const seenCharIds = new Set<string>();
    const allChars: { id: string; name: string; sceneId: string }[] = [];

    const currentScene = (window as any).engine?.currentScene;
    if (currentScene) {
      currentScene.data.characters.forEach((c: CharacterData) => {
        if (!seenCharIds.has(c.id)) {
          seenCharIds.add(c.id);
          allChars.push({ id: c.id, name: c.name, sceneId: currentScene.data.id });
        }
      });
    }

    this.project.scenes.forEach(sc => {
      sc.characters.forEach((c: CharacterData) => {
        if (!seenCharIds.has(c.id)) {
          seenCharIds.add(c.id);
          allChars.push({ id: c.id, name: c.name, sceneId: sc.id });
        }
      });
    });

    let html = `
      <div class="tree-group tree-node">
        <div class="tree-item ${this.selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="characters_folder">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span style="flex:1;">📂 Characters (${allChars.length})</span>
          ${this.renderLockBtn('characters_folder', undefined, chapterId)}
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${allChars.map(c => {
      const cKey = `character_${c.id}`;
      return `
                <div class="tree-item tree-node ${this.selectedNodeId === cKey ? 'selected' : ''}" data-nodeid="${cKey}" data-type="character" data-id="${c.id}" data-sceneid="${c.sceneId}">
                  <span style="flex:1;">👤 ${c.name}</span>
                  ${this.renderLockBtn('character', c.id, c.sceneId)}
                </div>
              `;
    }).join('')}
          </div>
        ` : ''}
      </div>
    `;
    return html;
  }

  private renderItemsFolder(chapterId: string): string {
    if (!this.project) return '';
    const folderKey = `items_folder_${chapterId}`;
    const isCollapsed = this.collapsedNodes.has(folderKey);

    let html = `
      <div class="tree-group tree-node">
        <div class="tree-item ${this.selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="items_folder">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span>📂 Items (${this.project.items.length})</span>
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${this.project.items.map(item => {
      const itemKey = `item_${item.id}`;
      return `
                <div class="tree-item tree-node ${this.selectedNodeId === itemKey ? 'selected' : ''}" data-nodeid="${itemKey}" data-type="item" data-id="${item.id}">
                  <span>🎒 ${item.name}</span>
                </div>
              `;
    }).join('')}
          </div>
        ` : ''}
      </div>
    `;
    return html;
  }

  public addChapter(): void {
    if (!this.project) return;
    const newChId = `ch_${Date.now()}`;
    const newCh = {
      id: newChId,
      title: `Chapter ${this.project.chapters.length + 1}`,
      description: 'New quest chapter',
      startStoryNodeId: ''
    };
    this.project.chapters.push(newCh);
    this.selectedNodeId = `chapter_${newChId}`;
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('editor:select_target', { type: 'chapter', id: newChId });
  }

  public addScene(): void {
    if (!this.project) return;
    const newScId = `scene_${Date.now()}`;
    const newSc: SceneData = {
      id: newScId,
      name: `New Scene ${this.project.scenes.length + 1}`,
      width: 1920,
      height: 1080,
      layers: [{
        id: `layer_${Date.now()}`,
        name: 'Background',
        imageUrl: 'procedural:lab_background',
        parallaxX: 1,
        parallaxY: 1,
        zIndex: 0,
        opacity: 1,
        visible: true
      }],
      walkPaths: [{
        id: `wp_${Date.now()}`,
        name: 'WalkPath Polygon',
        enabled: true,
        scaling: { minY: 400, maxY: 1080, minScale: 0.6, maxScale: 1.2 },
        points: [
          { x: 200, y: 850 },
          { x: 1700, y: 850 },
          { x: 1700, y: 1020 },
          { x: 200, y: 1020 }
        ]
      }],
      hotspots: [],
      characters: [],
      playerSpawn: { x: 400, y: 950 }
    };
    this.project.scenes.push(newSc);
    this.selectedNodeId = `scene_${newScId}`;
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('editor:select_scene', newScId);
    EventBus.getInstance().emit('editor:select_target', { type: 'scene', id: newScId });
  }

  public addLayer(sceneId?: string): void {
    if (!this.project) return;
    const scene = sceneId ? this.project.scenes.find(s => s.id === sceneId) || this.project.scenes[0] : this.project.scenes[0];
    if (!scene) return;
    const newLayer = {
      id: `layer_${Date.now()}`,
      name: `New Layer ${scene.layers.length + 1}`,
      imageUrl: 'procedural:shrub',
      parallaxX: 1,
      parallaxY: 1,
      zIndex: scene.layers.length,
      opacity: 1,
      visible: true
    };
    scene.layers.push(newLayer);
    this.selectedNodeId = `layer_${newLayer.id}`;
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('editor:select_target', { type: 'layer', sceneId: scene.id, id: newLayer.id });
  }

  public addHotspot(sceneId?: string): void {
    if (!this.project) return;
    const scene = sceneId ? this.project.scenes.find(s => s.id === sceneId) || this.project.scenes[0] : this.project.scenes[0];
    if (!scene) return;
    const newHs = {
      id: `hs_${Date.now()}`,
      name: `New Object ${scene.hotspots.length + 1}`,
      cursor: 'interact',
      enabled: true,
      points: [
        { x: 500, y: 500 },
        { x: 700, y: 500 },
        { x: 700, y: 700 },
        { x: 500, y: 700 }
      ],
      actions: [
        { verb: 'look' as const, text: 'You see a new object.' }
      ]
    };
    scene.hotspots.push(newHs);
    this.selectedNodeId = `hotspot_${newHs.id}`;
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('editor:select_target', { type: 'hotspot', sceneId: scene.id, id: newHs.id });
  }

  public addCharacter(sceneId?: string): void {
    if (!this.project) return;
    const targetScene = sceneId ? this.project.scenes.find(s => s.id === sceneId) || this.project.scenes[0] : this.project.scenes[0];
    if (!targetScene) return;
    const newChar = {
      id: `npc_${Date.now()}`,
      name: `New NPC ${targetScene.characters.length + 1}`,
      spriteSheetUrl: 'procedural:npc',
      position: { x: 960, y: 950 },
      scale: 0.8,
      speed: 200,
      frameWidth: 64,
      frameHeight: 64,
      talkColor: '#fde047',
      animations: {
        idleDown: [0],
        idleSide: [0],
        idleUp: [0],
        walkDown: [0],
        walkSide: [0],
        walkUp: [0],
        talk: [0]
      },
      actions: [
        { verb: 'talk' as const, text: 'Hello traveler!' }
      ]
    };
    targetScene.characters.push(newChar);
    this.selectedNodeId = `character_${newChar.id}`;
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('editor:select_target', { type: 'character', sceneId: targetScene.id, id: newChar.id });
  }

  public addItem(): void {
    if (!this.project) return;
    const newItem = {
      id: `item_${Date.now()}`,
      name: `Quest Item ${this.project.items.length + 1}`,
      description: 'A newly discovered quest item.',
      iconUrl: 'procedural:key'
    };
    this.project.items.push(newItem);
    this.selectedNodeId = `item_${newItem.id}`;
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('editor:select_target', { type: 'item', id: newItem.id });
  }

  public duplicateScene(sceneId: string): void {
    if (!this.project) return;
    const sc = this.project.scenes.find(s => s.id === sceneId);
    if (!sc) return;
    const dupSc: SceneData = JSON.parse(JSON.stringify(sc));
    dupSc.id = `scene_${Date.now()}`;
    dupSc.name = `${sc.name} (Copy)`;
    this.project.scenes.push(dupSc);
    this.selectedNodeId = `scene_${dupSc.id}`;
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
    EventBus.getInstance().emit('editor:select_scene', dupSc.id);
    EventBus.getInstance().emit('editor:select_target', { type: 'scene', id: dupSc.id });
  }

  public moveLayerUp(sceneId: string, layerId: string): void {
    if (!this.project) return;
    const sc = this.project.scenes.find(s => s.id === sceneId);
    if (!sc) return;
    const idx = sc.layers.findIndex(l => l.id === layerId);
    if (idx > 0) {
      const item = sc.layers[idx];
      sc.layers.splice(idx, 1);
      sc.layers.splice(idx - 1, 0, item);
      sc.layers.forEach((l, i) => l.zIndex = i + 1);
      this.renderContent();
      EventBus.getInstance().emit('editor:project_updated');
    }
  }

  public moveLayerDown(sceneId: string, layerId: string): void {
    if (!this.project) return;
    const sc = this.project.scenes.find(s => s.id === sceneId);
    if (!sc) return;
    const idx = sc.layers.findIndex(l => l.id === layerId);
    if (idx < sc.layers.length - 1) {
      const item = sc.layers[idx];
      sc.layers.splice(idx, 1);
      sc.layers.splice(idx + 1, 0, item);
      sc.layers.forEach((l, i) => l.zIndex = i + 1);
      this.renderContent();
      EventBus.getInstance().emit('editor:project_updated');
    }
  }

  public duplicateLayer(sceneId: string, layerId: string): void {
    if (!this.project) return;
    const sc = this.project.scenes.find(s => s.id === sceneId);
    if (!sc) return;
    const idx = sc.layers.findIndex(l => l.id === layerId);
    if (idx !== -1) {
      const orig = sc.layers[idx];
      const copyId = `layer_${Date.now()}`;
      const copy = {
        ...JSON.parse(JSON.stringify(orig)),
        id: copyId,
        name: `${orig.name} (Copy)`,
        x: (orig.x || 0) + 30,
        y: (orig.y || 0) + 30,
        zIndex: sc.layers.length + 1
      };
      sc.layers.splice(idx + 1, 0, copy);
      sc.layers.forEach((l, i) => l.zIndex = i + 1);
      this.selectedNodeId = `layer_${copyId}`;
      this.renderContent();
      EventBus.getInstance().emit('editor:select_layer', copyId);
      EventBus.getInstance().emit('editor:select_target', { type: 'layer', sceneId: sc.id, id: copyId });
      EventBus.getInstance().emit('editor:project_updated');
    }
  }

  public reorderLayer(sceneId: string, fromIdx: number, toIdx: number): void {
    if (!this.project) return;
    const sc = this.project.scenes.find(s => s.id === sceneId);
    if (!sc || fromIdx === toIdx) return;
    const [item] = sc.layers.splice(fromIdx, 1);
    sc.layers.splice(toIdx, 0, item);
    sc.layers.forEach((l, i) => l.zIndex = i + 1);
    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
  }

  public deleteNode(type: string, id?: string, sceneId?: string): void {
    if (!this.project) return;

    if (type === 'chapter' && id && this.project.chapters.length > 1) {
      const idx = this.project.chapters.findIndex(c => c.id === id);
      if (idx !== -1) this.project.chapters.splice(idx, 1);
    } else if (type === 'scene' && id && this.project.scenes.length > 1) {
      const idx = this.project.scenes.findIndex(s => s.id === id);
      if (idx !== -1) {
        this.project.scenes.splice(idx, 1);
        const nextSc = this.project.scenes[0];
        EventBus.getInstance().emit('editor:select_scene', nextSc.id);
        EventBus.getInstance().emit('editor:select_target', { type: 'scene', id: nextSc.id });
      }
    } else if (type === 'layer' && id && sceneId) {
      const sc = this.project.scenes.find(s => s.id === sceneId);
      if (sc) {
        const idx = sc.layers.findIndex(l => l.id === id);
        if (idx !== -1) sc.layers.splice(idx, 1);
      }
    } else if (type === 'hotspot' && id && sceneId) {
      const sc = this.project.scenes.find(s => s.id === sceneId);
      if (sc) {
        const idx = sc.hotspots.findIndex(h => h.id === id);
        if (idx !== -1) sc.hotspots.splice(idx, 1);
      }
    } else if (type === 'character' && id) {
      this.project.scenes.forEach(sc => {
        const idx = sc.characters.findIndex(c => c.id === id);
        if (idx !== -1) sc.characters.splice(idx, 1);
      });
    } else if (type === 'item' && id) {
      const idx = this.project.items.findIndex(i => i.id === id);
      if (idx !== -1) this.project.items.splice(idx, 1);
    }

    this.renderContent();
    EventBus.getInstance().emit('editor:project_updated');
  }

  private closeContextMenu(): void {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }

  private openContextMenu(e: MouseEvent, type: string, id?: string, sceneId?: string): void {
    e.preventDefault();
    e.stopPropagation();
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'tree-context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    let itemsHTML = '';

    if (type === 'chapter') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="add-scene">➕ Add Scene</div>
        <div class="tree-context-menu-divider"></div>
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Chapter</div>
      `;
    } else if (type === 'scene') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="dup-scene">📋 Duplicate Scene</div>
        <div class="tree-context-menu-item" data-action="add-obj">🎯 Add Object</div>
        <div class="tree-context-menu-item" data-action="add-layer">🖼️ Add Layer</div>
        <div class="tree-context-menu-divider"></div>
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Scene</div>
      `;
    } else if (type === 'background_folder') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="add-layer">🖼️ Add Parallax Layer</div>
      `;
    } else if (type === 'layer') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="move-layer-up">⬆️ Move Backwards (Behind)</div>
        <div class="tree-context-menu-item" data-action="move-layer-down">⬇️ Move Forwards (In Front)</div>
        <div class="tree-context-menu-item" data-action="dup-layer">📋 Duplicate Layer</div>
        <div class="tree-context-menu-divider"></div>
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Layer</div>
      `;
    } else if (type === 'objects_folder') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="add-obj">🎯 Add Interactive Object</div>
      `;
    } else if (type === 'hotspot') {
      itemsHTML += `
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Object</div>
      `;
    } else if (type === 'characters_folder') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="add-char">👤 Add Character (NPC)</div>
      `;
    } else if (type === 'character') {
      itemsHTML += `
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Character</div>
      `;
    } else if (type === 'items_folder') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="add-item">🎒 Add Quest Item</div>
      `;
    } else if (type === 'item') {
      itemsHTML += `
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Item</div>
      `;
    } else if (type === 'walkpath') {
      itemsHTML += `
        <div class="tree-context-menu-item" data-action="draw-wp-scratch">✏️ Redraw WalkPath From Scratch</div>
      `;
    }

    if (!itemsHTML) return;

    menu.innerHTML = itemsHTML;
    document.body.appendChild(menu);
    this.activeContextMenu = menu;

    // Attach menu actions
    menu.querySelectorAll('.tree-context-menu-item').forEach(item => {
      item.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const action = (evt.currentTarget as HTMLElement).dataset.action;

        if (action === 'add-scene') this.addScene();
        else if (action === 'dup-scene' && id) this.duplicateScene(id);
        else if (action === 'add-obj') this.addHotspot(sceneId || id);
        else if (action === 'add-layer') this.addLayer(sceneId || id);
        else if (action === 'add-char') this.addCharacter(sceneId);
        else if (action === 'add-item') this.addItem();
        else if (action === 'del-node') this.deleteNode(type, id, sceneId);
        else if (action === 'move-layer-up' && id && sceneId) this.moveLayerUp(sceneId, id);
        else if (action === 'move-layer-down' && id && sceneId) this.moveLayerDown(sceneId, id);
        else if (action === 'dup-layer' && id && sceneId) this.duplicateLayer(sceneId, id);
        else if (action === 'draw-wp-scratch') {
          EventBus.getInstance().emit('editor:start_draw_polygon', { targetType: 'walkpath' });
        }

        this.closeContextMenu();
      });
    });
  }

  private attachEvents(): void {
    // Toggle expand/collapse
    this.element.querySelectorAll('.tree-toggler').forEach(toggler => {
      toggler.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = (e.currentTarget as HTMLElement).dataset.key!;
        if (this.collapsedNodes.has(key)) {
          this.collapsedNodes.delete(key);
        } else {
          this.collapsedNodes.add(key);
        }
        this.renderContent();
      });
    });

    // Right-click Context Menu listener on tree items
    this.element.querySelectorAll('.tree-item').forEach(item => {
      item.addEventListener('contextmenu', (e) => {
        const el = e.currentTarget as HTMLElement;
        const type = el.dataset.type!;
        const id = el.dataset.id;
        const sceneId = el.dataset.sceneid;
        this.openContextMenu(e as MouseEvent, type, id, sceneId);
      });
    });

    // Item selection
    this.element.querySelectorAll('.tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const nodeId = el.dataset.nodeid!;
        const type = el.dataset.type!;
        const id = el.dataset.id;
        const sceneId = el.dataset.sceneid;

        this.selectedNodeId = nodeId;

        if (type === 'scene' && id) {
          EventBus.getInstance().emit('editor:select_scene', id);
          EventBus.getInstance().emit('editor:select_target', { type: 'scene', id });
        } else if (type === 'walkpath' && sceneId) {
          EventBus.getInstance().emit('editor:select_scene', sceneId);
          EventBus.getInstance().emit('editor:select_walkpath', sceneId);
          EventBus.getInstance().emit('editor:select_target', { type: 'walkpath', sceneId });
        } else if (type === 'layer' && id) {
          if (sceneId) EventBus.getInstance().emit('editor:select_scene', sceneId);
          EventBus.getInstance().emit('editor:select_layer', id);
          EventBus.getInstance().emit('editor:select_target', { type: 'layer', sceneId, id });
        } else if (type === 'hotspot' && id) {
          if (sceneId) EventBus.getInstance().emit('editor:select_scene', sceneId);
          EventBus.getInstance().emit('editor:select_hotspot', id);
          EventBus.getInstance().emit('editor:select_target', { type: 'hotspot', sceneId, id });
        } else if (type === 'character' && id) {
          const activeScene = (window as any).engine?.currentScene;
          const existsInActive = activeScene && activeScene.data.characters.some((c: CharacterData) => c.id === id);
          const targetSceneId = existsInActive ? activeScene.data.id : sceneId;

          if (targetSceneId && (!activeScene || activeScene.data.id !== targetSceneId)) {
            EventBus.getInstance().emit('editor:select_scene', targetSceneId);
          }
          EventBus.getInstance().emit('editor:select_character', id);
          EventBus.getInstance().emit('editor:select_target', { type: 'character', sceneId: targetSceneId, id });
        } else if (type === 'item' && id) {
          EventBus.getInstance().emit('editor:select_item', id);
          EventBus.getInstance().emit('editor:select_target', { type: 'item', id });
        } else if (type === 'chapter' && id) {
          EventBus.getInstance().emit('editor:select_target', { type: 'chapter', id });
        } else if (type.endsWith('folder')) {
          if (this.collapsedNodes.has(nodeId)) {
            this.collapsedNodes.delete(nodeId);
          } else {
            this.collapsedNodes.add(nodeId);
          }
        }

        this.renderContent();
      });
    });

    // Lock toggle button listener
    this.element.querySelectorAll('.tree-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ds = (e.currentTarget as HTMLElement).dataset;
        if (ds.locktype) {
          this.toggleLock(ds.locktype, ds.lockid || undefined, ds.locksceneid || undefined);
        }
      });
    });

    // Layer action buttons in Tree View
    this.element.querySelectorAll('.btn-tree-layer-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ds = (e.currentTarget as HTMLElement).dataset;
        if (ds.sceneid && ds.id) this.moveLayerUp(ds.sceneid, ds.id);
      });
    });

    this.element.querySelectorAll('.btn-tree-layer-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ds = (e.currentTarget as HTMLElement).dataset;
        if (ds.sceneid && ds.id) this.moveLayerDown(ds.sceneid, ds.id);
      });
    });

    this.element.querySelectorAll('.btn-tree-layer-dup').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ds = (e.currentTarget as HTMLElement).dataset;
        if (ds.sceneid && ds.id) this.duplicateLayer(ds.sceneid, ds.id);
      });
    });

    // Layer HTML5 Drag and Drop Reordering
    this.element.querySelectorAll('.layer-tree-node').forEach(node => {
      node.addEventListener('dragstart', (e) => {
        const ds = (e.currentTarget as HTMLElement).dataset;
        const dragData = JSON.stringify({ type: 'layer', sceneId: ds.sceneid, idx: parseInt(ds.idx!) });
        (e as DragEvent).dataTransfer?.setData('application/json', dragData);
      });

      node.addEventListener('dragover', (e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.add('drag-over');
      });

      node.addEventListener('dragleave', (e) => {
        (e.currentTarget as HTMLElement).classList.remove('drag-over');
      });

      node.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetEl = e.currentTarget as HTMLElement;
        targetEl.classList.remove('drag-over');
        const raw = (e as DragEvent).dataTransfer?.getData('application/json');
        if (raw) {
          try {
            const dragData = JSON.parse(raw);
            const toIdx = parseInt(targetEl.dataset.idx!);
            if (dragData.type === 'layer' && dragData.sceneId === targetEl.dataset.sceneid) {
              this.reorderLayer(dragData.sceneId, dragData.idx, toIdx);
            }
          } catch (err) {}
        }
      });
    });
  }
}
