import { SpineDocument, StudioTab, VectorOutlineElement, SpineBoneData } from './types';
import { RigStudioBridge } from './RigStudioBridge';
import { VectorElementSlicer, SlicerToolMode } from './slicer/VectorElementSlicer';
import { PersistentPreviewPlayer } from './preview/PersistentPreviewPlayer';
import { PoseRigManager } from './rigging/PoseRigManager';
import { BoneCanvasEditor } from './rigging/BoneCanvasEditor';
import { KeyframeTimeline } from './timeline/KeyframeTimeline';
import { InteractiveSandbox } from './preview/InteractiveSandbox';

export class RigStudioApp {
  private container: HTMLElement;
  private bridge: RigStudioBridge;

  private currentTab: StudioTab = 'slicer';
  private characterName = 'Character';
  private textureUrl = '';
  private loadedImage: HTMLImageElement | null = null;

  private spineDoc: SpineDocument;
  private poseManager: PoseRigManager;

  // Components
  private slicer: VectorElementSlicer | null = null;
  private boneEditor: BoneCanvasEditor | null = null;
  private timeline: KeyframeTimeline | null = null;
  private sandbox: InteractiveSandbox | null = null;
  private previewPlayer: PersistentPreviewPlayer | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.bridge = new RigStudioBridge();

