import { ProjectData, SceneData } from '../../engine/types';
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

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'editor-tree-sidebar';
    this.render();

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
      <div class="tree-header">
        <span>📖 Hierarchy</span>
        <button class="btn" id="btn-collapse-all" style="font-size:0.65rem; padding:2px 6px;">Collapse</button>
      </div>
      <div class="tree-content" id="tree-root-container"></div>
    `;

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
        this.collapsedNodes.add(`objects_folder_${sc.id}`);
      });
      this.renderContent();
    });
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
            <span>📖 ${ch.title}</span>
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
                    <span>🎬 ${sc.name}</span>
                  </div>

                  ${!isScCollapsed ? `
                    <div class="tree-children">
                      <!-- WalkPath Polygon Node -->
                      <div class="tree-item tree-node ${this.selectedNodeId === wpKey ? 'selected' : ''}" data-nodeid="${wpKey}" data-type="walkpath" data-sceneid="${sc.id}">
                        <span>🚶 WalkPath Polygon</span>
                      </div>

                      <!-- Objects Folder -->
                      ${this.renderObjectsFolder(sc)}
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

  private renderObjectsFolder(scene: SceneData): string {
    const folderKey = `objects_folder_${scene.id}`;
    const isCollapsed = this.collapsedNodes.has(folderKey);
    const totalObjects = scene.layers.length + scene.hotspots.length;

    let html = `
      <div class="tree-group tree-node">
        <div class="tree-item ${this.selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="objects_folder">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span>📂 Objects (${totalObjects})</span>
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            <!-- Layers -->
            ${scene.layers.map(l => {
              const lKey = `layer_${l.id}`;
              return `
                <div class="tree-item tree-node ${this.selectedNodeId === lKey ? 'selected' : ''}" data-nodeid="${lKey}" data-type="layer" data-id="${l.id}" data-sceneid="${scene.id}">
                  <span>🖼️ ${l.name}</span>
                </div>
              `;
            }).join('')}

            <!-- Hotspots / Objects -->
            ${scene.hotspots.map(hs => {
              const hsKey = `hotspot_${hs.id}`;
              return `
                <div class="tree-item tree-node ${this.selectedNodeId === hsKey ? 'selected' : ''}" data-nodeid="${hsKey}" data-type="hotspot" data-id="${hs.id}" data-sceneid="${scene.id}">
                  <span>🎯 ${hs.name}</span>
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
    this.project.scenes.forEach(sc => {
      sc.characters.forEach(c => {
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
          <span>📂 Characters (${allChars.length})</span>
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${allChars.map(c => {
              const cKey = `character_${c.id}`;
              return `
                <div class="tree-item tree-node ${this.selectedNodeId === cKey ? 'selected' : ''}" data-nodeid="${cKey}" data-type="character" data-id="${c.id}" data-sceneid="${c.sceneId}">
                  <span>👤 ${c.name}</span>
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
          if (sceneId) EventBus.getInstance().emit('editor:select_scene', sceneId);
          EventBus.getInstance().emit('editor:select_character', id);
          EventBus.getInstance().emit('editor:select_target', { type: 'character', sceneId, id });
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
  }
}
