import { SpineDocument, StudioTab, VectorOutlineElement } from './types';
import { RigStudioBridge } from './RigStudioBridge';
import { VectorElementSlicer, SlicerToolMode } from './slicer/VectorElementSlicer';
import { PersistentPreviewPlayer } from './preview/PersistentPreviewPlayer';

export class RigStudioApp {
  private container: HTMLElement;
  private bridge: RigStudioBridge;

  private currentTab: StudioTab = 'slicer';
  private characterName = 'Character';
  private textureUrl = '';

  private spineDoc: SpineDocument;

  // Components
  private slicer: VectorElementSlicer | null = null;
  private previewPlayer: PersistentPreviewPlayer | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.bridge = new RigStudioBridge();

    // Default template Spine Document
    this.spineDoc = this.createDefaultSpineDocument();

    this.renderLayout();
    this.initBridge();
  }

  private createDefaultSpineDocument(): SpineDocument {
    return {
      skeleton: {
        spine: '3.8.99',
        width: 128,
        height: 256,
        questforge: {
          posePreset: '3-way',
          poseDirections: {
            front: ['down'],
            side: ['right', 'left'],
            back: ['up']
          },
          elements: []
        }
      },
      bones: [
        { name: 'root', x: 0, y: 0 },
        { name: 'hip', parent: 'root', x: 0, y: -45, length: 15 },
        { name: 'torso', parent: 'hip', x: 0, y: -20, length: 25 },
        { name: 'head', parent: 'torso', x: 0, y: -30, length: 20 },
        { name: 'arm_l', parent: 'torso', x: -16, y: -25, length: 22, rotation: 25 },
        { name: 'arm_r', parent: 'torso', x: 16, y: -25, length: 22, rotation: -25 },
        { name: 'leg_l', parent: 'hip', x: -10, y: 0, length: 35, rotation: 10 },
        { name: 'leg_r', parent: 'hip', x: 10, y: 0, length: 35, rotation: -10 }
      ],
      slots: [
        { name: 'head', bone: 'head', attachment: 'head' },
        { name: 'torso', bone: 'torso', attachment: 'torso' },
        { name: 'arm_l', bone: 'arm_l', attachment: 'arm_l' },
        { name: 'arm_r', bone: 'arm_r', attachment: 'arm_r' },
        { name: 'leg_l', bone: 'leg_l', attachment: 'leg_l' },
        { name: 'leg_r', bone: 'leg_r', attachment: 'leg_r' }
      ],
      skins: [
        {
          name: 'front',
          attachments: {}
        },
        {
          name: 'side',
          attachments: {}
        },
        {
          name: 'back',
          attachments: {}
        }
      ],
      animations: {
        idle: {
          bones: {
            torso: {
              rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: 3 }, { time: 1.6, angle: 0 }]
            },
            head: {
              rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: -2 }, { time: 1.6, angle: 0 }]
            },
            arm_l: {
              rotate: [{ time: 0, angle: 25 }, { time: 0.8, angle: 20 }, { time: 1.6, angle: 25 }]
            },
            arm_r: {
              rotate: [{ time: 0, angle: -25 }, { time: 0.8, angle: -20 }, { time: 1.6, angle: -25 }]
            }
          }
        },
        walk: {
          bones: {
            leg_l: {
              rotate: [{ time: 0, angle: -25 }, { time: 0.4, angle: 25 }, { time: 0.8, angle: -25 }]
            },
            leg_r: {
              rotate: [{ time: 0, angle: 25 }, { time: 0.4, angle: -25 }, { time: 0.8, angle: 25 }]
            },
            arm_l: {
              rotate: [{ time: 0, angle: 35 }, { time: 0.4, angle: -20 }, { time: 0.8, angle: 35 }]
            },
            arm_r: {
              rotate: [{ time: 0, angle: -20 }, { time: 0.4, angle: 35 }, { time: 0.8, angle: -20 }]
            }
          }
        }
      }
    };
  }

  private initBridge(): void {
    this.bridge.onInit((data) => {
      this.characterName = data.characterName || 'Character';
      if (data.spineData) {
        this.spineDoc = data.spineData;
      }
      if (data.textureUrl) {
        this.textureUrl = data.textureUrl;
        this.slicer?.loadTexture(data.textureUrl);
      }
      this.updateHeaderTitle();
      this.syncElementsFromSpine();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
    });

    this.bridge.onSaveRequested(() => {
      this.saveSpine();
    });

    this.bridge.notifyReady();

    // If standalone and no texture loaded yet, load default demo character if available
    if (!this.bridge.isEmbeddedMode) {
      const demoUrl = '/demo/sprites/hero.png';
      this.slicer?.loadTexture(demoUrl).catch(() => {
        // Fallback placeholder if demo file not found
      });
    }
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <header class="studio-header">
        <div class="studio-logo">
          <span>🦴</span>
          <span class="studio-title">${this.characterName} — Spine 2D Rig Studio</span>
          <span class="studio-logo-badge">${this.bridge.isEmbeddedMode ? 'EMBEDDED' : 'STANDALONE'}</span>
        </div>

        <nav class="studio-tabs">
          <button class="studio-tab-btn active" data-tab="slicer">
            <span>✂️</span> 1. Element Slicer
          </button>
          <button class="studio-tab-btn" data-tab="rigging">
            <span>🦴</span> 2. Rig & Poses
          </button>
          <button class="studio-tab-btn" data-tab="timeline">
            <span>🎬</span> 3. Animator
          </button>
          <button class="studio-tab-btn" data-tab="sandbox">
            <span>🚀</span> 4. Test Arena
          </button>
        </nav>

        <div class="studio-header-actions">
          <label class="btn-studio" style="cursor:pointer;">
            📁 Import Graphics
            <input type="file" id="input-graphic-file" accept="image/*" style="display:none;" />
          </label>
          <label class="btn-studio" style="cursor:pointer;">
            📄 Load Spine (.json)
            <input type="file" id="input-spine-file" accept=".json" style="display:none;" />
          </label>
          <button class="btn-studio btn-export-spine">
            💾 Export Spine JSON
          </button>
          ${this.bridge.isEmbeddedMode ? `
            <button class="btn-studio btn-studio-primary btn-apply-host">
              ✓ Apply to Character
            </button>
            <button class="btn-studio btn-close-modal">✕</button>
          ` : `
            <button class="btn-studio btn-studio-primary btn-save-local">
              💾 Save Rig
            </button>
          `}
        </div>
      </header>

      <main class="studio-main">
        <!-- Center Workspace -->
        <section class="studio-workspace">
          <!-- Slicer Toolbar -->
          <div class="workspace-toolbar slicer-toolbar">
            <div class="tool-group">
              <button class="tool-btn" data-tool="select" title="Select Element or Drag Pivot">
                <span>↖️</span> Select
              </button>
              <button class="tool-btn active" data-tool="polygon" title="Draw Vector Polygon Vertices">
                <span>📐</span> Polygon Tool
              </button>
              <button class="tool-btn" data-tool="magic" title="Magic Alpha Contour Auto-Tracer">
                <span>✨</span> Magic Contour
              </button>
              <button class="tool-btn" data-tool="pivot" title="Move Rotational Pivot Anchor">
                <span>🎯</span> Set Pivot
              </button>
              <div class="tool-separator"></div>
              <button class="tool-btn" data-tool="pan" title="Pan Workspace">
                <span>✋</span> Pan
              </button>
            </div>

            <div class="tool-group">
              <button class="tool-btn btn-zoom-out" title="Zoom Out">🔍−</button>
              <span class="hud-zoom-label" style="font-family:var(--studio-font-mono); font-size:0.75rem; color:#38bdf8;">100%</span>
              <button class="tool-btn btn-zoom-in" title="Zoom In">🔍+</button>
              <button class="tool-btn btn-zoom-reset" title="Fit to View">Fit</button>
            </div>
          </div>

          <!-- Canvas Viewport -->
          <div class="canvas-viewport-container" id="slicer-viewport"></div>

          <!-- Viewport HUD Overlay -->
          <div class="viewport-hud">
            <span>Elements: <b id="hud-elem-count">0</b></span>
            <span>Selected: <b id="hud-selected-elem">None</b></span>
            <span>Tool: <b id="hud-active-tool">Polygon</b></span>
          </div>
        </section>

        <!-- Right Persistent Sidebar -->
        <aside class="studio-sidebar">
          <!-- Persistent Preview Panel -->
          <div class="sidebar-panel">
            <div class="panel-header">
              <span>Live Looping Preview</span>
              <span style="font-size:0.65rem; color:#38bdf8;">PIXI.js v8</span>
            </div>
            <div class="panel-body">
              <div class="preview-box" id="persistent-preview-box"></div>
              <div class="preview-controls">
                <div class="form-row">
                  <span class="form-label">Pose / Skin</span>
                  <select class="studio-select select-preview-pose" style="flex:1;">
                    <option value="front">Front (Down)</option>
                    <option value="side">Side (Right/Left)</option>
                    <option value="back">Back (Up)</option>
                  </select>
                </div>
                <div class="form-row">
                  <span class="form-label">Animation</span>
                  <select class="studio-select select-preview-anim" style="flex:1;">
                    <option value="idle">idle</option>
                    <option value="walk">walk</option>
                  </select>
                </div>
                <div class="form-row">
                  <span class="form-label">Speed</span>
                  <input type="range" class="input-preview-speed" min="0.2" max="2.5" step="0.1" value="1.0" style="flex:1;" />
                  <span class="speed-val" style="font-family:var(--studio-font-mono); font-size:0.7rem; color:#38bdf8;">1.0x</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Elements List Panel -->
          <div class="sidebar-panel" style="flex:1; display:flex; flex-direction:column;">
            <div class="panel-header">
              <span>Sliced Elements (<span id="sidebar-elem-count">0</span>)</span>
            </div>
            <div class="panel-body" style="flex:1; overflow-y:auto;">
              <div class="element-list" id="sidebar-element-list">
                <div style="font-size:0.75rem; color:var(--studio-text-muted); text-align:center; padding:16px 0;">
                  Click 'Magic Contour' or 'Polygon Tool' to slice elements from the graphic.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    `;

    this.initSlicer();
    this.initPreview();
    this.bindDOMEvents();
  }

  private initSlicer(): void {
    const viewport = this.container.querySelector('#slicer-viewport') as HTMLElement;
    if (!viewport) return;

    this.slicer = new VectorElementSlicer(viewport, {
      onElementsChange: (elements) => {
        this.syncElementsToSpine(elements);
        this.renderElementList();
        this.updateHUD();
      },
      onSelectElement: (elem) => {
        this.updateHUD();
        this.highlightElementInSidebar(elem?.id || null);
      },
      onTextureLoaded: () => {
        this.updateHUD();
      }
    });
  }

  private initPreview(): void {
    const previewBox = this.container.querySelector('#persistent-preview-box') as HTMLElement;
    if (!previewBox) return;

    this.previewPlayer = new PersistentPreviewPlayer(previewBox);
    this.previewPlayer.setSpineDocument(this.spineDoc);
  }

  private bindDOMEvents(): void {
    // Mode Tabs
    this.container.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.getAttribute('data-tab') as StudioTab;
      });
    });

    // Slicer Tools
    this.container.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool') as SlicerToolMode;
        this.container.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.slicer?.setToolMode(tool);
        const hudTool = this.container.querySelector('#hud-active-tool');
        if (hudTool) hudTool.textContent = tool.toUpperCase();
      });
    });

    // Zoom Controls
    this.container.querySelector('.btn-zoom-in')?.addEventListener('click', () => {
      if (!this.slicer) return;
      this.slicer.setZoom(this.slicer.getZoom() * 1.25);
      this.updateZoomHUD();
    });
    this.container.querySelector('.btn-zoom-out')?.addEventListener('click', () => {
      if (!this.slicer) return;
      this.slicer.setZoom(this.slicer.getZoom() * 0.8);
      this.updateZoomHUD();
    });
    this.container.querySelector('.btn-zoom-reset')?.addEventListener('click', () => {
      this.slicer?.resetView();
      this.updateZoomHUD();
    });

    // Graphic File Import
    const graphicInput = this.container.querySelector('#input-graphic-file') as HTMLInputElement;
    graphicInput?.addEventListener('change', () => {
      const file = graphicInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      this.textureUrl = url;
      this.slicer?.loadTexture(url);
    });

    // Spine JSON File Import
    const spineInput = this.container.querySelector('#input-spine-file') as HTMLInputElement;
    spineInput?.addEventListener('change', async () => {
      const file = spineInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text) as SpineDocument;
        this.spineDoc = json;
        this.syncElementsFromSpine();
        this.previewPlayer?.setSpineDocument(json);
        alert('Spine JSON loaded successfully!');
      } catch (err: any) {
        alert('Failed to parse Spine JSON: ' + err.message);
      }
    });

    // Export Spine JSON
    this.container.querySelector('.btn-export-spine')?.addEventListener('click', () => {
      this.exportSpineJson();
    });

    // Embedded Actions
    this.container.querySelector('.btn-apply-host')?.addEventListener('click', () => {
      this.saveSpine();
    });
    this.container.querySelector('.btn-close-modal')?.addEventListener('click', () => {
      this.bridge.notifyClose();
    });

    // Preview Controls
    const speedSlider = this.container.querySelector('.input-preview-speed') as HTMLInputElement;
    const speedVal = this.container.querySelector('.speed-val') as HTMLElement;
    speedSlider?.addEventListener('input', () => {
      const spd = parseFloat(speedSlider.value);
      speedVal.textContent = `${spd.toFixed(1)}x`;
      this.previewPlayer?.setSpeed(spd);
    });

    const animSelect = this.container.querySelector('.select-preview-anim') as HTMLSelectElement;
    animSelect?.addEventListener('change', () => {
      this.previewPlayer?.setAnimation(animSelect.value);
    });
  }

  private updateZoomHUD(): void {
    if (!this.slicer) return;
    const label = this.container.querySelector('.hud-zoom-label');
    if (label) label.textContent = `${Math.round(this.slicer.getZoom() * 100)}%`;
  }

  private updateHUD(): void {
    const elems = this.slicer?.getElements() || [];
    const countEl = this.container.querySelector('#hud-elem-count');
    const sidebarCount = this.container.querySelector('#sidebar-elem-count');
    const selectedEl = this.container.querySelector('#hud-selected-elem');

    if (countEl) countEl.textContent = `${elems.length}`;
    if (sidebarCount) sidebarCount.textContent = `${elems.length}`;

    const sel = this.slicer?.getSelectedElement();
    if (selectedEl) selectedEl.textContent = sel ? sel.name : 'None';
  }

  private renderElementList(): void {
    const listEl = this.container.querySelector('#sidebar-element-list');
    if (!listEl || !this.slicer) return;

    const elements = this.slicer.getElements();
    if (elements.length === 0) {
      listEl.innerHTML = `
        <div style="font-size:0.75rem; color:var(--studio-text-muted); text-align:center; padding:16px 0;">
          Click 'Magic Contour' or 'Polygon Tool' to slice elements from the graphic.
        </div>
      `;
      return;
    }

    listEl.innerHTML = elements.map(el => {
      const thumb = this.slicer?.generateThumbnail(el) || '';
      return `
        <div class="element-item" data-elem-id="${el.id}">
          <img src="${thumb}" class="element-thumb" alt="${el.name}" />
          <span class="element-name">${el.name}</span>
          <span class="element-tag">${el.deformationMode.toUpperCase()}</span>
          <button class="btn-studio btn-delete-elem" data-elem-id="${el.id}" style="padding:2px 6px; font-size:0.7rem; color:#ef4444;" title="Delete Element">✕</button>
        </div>
      `;
    }).join('');

    // Bind item click
    listEl.querySelectorAll('.element-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('btn-delete-elem')) return;
        const id = item.getAttribute('data-elem-id');
        this.slicer?.selectElement(id);
      });
    });

    // Bind delete click
    listEl.querySelectorAll('.btn-delete-elem').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-elem-id');
        const remaining = this.slicer?.getElements().filter(el => el.id !== id) || [];
        this.slicer?.setElements(remaining);
      });
    });
  }

  private highlightElementInSidebar(id: string | null): void {
    this.container.querySelectorAll('.element-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-elem-id') === id);
    });
  }

  private syncElementsToSpine(elements: VectorOutlineElement[]): void {
    if (!this.spineDoc.skeleton.questforge) {
      this.spineDoc.skeleton.questforge = {
        posePreset: '3-way',
        poseDirections: { front: ['down'], side: ['right', 'left'], back: ['up'] },
        elements: []
      };
    }
    this.spineDoc.skeleton.questforge.elements = elements;
    this.spineDoc.skeleton.questforge.textureUrl = this.textureUrl;
  }

  private syncElementsFromSpine(): void {
    const elements = this.spineDoc.skeleton.questforge?.elements || [];
    this.slicer?.setElements(elements);
  }

  private updateHeaderTitle(): void {
    const titleEl = this.container.querySelector('.studio-title');
    if (titleEl) {
      titleEl.textContent = `${this.characterName} — Spine 2D Rig Studio`;
    }
  }

  private exportSpineJson(): void {
    const jsonStr = JSON.stringify(this.spineDoc, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.characterName.toLowerCase().replace(/\s+/g, '_')}.spine.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private saveSpine(): void {
    this.bridge.notifySave(this.spineDoc, this.textureUrl);
  }
}