    this.spineDoc = this.createDefaultSpineDocument();
    this.poseManager = new PoseRigManager(this.spineDoc);

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
        { name: 'front', attachments: {} },
        { name: 'side', attachments: {} },
        { name: 'back', attachments: {} }
      ],
      animations: {
        idle: {
          bones: {
            torso: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: 3 }, { time: 1.6, angle: 0 }] },
            head: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: -2 }, { time: 1.6, angle: 0 }] },
            arm_l: { rotate: [{ time: 0, angle: 25 }, { time: 0.8, angle: 20 }, { time: 1.6, angle: 25 }] },
            arm_r: { rotate: [{ time: 0, angle: -25 }, { time: 0.8, angle: -20 }, { time: 1.6, angle: -25 }] }
          }
        },
        walk: {
          bones: {
            leg_l: { rotate: [{ time: 0, angle: -25 }, { time: 0.4, angle: 25 }, { time: 0.8, angle: -25 }] },
            leg_r: { rotate: [{ time: 0, angle: 25 }, { time: 0.4, angle: -25 }, { time: 0.8, angle: 25 }] },
            arm_l: { rotate: [{ time: 0, angle: 35 }, { time: 0.4, angle: -20 }, { time: 0.8, angle: 35 }] },
            arm_r: { rotate: [{ time: 0, angle: -20 }, { time: 0.4, angle: 35 }, { time: 0.8, angle: -20 }] }
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
        this.poseManager.setDocument(this.spineDoc);
      }
      if (data.textureUrl) {
        this.textureUrl = data.textureUrl;
        this.slicer?.loadTexture(data.textureUrl);
      }
      this.updateHeaderTitle();
      this.syncElementsFromSpine();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
      this.sandbox?.setDocument(this.spineDoc);
    });

    this.bridge.onSaveRequested(() => {
      this.saveSpine();
    });

    this.bridge.notifyReady();

    if (!this.bridge.isEmbeddedMode) {
      const demoUrl = '/demo/sprites/hero.png';
      this.slicer?.loadTexture(demoUrl).catch(() => {});
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
            <span>🎬</span> 3. Animator & Timeline
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
        <section class="studio-workspace" id="center-workspace">
          <!-- Dynamically populated per tab -->
        </section>

        <!-- Right Persistent Sidebar -->
        <aside class="studio-sidebar" id="right-sidebar">
          <!-- Dynamically populated per tab -->
        </aside>
      </main>

      <!-- Bottom Timeline Panel (Rendered when in timeline mode) -->
      <footer id="bottom-timeline-container" style="display:none; height:180px; border-top:1px solid var(--studio-border); background:#090d16;"></footer>
    `;

    this.bindGlobalDOMEvents();
    this.switchTab('slicer');
  }

  public switchTab(tab: StudioTab): void {
    this.currentTab = tab;

    // Update active tab buttons
    this.container.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    const workspace = this.container.querySelector('#center-workspace') as HTMLElement;
    const sidebar = this.container.querySelector('#right-sidebar') as HTMLElement;
    const bottomTimeline = this.container.querySelector('#bottom-timeline-container') as HTMLElement;

    bottomTimeline.style.display = tab === 'timeline' ? 'block' : 'none';

    if (tab === 'slicer') {
      this.mountSlicerTab(workspace, sidebar);
    } else if (tab === 'rigging') {
      this.mountRiggingTab(workspace, sidebar);
    } else if (tab === 'timeline') {
      this.mountTimelineTab(workspace, sidebar, bottomTimeline);
    } else if (tab === 'sandbox') {
      this.mountSandboxTab(workspace, sidebar);
    }
  }

  private mountSlicerTab(workspace: HTMLElement, sidebar: HTMLElement): void {
    workspace.innerHTML = `
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

      <div class="canvas-viewport-container" id="slicer-viewport"></div>

      <div class="viewport-hud">
        <span>Elements: <b id="hud-elem-count">0</b></span>
        <span>Selected: <b id="hud-selected-elem">None</b></span>
        <span>Tool: <b id="hud-active-tool">Polygon</b></span>
      </div>
    `;

    const viewport = workspace.querySelector('#slicer-viewport') as HTMLElement;
    this.slicer = new VectorElementSlicer(viewport, {
      onElementsChange: (elements) => {
        this.syncElementsToSpine(elements);
        this.renderSlicerSidebarElements();
        this.updateSlicerHUD();
        this.boneEditor?.setElements(elements);
      },
      onSelectElement: (elem) => {
        this.updateSlicerHUD();
        this.highlightElementInSidebar(elem?.id || null);
      },
      onTextureLoaded: (img) => {
        this.loadedImage = img;
        this.boneEditor?.setSourceImage(img);
        this.updateSlicerHUD();
      }
    });

    if (this.textureUrl) {
      this.slicer.loadTexture(this.textureUrl);
    }
    this.slicer.setElements(this.spineDoc.skeleton.questforge?.elements || []);

    this.mountPersistentPreview(sidebar);
    this.renderSlicerSidebarHTML(sidebar);
    this.bindSlicerToolEvents();
  }

  private mountRiggingTab(workspace: HTMLElement, sidebar: HTMLElement): void {
    workspace.innerHTML = `
      <div class="workspace-toolbar">
        <div class="tool-group">
          <span style="font-size:0.72rem; color:var(--studio-text-muted); font-weight:700;">ACTIVE POSE:</span>
          <select class="studio-select select-active-pose" style="font-size:0.75rem; padding:3px 8px;">
            ${this.poseManager.getPoseList().map(p => `<option value="${p}" ${p === this.poseManager.getActivePose() ? 'selected' : ''}>${p.toUpperCase()}</option>`).join('')}
          </select>
          <button class="tool-btn btn-add-pose" title="Create New Pose Layout">＋ Pose</button>
          <div class="tool-separator"></div>
          <button class="tool-btn btn-add-bone">🦴 Add Bone</button>
          <button class="tool-btn btn-del-bone" style="color:#ef4444;">✕ Delete Bone</button>
        </div>

        <div class="tool-group">
          <button class="tool-btn btn-reset-bone-view">Reset View</button>
        </div>
      </div>

      <div class="canvas-viewport-container" id="bone-viewport"></div>

      <div class="viewport-hud">
        <span>Pose: <b id="hud-bone-pose">${this.poseManager.getActivePose().toUpperCase()}</b></span>
        <span>Bones: <b>${this.poseManager.getBones().length}</b></span>
        <span>Selected Bone: <b id="hud-selected-bone">None</b></span>
      </div>
    `;

    const viewport = workspace.querySelector('#bone-viewport') as HTMLElement;
    this.boneEditor = new BoneCanvasEditor(viewport, this.poseManager, {
      onBoneSelected: (bone) => {
        const hud = workspace.querySelector('#hud-selected-bone');
        if (hud) hud.textContent = bone ? bone.name : 'None';
        this.highlightBoneInSidebar(bone?.name || null);
      },
      onBoneModified: (bone) => {
        this.previewPlayer?.setSpineDocument(this.spineDoc);
        this.timeline?.setDocument(this.spineDoc);
      }
    });

    if (this.loadedImage) {
      this.boneEditor.setSourceImage(this.loadedImage);
    }
    this.boneEditor.setElements(this.spineDoc.skeleton.questforge?.elements || []);

    this.mountPersistentPreview(sidebar);
    this.renderRiggingSidebarHTML(sidebar);
    this.bindRiggingEvents(workspace, sidebar);
  }

  private mountTimelineTab(workspace: HTMLElement, sidebar: HTMLElement, timelineEl: HTMLElement): void {
    // Mount bone posing viewport in center
    this.mountRiggingTab(workspace, sidebar);

    // Mount keyframe timeline sequencer at bottom
    this.timeline = new KeyframeTimeline(timelineEl, this.spineDoc, {
      onTimeChange: (time) => {
        // sync preview
      },
      onAnimationModified: () => {
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      }
    });
  }

  private mountSandboxTab(workspace: HTMLElement, sidebar: HTMLElement): void {
    workspace.innerHTML = `
      <div class="workspace-toolbar">
        <div class="tool-group">
          <span style="font-size:0.75rem; font-weight:700; color:#38bdf8;">🎮 INTERACTIVE TEST ARENA</span>
          <span style="font-size:0.72rem; color:var(--studio-text-muted);">(WASD or Click-to-Walk • 8-Way Poses • Speech Test)</span>
        </div>
        <div class="tool-group">
          <button class="tool-btn btn-trigger-talk">💬 Talk Bubble</button>
          <button class="tool-btn btn-reset-sandbox">🔄 Center Character</button>
        </div>
      </div>
      <div class="canvas-viewport-container" id="sandbox-viewport"></div>
    `;

    const viewport = workspace.querySelector('#sandbox-viewport') as HTMLElement;
    this.sandbox = new InteractiveSandbox(viewport, this.spineDoc);

    sidebar.innerHTML = `
      <div class="sidebar-panel">
        <div class="panel-header">Arena Controls</div>
        <div class="panel-body" style="display:flex; flex-direction:column; gap:8px;">
          <p style="font-size:0.72rem; color:var(--studio-text-muted); line-height:1.4;">
            Walk around using <b>W, A, S, D</b> or the Arrow keys, or click anywhere on the ground.
          </p>
          <button class="btn-studio btn-trigger-talk" style="justify-content:center;">
            💬 Trigger Speech Bubble
          </button>
          <div style="font-size:0.7rem; color:#64748b; margin-top:8px;">
            Directional poses automatically switch between <b>Front</b>, <b>Side (mirrored)</b>, and <b>Back</b>.
          </div>
        </div>
      </div>
    `;

    const talkBtn = workspace.querySelector('.btn-trigger-talk');
    talkBtn?.addEventListener('click', () => this.sandbox?.triggerTalk());
    sidebar.querySelector('.btn-trigger-talk')?.addEventListener('click', () => this.sandbox?.triggerTalk());
  }

  private mountPersistentPreview(sidebar: HTMLElement): void {
    const existing = sidebar.querySelector('#persistent-preview-box');
    if (existing) return;

    const previewPanel = document.createElement('div');
    previewPanel.className = 'sidebar-panel';
    previewPanel.innerHTML = `
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
              ${this.poseManager.getPoseList().map(p => `<option value="${p}">${p.toUpperCase()}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <span class="form-label">Animation</span>
            <select class="studio-select select-preview-anim" style="flex:1;">
              ${Object.keys(this.spineDoc.animations || {}).map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <span class="form-label">Speed</span>
            <input type="range" class="input-preview-speed" min="0.2" max="2.5" step="0.1" value="1.0" style="flex:1;" />
            <span class="speed-val" style="font-family:var(--studio-font-mono); font-size:0.7rem; color:#38bdf8;">1.0x</span>
          </div>
        </div>
      </div>
    `;
    sidebar.prepend(previewPanel);

    const box = previewPanel.querySelector('#persistent-preview-box') as HTMLElement;
    this.previewPlayer = new PersistentPreviewPlayer(box);
    this.previewPlayer.setSpineDocument(this.spineDoc);

    const speedSlider = previewPanel.querySelector('.input-preview-speed') as HTMLInputElement;
    const speedVal = previewPanel.querySelector('.speed-val') as HTMLElement;
    speedSlider?.addEventListener('input', () => {
      const spd = parseFloat(speedSlider.value);
      speedVal.textContent = `${spd.toFixed(1)}x`;
      this.previewPlayer?.setSpeed(spd);
    });

    const animSelect = previewPanel.querySelector('.select-preview-anim') as HTMLSelectElement;
    animSelect?.addEventListener('change', () => {
      this.previewPlayer?.setAnimation(animSelect.value);
    });
  }

  private renderSlicerSidebarHTML(sidebar: HTMLElement): void {
    let elementsPanel = sidebar.querySelector('#slicer-elements-panel') as HTMLElement;
    if (!elementsPanel) {
      elementsPanel = document.createElement('div');
      elementsPanel.id = 'slicer-elements-panel';
      elementsPanel.className = 'sidebar-panel';
      elementsPanel.style.flex = '1';
      elementsPanel.style.display = 'flex';
      elementsPanel.style.flexDirection = 'column';
      elementsPanel.innerHTML = `
        <div class="panel-header">
          <span>Sliced Elements (<span id="sidebar-elem-count">0</span>)</span>
        </div>
        <div class="panel-body" style="flex:1; overflow-y:auto;">
          <div class="element-list" id="sidebar-element-list"></div>
        </div>
      `;
      sidebar.appendChild(elementsPanel);
    }
    this.renderSlicerSidebarElements();
  }

  private renderSlicerSidebarElements(): void {
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

    listEl.querySelectorAll('.element-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('btn-delete-elem')) return;
        const id = item.getAttribute('data-elem-id');
        this.slicer?.selectElement(id);
      });
    });

    listEl.querySelectorAll('.btn-delete-elem').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-elem-id');
        const remaining = this.slicer?.getElements().filter(el => el.id !== id) || [];
        this.slicer?.setElements(remaining);
      });
    });
  }

  private renderRiggingSidebarHTML(sidebar: HTMLElement): void {
    // Remove slicer elements panel if present
    sidebar.querySelector('#slicer-elements-panel')?.remove();

    let riggingPanel = sidebar.querySelector('#rigging-panel') as HTMLElement;
    if (!riggingPanel) {
      riggingPanel = document.createElement('div');
      riggingPanel.id = 'rigging-panel';
      riggingPanel.className = 'sidebar-panel';
      riggingPanel.style.flex = '1';
      riggingPanel.style.display = 'flex';
      riggingPanel.style.flexDirection = 'column';
      sidebar.appendChild(riggingPanel);
    }

    const bones = this.poseManager.getBones();
    const slots = this.poseManager.getSlots();
    const elements = this.spineDoc.skeleton.questforge?.elements || [];

    riggingPanel.innerHTML = `
      <div class="panel-header">
        <span>Bones & Slot Bindings (${this.poseManager.getActivePose().toUpperCase()})</span>
      </div>
      <div class="panel-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${slots.map((slot, sIdx) => {
            const currentAttach = this.poseManager.getSlotAttachment(slot.name);
            return `
              <div class="slot-binding-row" data-slot="${slot.name}" style="background:#1e293b; padding:6px 8px; border-radius:6px; border:1px solid var(--studio-border); display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:700; font-size:0.75rem; color:#38bdf8;">🦴 ${slot.bone}</span>
                  <div style="display:flex; gap:3px;">
                    <button class="btn-studio btn-slot-up" data-sidx="${sIdx}" style="padding:1px 4px; font-size:0.65rem;" title="Move Layer Up">▲</button>
                    <button class="btn-studio btn-slot-down" data-sidx="${sIdx}" style="padding:1px 4px; font-size:0.65rem;" title="Move Layer Down">▼</button>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="font-size:0.7rem; color:var(--studio-text-muted);">Element:</span>
                  <select class="studio-select select-slot-element" data-slot="${slot.name}" style="flex:1; font-size:0.72rem; padding:2px 4px;">
                    <option value="">(None)</option>
                    ${elements.map(el => `<option value="${el.name}" ${currentAttach?.name === el.name ? 'selected' : ''}>${el.name}</option>`).join('')}
                  </select>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind element dropdown change
    riggingPanel.querySelectorAll('.select-slot-element').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const slotName = (sel as HTMLElement).getAttribute('data-slot')!;
        const elemName = (sel as HTMLSelectElement).value;
        const elem = elements.find(el => el.name === elemName);
        if (elem) {
          this.poseManager.bindElementToSlot(slotName, elem);
        } else {
          this.poseManager.unbindSlotAttachment(slotName);
        }
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    // Bind slot up / down
    riggingPanel.querySelectorAll('.btn-slot-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const sidx = parseInt(btn.getAttribute('data-sidx')!, 10);
        if (sidx > 0) {
          this.poseManager.moveSlotDrawOrder(sidx, sidx - 1);
          this.renderRiggingSidebarHTML(sidebar);
          this.boneEditor?.render();
        }
      });
    });
    riggingPanel.querySelectorAll('.btn-slot-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const sidx = parseInt(btn.getAttribute('data-sidx')!, 10);
        if (sidx < slots.length - 1) {
          this.poseManager.moveSlotDrawOrder(sidx, sidx + 1);
          this.renderRiggingSidebarHTML(sidebar);
          this.boneEditor?.render();
        }
      });
    });
  }

  private bindRiggingEvents(workspace: HTMLElement, sidebar: HTMLElement): void {
    const poseSelect = workspace.querySelector('.select-active-pose') as HTMLSelectElement;
    poseSelect?.addEventListener('change', () => {
      this.poseManager.setActivePose(poseSelect.value);
      this.renderRiggingSidebarHTML(sidebar);
      this.boneEditor?.render();
      const hud = workspace.querySelector('#hud-bone-pose');
      if (hud) hud.textContent = poseSelect.value.toUpperCase();
    });

    workspace.querySelector('.btn-add-bone')?.addEventListener('click', () => {
      const selected = this.boneEditor?.getSelectedBone();
      const parentName = selected ? selected.name : 'root';
      const name = prompt('Enter new bone name:', 'bone_' + (this.poseManager.getBones().length + 1));
      if (name) {
        this.poseManager.addBone(name, parentName);
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();
      }
    });

    workspace.querySelector('.btn-del-bone')?.addEventListener('click', () => {
      const selected = this.boneEditor?.getSelectedBone();
      if (!selected || selected.name === 'root') {
        alert('Cannot delete root bone or no bone selected.');
        return;
      }
      if (confirm(`Delete bone '${selected.name}'?`)) {
        this.poseManager.removeBone(selected.name);
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();
      }
    });

    workspace.querySelector('.btn-reset-bone-view')?.addEventListener('click', () => {
      this.boneEditor?.resetView();
    });
  }

  private bindSlicerToolEvents(): void {
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

    this.container.querySelector('.btn-zoom-in')?.addEventListener('click', () => {
      if (!this.slicer) return;
      this.slicer.setZoom(this.slicer.getZoom() * 1.25);
      this.updateSlicerZoomHUD();
    });
    this.container.querySelector('.btn-zoom-out')?.addEventListener('click', () => {
      if (!this.slicer) return;
      this.slicer.setZoom(this.slicer.getZoom() * 0.8);
      this.updateSlicerZoomHUD();
    });
    this.container.querySelector('.btn-zoom-reset')?.addEventListener('click', () => {
      this.slicer?.resetView();
      this.updateSlicerZoomHUD();
    });
  }

  private bindGlobalDOMEvents(): void {
    // Mode Tabs
    this.container.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as StudioTab;
        this.switchTab(tab);
      });
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
        this.poseManager.setDocument(json);
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
  }

  private updateSlicerZoomHUD(): void {
    if (!this.slicer) return;
    const label = this.container.querySelector('.hud-zoom-label');
    if (label) label.textContent = `${Math.round(this.slicer.getZoom() * 100)}%`;
  }

  private updateSlicerHUD(): void {
    const elems = this.slicer?.getElements() || [];
    const countEl = this.container.querySelector('#hud-elem-count');
    const sidebarCount = this.container.querySelector('#sidebar-elem-count');
    const selectedEl = this.container.querySelector('#hud-selected-elem');

    if (countEl) countEl.textContent = `${elems.length}`;
    if (sidebarCount) sidebarCount.textContent = `${elems.length}`;

    const sel = this.slicer?.getSelectedElement();
    if (selectedEl) selectedEl.textContent = sel ? sel.name : 'None';
  }

  private highlightElementInSidebar(id: string | null): void {
    this.container.querySelectorAll('.element-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-elem-id') === id);
    });
  }

  private highlightBoneInSidebar(name: string | null): void {
    this.container.querySelectorAll('.slot-binding-row').forEach(row => {
      const isMatch = row.getAttribute('data-slot') === name;
      (row as HTMLElement).style.borderColor = isMatch ? 'var(--studio-accent)' : 'var(--studio-border)';
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
    this.boneEditor?.setElements(elements);
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
