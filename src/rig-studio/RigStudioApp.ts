import { SpineDocument, StudioTab, VectorOutlineElement, SpineBoneData } from './types';
import { RigStudioBridge } from './RigStudioBridge';
import { VectorElementSlicer, SlicerToolMode } from './slicer/VectorElementSlicer';
import { PersistentPreviewPlayer } from './preview/PersistentPreviewPlayer';
import { PoseRigManager } from './rigging/PoseRigManager';
import { BoneCanvasEditor } from './rigging/BoneCanvasEditor';
import { KeyframeTimeline } from './timeline/KeyframeTimeline';
import { InteractiveSandbox } from './preview/InteractiveSandbox';
import { MiddleDragScroller } from './utils/MiddleDragScroller';

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
  private dragScroller: MiddleDragScroller | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.bridge = new RigStudioBridge();

    this.spineDoc = this.createDefaultSpineDocument();
    this.poseManager = new PoseRigManager(this.spineDoc);

    this.renderLayout();
    this.initBridge();

    // Enable middle mouse button drag scrolling for all scrollable views and lists
    this.dragScroller = new MiddleDragScroller(this.container);
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
        // Pelvis / Hip (waist center)
        { name: 'hip', parent: 'root', x: 0, y: -65, length: 18, rotation: -90 },
        // Spine / Torso (chest)
        { name: 'torso', parent: 'hip', x: 18, y: 0, length: 32, rotation: 0 },
        // Head
        { name: 'head', parent: 'torso', x: 32, y: 0, length: 28, rotation: 0 },

        // Left Arm (upper arm above elbow, lower arm below elbow, hand/palm)
        { name: 'arm_upper_l', parent: 'torso', x: 26, y: -16, length: 24, rotation: 140 },
        { name: 'arm_lower_l', parent: 'arm_upper_l', x: 24, y: 0, length: 22, rotation: 15 },
        { name: 'hand_l', parent: 'arm_lower_l', x: 22, y: 0, length: 14, rotation: 10 },

        // Right Arm (upper arm above elbow, lower arm below elbow, hand/palm)
        { name: 'arm_upper_r', parent: 'torso', x: 26, y: 16, length: 24, rotation: -140 },
        { name: 'arm_lower_r', parent: 'arm_upper_r', x: 24, y: 0, length: 22, rotation: -15 },
        { name: 'hand_r', parent: 'arm_lower_r', x: 22, y: 0, length: 14, rotation: -10 },

        // Left Leg (upper leg above knee, lower leg below knee, foot)
        { name: 'leg_upper_l', parent: 'hip', x: 0, y: -12, length: 36, rotation: 180 },
        { name: 'leg_lower_l', parent: 'leg_upper_l', x: 36, y: 0, length: 34, rotation: 0 },
        { name: 'foot_l', parent: 'leg_lower_l', x: 34, y: 0, length: 16, rotation: 75 },

        // Right Leg (upper leg above knee, lower leg below knee, foot)
        { name: 'leg_upper_r', parent: 'hip', x: 0, y: 12, length: 36, rotation: 180 },
        { name: 'leg_lower_r', parent: 'leg_upper_r', x: 36, y: 0, length: 34, rotation: 0 },
        { name: 'foot_r', parent: 'leg_lower_r', x: 34, y: 0, length: 16, rotation: 75 }
      ],
      slots: [
        { name: 'head', bone: 'head', attachment: 'head' },
        { name: 'torso', bone: 'torso', attachment: 'torso' },
        { name: 'hip', bone: 'hip', attachment: 'hip' },
        { name: 'arm_upper_l', bone: 'arm_upper_l', attachment: 'arm_upper_l' },
        { name: 'arm_lower_l', bone: 'arm_lower_l', attachment: 'arm_lower_l' },
        { name: 'hand_l', bone: 'hand_l', attachment: 'hand_l' },
        { name: 'arm_upper_r', bone: 'arm_upper_r', attachment: 'arm_upper_r' },
        { name: 'arm_lower_r', bone: 'arm_lower_r', attachment: 'arm_lower_r' },
        { name: 'hand_r', bone: 'hand_r', attachment: 'hand_r' },
        { name: 'leg_upper_l', bone: 'leg_upper_l', attachment: 'leg_upper_l' },
        { name: 'leg_lower_l', bone: 'leg_lower_l', attachment: 'leg_lower_l' },
        { name: 'foot_l', bone: 'foot_l', attachment: 'foot_l' },
        { name: 'leg_upper_r', bone: 'leg_upper_r', attachment: 'leg_upper_r' },
        { name: 'leg_lower_r', bone: 'leg_lower_r', attachment: 'leg_lower_r' },
        { name: 'foot_r', bone: 'foot_r', attachment: 'foot_r' }
      ],
      skins: [
        { name: 'front', attachments: {} },
        { name: 'side', attachments: {} },
        { name: 'back', attachments: {} }
      ],
      animations: {
        idle: {
          bones: {
            torso: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: 2 }, { time: 1.6, angle: 0 }] },
            head: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: -1.5 }, { time: 1.6, angle: 0 }] },
            arm_upper_l: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: -4 }, { time: 1.6, angle: 0 }] },
            arm_lower_l: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: -6 }, { time: 1.6, angle: 0 }] },
            arm_upper_r: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: 4 }, { time: 1.6, angle: 0 }] },
            arm_lower_r: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: 6 }, { time: 1.6, angle: 0 }] }
          }
        },
        walk: {
          bones: {
            leg_upper_l: { rotate: [{ time: 0, angle: -24 }, { time: 0.4, angle: 24 }, { time: 0.8, angle: -24 }] },
            leg_lower_l: { rotate: [{ time: 0, angle: 0 }, { time: 0.2, angle: 28 }, { time: 0.4, angle: 0 }, { time: 0.8, angle: 0 }] },
            leg_upper_r: { rotate: [{ time: 0, angle: 24 }, { time: 0.4, angle: -24 }, { time: 0.8, angle: 24 }] },
            leg_lower_r: { rotate: [{ time: 0, angle: 0 }, { time: 0.4, angle: 0 }, { time: 0.6, angle: 28 }, { time: 0.8, angle: 0 }] },
            arm_upper_l: { rotate: [{ time: 0, angle: 25 }, { time: 0.4, angle: -20 }, { time: 0.8, angle: 25 }] },
            arm_lower_l: { rotate: [{ time: 0, angle: 10 }, { time: 0.4, angle: 0 }, { time: 0.8, angle: 10 }] },
            arm_upper_r: { rotate: [{ time: 0, angle: -20 }, { time: 0.4, angle: 25 }, { time: 0.8, angle: -20 }] },
            arm_lower_r: { rotate: [{ time: 0, angle: 0 }, { time: 0.4, angle: 10 }, { time: 0.8, angle: 0 }] }
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
          <button class="tool-btn active" data-tool="select" title="Select Element, Move &amp; Edit Nodes (Del to delete selected node, Alt+Click to delete node)">
            <span>↖️</span> Select / Edit
          </button>
          <button class="tool-btn" data-tool="add_node" title="Add Nodes to Polygon Edges">
            <span>➕</span> Add Node
          </button>
          <button class="tool-btn" data-tool="delete_node" title="Delete Polygon Nodes (Click on node)">
            <span>➖</span> Del Node
          </button>
          <button class="tool-btn" data-tool="split" title="Knife: Drag a line across the element to slice it into two parts">
            <span>✂️</span> Split / Knife
          </button>
          <div class="tool-separator"></div>
          <button class="tool-btn" data-tool="polygon" title="Draw New Polygon from Scratch">
            <span>📐</span> Polygon
          </button>
          <button class="tool-btn" data-tool="magic" title="Magic Alpha Contour Auto-Tracer">
            <span>✨</span> Magic Contour
          </button>
          <button class="tool-btn" data-tool="pivot" title="Move Rotational Pivot Anchor">
            <span>🎯</span> Pivot
          </button>
          <button class="tool-btn" data-tool="pan" title="Pan Workspace">
            <span>✋</span> Pan
          </button>
        </div>

        <div class="tool-group">
          <button class="tool-btn btn-simplify-poly" title="Simplify Contour (Reduce redundant nodes with Douglas-Peucker)">
            <span>📉</span> Simplify
          </button>
          <button class="tool-btn btn-smooth-poly" title="Smooth Contour Corners (Chaikin algorithm)">
            <span>🌀</span> Smooth
          </button>
          <button class="tool-btn btn-subdivide-poly" title="Subdivide Edges (Double node density)">
            <span>➗</span> Subdivide
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
        <span>Nodes: <b id="hud-node-count">0</b></span>
        <span>Selected Node: <b id="hud-selected-node">None</b></span>
        <span>Tool: <b id="hud-active-tool">SELECT</b></span>
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
      onVertexSelected: (idx, pt) => {
        this.updateSlicerHUD();
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
          <div class="tool-separator"></div>
          <button class="tool-btn btn-humanoid-preset" title="Apply Humanoid Skeleton (upper/lower arms, hands, upper/lower legs, feet)">👤 Humanoid Preset</button>
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
        this.poseManager.saveActivePoseBones();
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

    const posePreviewSelect = previewPanel.querySelector('.select-preview-pose') as HTMLSelectElement;
    posePreviewSelect?.addEventListener('change', () => {
      this.previewPlayer?.setPose(posePreviewSelect.value);
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
        <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span>Sliced Elements (<span id="sidebar-elem-count">0</span>)</span>
        </div>
        <div class="contour-tools-bar" style="display:flex; gap:3px; padding:6px 8px; border-bottom:1px solid var(--studio-border); background:#0b1120;">
          <button class="btn-studio btn-simplify-poly" style="flex:1; font-size:0.65rem; padding:3px 2px;" title="Douglas-Peucker reduction">📉 Simplify</button>
          <button class="btn-studio btn-smooth-poly" style="flex:1; font-size:0.65rem; padding:3px 2px;" title="Chaikin smooth corners">🌀 Smooth</button>
          <button class="btn-studio btn-subdivide-poly" style="flex:1; font-size:0.65rem; padding:3px 2px;" title="Subdivide edges with midpoints">➗ Subdivide</button>
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

    listEl.innerHTML = elements.map((el, idx) => {
      const thumb = this.slicer?.generateThumbnail(el) || '';
      return `
        <div class="element-item" data-elem-id="${el.id}" data-idx="${idx}" style="display:flex; align-items:center; gap:6px; padding:4px 6px;">
          <!-- Z-Order indicator badge -->
          <span class="element-z-badge" style="font-size:0.65rem; padding:2px 5px; border-radius:3px; background:#0284c7; color:#fff; font-weight:700; font-family:var(--studio-font-mono); flex-shrink:0;" title="Draw Order (Z-Index: higher is drawn on top)">Z:${idx + 1}</span>

          <!-- Z-Order Controls -->
          <div style="display:flex; flex-direction:column; gap:1px; flex-shrink:0;">
            <button class="btn-studio btn-elem-up" data-idx="${idx}" style="padding:0 3px; font-size:0.6rem; line-height:1; height:12px;" title="Bring Forward (Higher Z)" ${idx === elements.length - 1 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▲</button>
            <button class="btn-studio btn-elem-down" data-idx="${idx}" style="padding:0 3px; font-size:0.6rem; line-height:1; height:12px;" title="Send Backward (Lower Z)" ${idx === 0 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▼</button>
          </div>

          <!-- Thumbnail -->
          <img src="${thumb}" class="element-thumb" alt="${el.name}" style="flex-shrink:0;" />

          <!-- Normal Name Display -->
          <div class="elem-name-display" style="flex:1; display:flex; align-items:center; gap:4px; min-width:0;">
            <span class="element-name" title="Double click to rename" style="flex:1; font-weight:600; font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;">${el.name}</span>
            <button class="btn-studio btn-rename-elem" data-elem-id="${el.id}" style="padding:1px 4px; font-size:0.65rem;" title="Rename Part">✏️</button>
          </div>

          <!-- Inline Rename Form -->
          <div class="elem-rename-form" style="display:none; flex:1; align-items:center; gap:3px;">
            <input type="text" class="studio-input input-elem-name" value="${el.name}" style="flex:1; min-width:50px; font-size:0.72rem; padding:2px 4px;" />
            <button class="btn-studio btn-save-rename" data-elem-id="${el.id}" style="padding:1px 5px; font-size:0.65rem; color:#10b981;" title="Save">✓</button>
            <button class="btn-studio btn-cancel-rename" data-elem-id="${el.id}" style="padding:1px 5px; font-size:0.65rem; color:#ef4444;" title="Cancel">✕</button>
          </div>

          <!-- Node Count Badge -->
          <span style="font-size:0.62rem; color:#94a3b8; font-family:var(--studio-font-mono); background:#1e293b; padding:1px 4px; border-radius:3px; flex-shrink:0;" title="${el.polygon.length} contour vertices">${el.polygon.length} pts</span>

          <!-- Deformation Mode Tag -->
          <span class="element-tag" style="flex-shrink:0;">${el.deformationMode.toUpperCase()}</span>

          <!-- Delete Button -->
          <button class="btn-studio btn-delete-elem" data-elem-id="${el.id}" style="padding:2px 6px; font-size:0.7rem; color:#ef4444; flex-shrink:0;" title="Delete Element">✕</button>
        </div>
      `;
    }).join('');

    // Reorder Z-Order: Bring Forward (▲)
    listEl.querySelectorAll('.btn-elem-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx')!, 10);
        if (idx < elements.length - 1) {
          this.slicer?.moveElement(idx, idx + 1);
          this.syncElementsToSpine(this.slicer?.getElements() || []);
          this.renderSlicerSidebarElements();
          this.boneEditor?.setElements(this.slicer?.getElements() || []);
        }
      });
    });

    // Reorder Z-Order: Send Backward (▼)
    listEl.querySelectorAll('.btn-elem-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx')!, 10);
        if (idx > 0) {
          this.slicer?.moveElement(idx, idx - 1);
          this.syncElementsToSpine(this.slicer?.getElements() || []);
          this.renderSlicerSidebarElements();
          this.boneEditor?.setElements(this.slicer?.getElements() || []);
        }
      });
    });

    // Renaming Part Logic
    const startRename = (item: HTMLElement) => {
      const nameDisplay = item.querySelector('.elem-name-display') as HTMLElement;
      const renameForm = item.querySelector('.elem-rename-form') as HTMLElement;
      const input = item.querySelector('.input-elem-name') as HTMLInputElement;
      if (!nameDisplay || !renameForm || !input) return;

      nameDisplay.style.display = 'none';
      renameForm.style.display = 'flex';
      input.focus();
      input.select();
    };

    const cancelRename = (item: HTMLElement) => {
      const nameDisplay = item.querySelector('.elem-name-display') as HTMLElement;
      const renameForm = item.querySelector('.elem-rename-form') as HTMLElement;
      if (nameDisplay && renameForm) {
        nameDisplay.style.display = 'flex';
        renameForm.style.display = 'none';
      }
    };

    const saveRename = (item: HTMLElement, id: string) => {
      const input = item.querySelector('.input-elem-name') as HTMLInputElement;
      if (!input) return;
      const newName = input.value.trim();
      const elem = this.slicer?.getElements().find(el => el.id === id);
      if (elem && newName && newName !== elem.name) {
        const oldName = elem.name;
        this.slicer?.renameElement(id, newName);

        // Update any slot bindings across all skins
        for (const skin of this.spineDoc.skins || []) {
          for (const [slotKey, attachMap] of Object.entries(skin.attachments || {})) {
            for (const [attachKey, attachData] of Object.entries(attachMap as any)) {
              if (attachData && (attachData as any).name === oldName) {
                (attachData as any).name = newName;
              }
            }
          }
        }

        this.syncElementsToSpine(this.slicer?.getElements() || []);
        this.renderSlicerSidebarElements();
        this.boneEditor?.setElements(this.slicer?.getElements() || []);
        this.updateSlicerHUD();
      } else {
        cancelRename(item);
      }
    };

    listEl.querySelectorAll('.element-item').forEach(item => {
      const id = item.getAttribute('data-elem-id')!;

      // Double-click name to rename
      item.querySelector('.element-name')?.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startRename(item as HTMLElement);
      });

      // ✏️ Rename button
      item.querySelector('.btn-rename-elem')?.addEventListener('click', (e) => {
        e.stopPropagation();
        startRename(item as HTMLElement);
      });

      // Confirm Rename ✓
      item.querySelector('.btn-save-rename')?.addEventListener('click', (e) => {
        e.stopPropagation();
        saveRename(item as HTMLElement, id);
      });

      // Cancel Rename ✕
      item.querySelector('.btn-cancel-rename')?.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelRename(item as HTMLElement);
      });

      // Enter/Escape keyboard handling (and stop propagation of typing events like Backspace, Delete, Space)
      const inputElem = item.querySelector('.input-elem-name') as HTMLInputElement | null;
      inputElem?.addEventListener('keydown', (e: KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          saveRename(item as HTMLElement, id);
        } else if (e.key === 'Escape') {
          cancelRename(item as HTMLElement);
        }
      });
      inputElem?.addEventListener('keyup', (e: KeyboardEvent) => {
        e.stopPropagation();
      });

      // Select element on row click
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) return;
        this.slicer?.selectElement(id);
      });
    });

    // Delete Element
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

    const boundAttachments = slots.map(s => this.poseManager.getSlotAttachment(s.name)).filter(Boolean);
    const currentGlobalScale = boundAttachments.length > 0 && boundAttachments[0]?.scaleX !== undefined
      ? boundAttachments[0].scaleX
      : 0.25;

    riggingPanel.innerHTML = `
      <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Bones & Slot Bindings (${this.poseManager.getActivePose().toUpperCase()})</span>
        <button class="btn-studio btn-auto-align-all" style="font-size:0.68rem; padding:2px 8px; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; font-weight:600;" title="Align all cutouts with bone directions and auto-scale to bone lengths">
          ⚡ Auto-Align & Fit
        </button>
      </div>

      <div style="padding:6px 10px; background:#0f172a; border-bottom:1px solid var(--studio-border); display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.68rem; color:var(--studio-text-muted); font-weight:600;">Global Cutout Scale:</span>
          <span class="label-global-scale" style="font-size:0.7rem; font-family:var(--studio-font-mono); color:#38bdf8; font-weight:700;">${currentGlobalScale.toFixed(2)}x</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <input type="range" class="input-global-cutout-scale" min="0.05" max="1.5" step="0.05" value="${currentGlobalScale}" style="flex:1;" />
          <button class="btn-studio btn-chip-global-scale" data-val="0.25" style="padding:1px 5px; font-size:0.65rem;">0.25</button>
          <button class="btn-studio btn-chip-global-scale" data-val="0.5" style="padding:1px 5px; font-size:0.65rem;">0.5</button>
          <button class="btn-studio btn-chip-global-scale" data-val="1.0" style="padding:1px 5px; font-size:0.65rem;">1.0</button>
        </div>
      </div>

      <div class="panel-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${slots.map((slot, sIdx) => {
            const currentAttach = this.poseManager.getSlotAttachment(slot.name);
            const rot = currentAttach?.rotation || 0;
            const scX = currentAttach?.scaleX ?? 1;
            return `
              <div class="slot-binding-row" data-slot="${slot.name}" style="background:#1e293b; padding:6px 8px; border-radius:6px; border:1px solid var(--studio-border); display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="slot-z-badge" style="font-size:0.65rem; padding:1px 5px; border-radius:3px; background:#0284c7; color:#fff; font-weight:700; font-family:var(--studio-font-mono);" title="Slot Draw Order (Z-Index)">Z:${sIdx + 1}</span>
                    <span style="font-weight:700; font-size:0.75rem; color:#38bdf8;">🦴 ${slot.bone}</span>
                  </div>
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
                ${currentAttach ? `
                  <div class="slot-attach-details" style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; background:#090d16; padding:6px; border-radius:4px; margin-top:2px;">
                    <div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <span style="font-size:0.65rem; color:var(--studio-text-muted);">Angle:</span>
                        <span class="label-slot-rot" style="font-size:0.65rem; font-family:var(--studio-font-mono); color:#38bdf8;">${rot}°</span>
                      </div>
                      <input type="range" class="input-slot-rot" data-slot="${slot.name}" min="-180" max="180" step="5" value="${rot}" style="width:100%;" />
                      <div style="display:flex; gap:2px; margin-top:3px;">
                        <button class="btn-studio btn-slot-rot-chip" data-slot="${slot.name}" data-val="-90" style="padding:1px 3px; font-size:0.6rem; flex:1;">-90°</button>
                        <button class="btn-studio btn-slot-rot-chip" data-slot="${slot.name}" data-val="0" style="padding:1px 3px; font-size:0.6rem; flex:1;">0°</button>
                        <button class="btn-studio btn-slot-rot-chip" data-slot="${slot.name}" data-val="90" style="padding:1px 3px; font-size:0.6rem; flex:1;">+90°</button>
                        <button class="btn-studio btn-slot-rot-auto" data-slot="${slot.name}" style="padding:1px 3px; font-size:0.6rem; flex:1;" title="Auto-align with bone direction">Auto</button>
                      </div>
                    </div>
                    <div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <span style="font-size:0.65rem; color:var(--studio-text-muted);">Scale:</span>
                        <span class="label-slot-scale" style="font-size:0.65rem; font-family:var(--studio-font-mono); color:#38bdf8;">${scX.toFixed(2)}x</span>
                      </div>
                      <input type="range" class="input-slot-scale" data-slot="${slot.name}" min="0.05" max="1.5" step="0.05" value="${scX}" style="width:100%;" />
                      <div style="display:flex; gap:2px; margin-top:3px;">
                        <button class="btn-studio btn-slot-scale-chip" data-slot="${slot.name}" data-val="0.25" style="padding:1px 3px; font-size:0.6rem; flex:1;">0.25</button>
                        <button class="btn-studio btn-slot-scale-chip" data-slot="${slot.name}" data-val="0.5" style="padding:1px 3px; font-size:0.6rem; flex:1;">0.5</button>
                        <button class="btn-studio btn-slot-scale-chip" data-slot="${slot.name}" data-val="1.0" style="padding:1px 3px; font-size:0.6rem; flex:1;">1.0</button>
                      </div>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // 1. Auto-align all button
    riggingPanel.querySelector('.btn-auto-align-all')?.addEventListener('click', () => {
      this.poseManager.autoAlignAllAttachments();
      this.renderRiggingSidebarHTML(sidebar);
      this.boneEditor?.render();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
    });

    // 2. Global scale slider and chips
    const globalScaleSlider = riggingPanel.querySelector('.input-global-cutout-scale') as HTMLInputElement;
    const globalScaleLabel = riggingPanel.querySelector('.label-global-scale') as HTMLElement;
    const applyGlobalScale = (sc: number) => {
      this.poseManager.setGlobalAttachmentScale(sc);
      this.renderRiggingSidebarHTML(sidebar);
      this.boneEditor?.render();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
    };

    globalScaleSlider?.addEventListener('input', () => {
      const val = parseFloat(globalScaleSlider.value);
      if (globalScaleLabel) globalScaleLabel.textContent = `${val.toFixed(2)}x`;
      this.poseManager.setGlobalAttachmentScale(val);
      this.boneEditor?.render();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
    });
    globalScaleSlider?.addEventListener('change', () => {
      this.renderRiggingSidebarHTML(sidebar);
    });

    riggingPanel.querySelectorAll('.btn-chip-global-scale').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.getAttribute('data-val')!);
        applyGlobalScale(val);
      });
    });

    // 3. Per-slot rotation controls
    riggingPanel.querySelectorAll('.input-slot-rot').forEach(input => {
      input.addEventListener('input', (e) => {
        const slotName = (input as HTMLElement).getAttribute('data-slot')!;
        const val = parseInt((input as HTMLInputElement).value, 10);
        const row = input.closest('.slot-binding-row');
        const lbl = row?.querySelector('.label-slot-rot');
        if (lbl) lbl.textContent = `${val}°`;
        this.poseManager.setSlotAttachmentTransform(slotName, { rotation: val });
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    riggingPanel.querySelectorAll('.btn-slot-rot-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotName = btn.getAttribute('data-slot')!;
        const val = parseInt(btn.getAttribute('data-val')!, 10);
        this.poseManager.setSlotAttachmentTransform(slotName, { rotation: val });
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    riggingPanel.querySelectorAll('.btn-slot-rot-auto').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotName = btn.getAttribute('data-slot')!;
        const attach = this.poseManager.getSlotAttachment(slotName);
        const elem = elements.find(el => el.name === attach?.name);
        if (elem) {
          const def = this.poseManager.computeDefaultElementTransform(slotName, elem);
          this.poseManager.setSlotAttachmentTransform(slotName, { rotation: def.rotation });
          this.renderRiggingSidebarHTML(sidebar);
          this.boneEditor?.render();
          this.previewPlayer?.setSpineDocument(this.spineDoc);
        }
      });
    });

    // 4. Per-slot scale controls
    riggingPanel.querySelectorAll('.input-slot-scale').forEach(input => {
      input.addEventListener('input', (e) => {
        const slotName = (input as HTMLElement).getAttribute('data-slot')!;
        const val = parseFloat((input as HTMLInputElement).value);
        const row = input.closest('.slot-binding-row');
        const lbl = row?.querySelector('.label-slot-scale');
        if (lbl) lbl.textContent = `${val.toFixed(2)}x`;
        this.poseManager.setSlotAttachmentTransform(slotName, { scaleX: val, scaleY: val });
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    riggingPanel.querySelectorAll('.btn-slot-scale-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotName = btn.getAttribute('data-slot')!;
        const val = parseFloat(btn.getAttribute('data-val')!);
        this.poseManager.setSlotAttachmentTransform(slotName, { scaleX: val, scaleY: val });
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    // 5. Bind element dropdown change
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
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    // 6. Bind slot up / down
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
      this.boneEditor?.selectBone(null);
      this.boneEditor?.render();
      const hud = workspace.querySelector('#hud-bone-pose');
      if (hud) hud.textContent = poseSelect.value.toUpperCase();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
      this.previewPlayer?.setPose(poseSelect.value);
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

    workspace.querySelector('.btn-humanoid-preset')?.addEventListener('click', () => {
      if (confirm('Apply humanoid skeletal rig preset (upper/lower arms, hands, upper/lower legs, and feet)?')) {
        this.applyHumanoidRigPreset(sidebar);
      }
    });
  }

  private applyHumanoidRigPreset(sidebar?: HTMLElement): void {
    const defaultDoc = this.createDefaultSpineDocument();
    this.spineDoc.bones = JSON.parse(JSON.stringify(defaultDoc.bones));
    this.spineDoc.slots = JSON.parse(JSON.stringify(defaultDoc.slots));
    this.spineDoc.animations = JSON.parse(JSON.stringify(defaultDoc.animations));
    this.poseManager.setDocument(this.spineDoc);

    const targetSidebar = sidebar || (this.container.querySelector('#right-sidebar') as HTMLElement);
    if (targetSidebar) this.renderRiggingSidebarHTML(targetSidebar);

    this.boneEditor?.render();
    this.previewPlayer?.setSpineDocument(this.spineDoc);
    this.timeline?.setDocument(this.spineDoc);
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

    this.container.querySelectorAll('.btn-simplify-poly').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.slicer?.simplifySelectedElement(2.0)) {
          this.updateSlicerHUD();
        } else {
          alert('Select an element with a contour to simplify.');
        }
      });
    });

    this.container.querySelectorAll('.btn-smooth-poly').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.slicer?.smoothSelectedElement(1)) {
          this.updateSlicerHUD();
        } else {
          alert('Select an element to smooth.');
        }
      });
    });

    this.container.querySelectorAll('.btn-subdivide-poly').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.slicer?.subdivideSelectedElement()) {
          this.updateSlicerHUD();
        } else {
          alert('Select an element to subdivide.');
        }
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

    const nodeCountEl = this.container.querySelector('#hud-node-count');
    if (nodeCountEl) nodeCountEl.textContent = sel ? `${sel.polygon.length}` : '0';

    const selNodeEl = this.container.querySelector('#hud-selected-node');
    const selVertexIdx = this.slicer?.getSelectedVertexIndex();
    if (selNodeEl) {
      if (sel && typeof selVertexIdx === 'number' && sel.polygon[selVertexIdx]) {
        const pt = sel.polygon[selVertexIdx];
        selNodeEl.textContent = `#${selVertexIdx + 1} (${pt.x}, ${pt.y})`;
      } else {
        selNodeEl.textContent = 'None';
      }
    }
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
