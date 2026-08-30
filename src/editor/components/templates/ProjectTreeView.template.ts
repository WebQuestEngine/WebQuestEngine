import { ProjectData, SceneData, CharacterData } from '../../../engine/types';
import { TemplateUtils } from '../../utils/TemplateUtils';
import layoutHtml from './ProjectTreeView.html?raw';

export class ProjectTreeViewTemplate {
  public static renderLayout(): string {
    return layoutHtml;
  }

  public static renderLockBtn(locked: boolean, type: string, id?: string, sceneId?: string): string {
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

  public static renderTreeContent(params: {
    project: ProjectData;
    selectedNodeId: string | null;
    collapsedNodes: Set<string>;
    isNodeLocked: (type: string, id?: string, sceneId?: string) => boolean;
  }): string {
    const { project, selectedNodeId, collapsedNodes, isNodeLocked } = params;

    return TemplateUtils.renderList(project.chapters, (ch) => {
      const chKey = `chapter_${ch.id}`;
      const isChCollapsed = collapsedNodes.has(chKey);

      return `
        <div class="tree-group">
          <div class="tree-item ${selectedNodeId === chKey ? 'selected' : ''}" data-nodeid="${chKey}" data-type="chapter" data-id="${ch.id}">
            <span class="tree-toggler" data-key="${chKey}">${isChCollapsed ? '▶' : '▼'}</span>
            <span style="flex:1;">📖 ${TemplateUtils.escapeHtml(ch.title)}</span>
            ${this.renderLockBtn(isNodeLocked('chapter', ch.id), 'chapter', ch.id)}
          </div>

          ${!isChCollapsed ? `
            <div class="tree-children">
              <!-- SCENES FOLDER -->
              ${this.renderScenesFolder({ project, chapterId: ch.id, selectedNodeId, collapsedNodes, isNodeLocked })}

              <!-- CHARACTERS FOLDER -->
              ${this.renderCharactersFolder({ project, chapterId: ch.id, selectedNodeId, collapsedNodes, isNodeLocked })}

              <!-- ITEMS FOLDER -->
              ${this.renderItemsFolder({ project, chapterId: ch.id, selectedNodeId, collapsedNodes })}
            </div>
          ` : ''}
        </div>
      `;
    });
  }

  public static renderScenesFolder(params: {
    project: ProjectData;
    chapterId: string;
    selectedNodeId: string | null;
    collapsedNodes: Set<string>;
    isNodeLocked: (type: string, id?: string, sceneId?: string) => boolean;
  }): string {
    const { project, chapterId, selectedNodeId, collapsedNodes, isNodeLocked } = params;
    const folderKey = `scenes_folder_${chapterId}`;
    const isCollapsed = collapsedNodes.has(folderKey);

    return `
      <div class="tree-group tree-node">
        <div class="tree-item ${selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="scenes_folder">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span>📂 Scenes (${project.scenes.length})</span>
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${TemplateUtils.renderList(project.scenes, (sc) => {
              const scKey = `scene_${sc.id}`;
              const wpKey = `walkpath_${sc.id}`;
              const isScCollapsed = collapsedNodes.has(scKey);
              return `
                <div class="tree-group tree-node">
                  <div class="tree-item ${selectedNodeId === scKey ? 'selected' : ''}" data-nodeid="${scKey}" data-type="scene" data-id="${sc.id}">
                    <span class="tree-toggler" data-key="${scKey}">${isScCollapsed ? '▶' : '▼'}</span>
                    <span style="flex:1;">🎬 ${TemplateUtils.escapeHtml(sc.name)}</span>
                    ${this.renderLockBtn(isNodeLocked('scene', sc.id), 'scene', sc.id)}
                  </div>

                  ${!isScCollapsed ? `
                    <div class="tree-children">
                      <!-- 1. Layers Folder (Parallax Layers) -->
                      ${this.renderBackgroundFolder({ scene: sc, selectedNodeId, collapsedNodes, isNodeLocked })}

                      <!-- 2. Objects Folder (Interactive Hotspots) -->
                      ${this.renderObjectsFolder({ scene: sc, selectedNodeId, collapsedNodes, isNodeLocked })}

                      <!-- 3. WalkPath Polygon Node -->
                      <div class="tree-item tree-node ${selectedNodeId === wpKey ? 'selected' : ''}" data-nodeid="${wpKey}" data-type="walkpath" data-sceneid="${sc.id}">
                        <span style="flex:1;">🚶 WalkPath Polygon</span>
                        ${this.renderLockBtn(isNodeLocked('walkpath', undefined, sc.id), 'walkpath', undefined, sc.id)}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }

  public static renderBackgroundFolder(params: {
    scene: SceneData;
    selectedNodeId: string | null;
    collapsedNodes: Set<string>;
    isNodeLocked: (type: string, id?: string, sceneId?: string) => boolean;
  }): string {
    const { scene, selectedNodeId, collapsedNodes, isNodeLocked } = params;
    const folderKey = `background_folder_${scene.id}`;
    const isCollapsed = collapsedNodes.has(folderKey);

    return `
      <div class="tree-group tree-node">
        <div class="tree-item ${selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="background_folder" data-sceneid="${scene.id}">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span style="flex:1;">📂 Layers (${scene.layers.length})</span>
          ${this.renderLockBtn(isNodeLocked('background_folder', undefined, scene.id), 'background_folder', undefined, scene.id)}
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${TemplateUtils.renderList(scene.layers, (l, lIdx) => {
              const lKey = `layer_${l.id}`;
              return `
                <div class="tree-item tree-node layer-tree-node ${selectedNodeId === lKey ? 'selected' : ''}"
                     draggable="true"
                     data-nodeid="${lKey}"
                     data-type="layer"
                     data-id="${l.id}"
                     data-sceneid="${scene.id}"
                     data-idx="${lIdx}">
                  <span style="flex:1;">🖼️ ${TemplateUtils.escapeHtml(l.name)}</span>
                  ${this.renderLockBtn(isNodeLocked('layer', l.id, scene.id), 'layer', l.id, scene.id)}
                  <span class="tree-layer-actions">
                    <button class="tree-action-btn btn-tree-layer-up" data-sceneid="${scene.id}" data-id="${l.id}" title="Move Backwards">⬆️</button>
                    <button class="tree-action-btn btn-tree-layer-down" data-sceneid="${scene.id}" data-id="${l.id}" title="Move Forwards">⬇️</button>
                    <button class="tree-action-btn btn-tree-layer-dup" data-sceneid="${scene.id}" data-id="${l.id}" title="Duplicate Layer">📋</button>
                  </span>
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }

  public static renderObjectsFolder(params: {
    scene: SceneData;
    selectedNodeId: string | null;
    collapsedNodes: Set<string>;
    isNodeLocked: (type: string, id?: string, sceneId?: string) => boolean;
  }): string {
    const { scene, selectedNodeId, collapsedNodes, isNodeLocked } = params;
    const folderKey = `objects_folder_${scene.id}`;
    const isCollapsed = collapsedNodes.has(folderKey);

    return `
      <div class="tree-group tree-node">
        <div class="tree-item ${selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="objects_folder" data-sceneid="${scene.id}">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span style="flex:1;">📂 Objects (${scene.hotspots.length})</span>
          ${this.renderLockBtn(isNodeLocked('objects_folder', undefined, scene.id), 'objects_folder', undefined, scene.id)}
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${TemplateUtils.renderList(scene.hotspots, (hs) => {
              const hsKey = `hotspot_${hs.id}`;
              return `
                <div class="tree-item tree-node ${selectedNodeId === hsKey ? 'selected' : ''}" data-nodeid="${hsKey}" data-type="hotspot" data-id="${hs.id}" data-sceneid="${scene.id}">
                  <span style="flex:1;">🎯 ${TemplateUtils.escapeHtml(hs.name)}</span>
                  ${this.renderLockBtn(isNodeLocked('hotspot', hs.id, scene.id), 'hotspot', hs.id, scene.id)}
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }

  public static renderCharactersFolder(params: {
    project: ProjectData;
    chapterId: string;
    selectedNodeId: string | null;
    collapsedNodes: Set<string>;
    isNodeLocked: (type: string, id?: string, sceneId?: string) => boolean;
  }): string {
    const { project, chapterId, selectedNodeId, collapsedNodes, isNodeLocked } = params;
    const folderKey = `characters_folder_${chapterId}`;
    const isCollapsed = collapsedNodes.has(folderKey);

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

    project.scenes.forEach(sc => {
      sc.characters.forEach((c: CharacterData) => {
        if (!seenCharIds.has(c.id)) {
          seenCharIds.add(c.id);
          allChars.push({ id: c.id, name: c.name, sceneId: sc.id });
        }
      });
    });

    return `
      <div class="tree-group tree-node">
        <div class="tree-item ${selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="characters_folder">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span style="flex:1;">📂 Characters (${allChars.length})</span>
          ${this.renderLockBtn(isNodeLocked('characters_folder', undefined, chapterId), 'characters_folder', undefined, chapterId)}
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${TemplateUtils.renderList(allChars, (c) => {
              const cKey = `character_${c.id}`;
              return `
                <div class="tree-item tree-node ${selectedNodeId === cKey ? 'selected' : ''}" data-nodeid="${cKey}" data-type="character" data-id="${c.id}" data-sceneid="${c.sceneId}">
                  <span style="flex:1;">👤 ${TemplateUtils.escapeHtml(c.name)}</span>
                  ${this.renderLockBtn(isNodeLocked('character', c.id, c.sceneId), 'character', c.id, c.sceneId)}
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }

  public static renderItemsFolder(params: {
    project: ProjectData;
    chapterId: string;
    selectedNodeId: string | null;
    collapsedNodes: Set<string>;
  }): string {
    const { project, chapterId, selectedNodeId, collapsedNodes } = params;
    const folderKey = `items_folder_${chapterId}`;
    const isCollapsed = collapsedNodes.has(folderKey);

    return `
      <div class="tree-group tree-node">
        <div class="tree-item ${selectedNodeId === folderKey ? 'selected' : ''}" data-nodeid="${folderKey}" data-type="items_folder">
          <span class="tree-toggler" data-key="${folderKey}">${isCollapsed ? '▶' : '▼'}</span>
          <span>📂 Items (${project.items.length})</span>
        </div>

        ${!isCollapsed ? `
          <div class="tree-children">
            ${TemplateUtils.renderList(project.items, (item) => {
              const itemKey = `item_${item.id}`;
              return `
                <div class="tree-item tree-node ${selectedNodeId === itemKey ? 'selected' : ''}" data-nodeid="${itemKey}" data-type="item" data-id="${item.id}">
                  <span>🎒 ${TemplateUtils.escapeHtml(item.name)}</span>
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }

  public static renderContextMenuItems(type: string): string {
    if (type === 'chapter') {
      return `
        <div class="tree-context-menu-item" data-action="add-scene">➕ Add Scene</div>
        <div class="tree-context-menu-divider"></div>
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Chapter</div>
      `;
    }
    if (type === 'scene') {
      return `
        <div class="tree-context-menu-item" data-action="dup-scene">📋 Duplicate Scene</div>
        <div class="tree-context-menu-item" data-action="add-obj">🎯 Add Object</div>
        <div class="tree-context-menu-item" data-action="add-layer">🖼️ Add Layer</div>
        <div class="tree-context-menu-divider"></div>
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Scene</div>
      `;
    }
    if (type === 'background_folder') {
      return `
        <div class="tree-context-menu-item" data-action="add-layer">🖼️ Add Parallax Layer</div>
      `;
    }
    if (type === 'layer') {
      return `
        <div class="tree-context-menu-item" data-action="move-layer-up">⬆️ Move Backwards (Behind)</div>
        <div class="tree-context-menu-item" data-action="move-layer-down">⬇️ Move Forwards (In Front)</div>
        <div class="tree-context-menu-item" data-action="dup-layer">📋 Duplicate Layer</div>
        <div class="tree-context-menu-divider"></div>
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Layer</div>
      `;
    }
    if (type === 'objects_folder') {
      return `
        <div class="tree-context-menu-item" data-action="add-obj">🎯 Add Interactive Object</div>
      `;
    }
    if (type === 'hotspot') {
      return `
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Object</div>
      `;
    }
    if (type === 'characters_folder') {
      return `
        <div class="tree-context-menu-item" data-action="add-char">👤 Add Character (NPC)</div>
      `;
    }
    if (type === 'character') {
      return `
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Character</div>
      `;
    }
    if (type === 'items_folder') {
      return `
        <div class="tree-context-menu-item" data-action="add-item">🎒 Add Quest Item</div>
      `;
    }
    if (type === 'item') {
      return `
        <div class="tree-context-menu-item danger" data-action="del-node">🗑️ Delete Item</div>
      `;
    }
    if (type === 'walkpath') {
      return `
        <div class="tree-context-menu-item" data-action="draw-wp-scratch">✏️ Redraw WalkPath From Scratch</div>
      `;
    }
    return '';
  }
}
