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
  private riggingSidebarMode: 'drawOrder' | 'boneTree' | 'elementGallery' = 'drawOrder';
  private expandedSlots: Set<string> = new Set();

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
        { name: 'foot_r', bone: 'foot_r', attachment: 'foot_r' },
        { name: 'leg_lower_r', bone: 'leg_lower_r', attachment: 'leg_lower_r' },
        { name: 'leg_upper_r', bone: 'leg_upper_r', attachment: 'leg_upper_r' },
        { name: 'foot_l', bone: 'foot_l', attachment: 'foot_l' },
        { name: 'leg_lower_l', bone: 'leg_lower_l', attachment: 'leg_lower_l' },
        { name: 'leg_upper_l', bone: 'leg_upper_l', attachment: 'leg_upper_l' },
        { name: 'hip', bone: 'hip', attachment: 'hip' },
        { name: 'torso', bone: 'torso', attachment: 'torso' },
        { name: 'head', bone: 'head', attachment: 'head' },
        { name: 'arm_upper_r', bone: 'arm_upper_r', attachment: 'arm_upper_r' },
        { name: 'arm_lower_r', bone: 'arm_lower_r', attachment: 'arm_lower_r' },
        { name: 'hand_r', bone: 'hand_r', attachment: 'hand_r' },
        { name: 'arm_upper_l', bone: 'arm_upper_l', attachment: 'arm_upper_l' },
        { name: 'arm_lower_l', bone: 'arm_lower_l', attachment: 'arm_lower_l' },
        { name: 'hand_l', bone: 'hand_l', attachment: 'hand_l' }
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

        <!-- Draggable Horizontal Separation Bar -->
        <div class="studio-resizer-h" id="sidebar-resizer" title="Drag to resize panel">
          <div class="resizer-handle"></div>
        </div>

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

    // Clean up panels that do not belong to the newly selected tab
    if (tab === 'slicer') {
      sidebar.querySelector('#rigging-panel')?.remove();
      this.mountSlicerTab(workspace, sidebar);
    } else if (tab === 'rigging') {
      sidebar.querySelector('#slicer-elements-panel')?.remove();
      this.mountRiggingTab(workspace, sidebar);
    } else if (tab === 'timeline') {
      sidebar.querySelector('#slicer-elements-panel')?.remove();
      this.mountTimelineTab(workspace, sidebar, bottomTimeline);
    } else if (tab === 'sandbox') {
      sidebar.querySelector('#slicer-elements-panel')?.remove();
      sidebar.querySelector('#rigging-panel')?.remove();
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
        this.renderSlicerSidebarElements();
      }
    });

    if (this.loadedImage) {
      this.slicer.setImage(this.loadedImage);
    } else if (this.textureUrl) {
      this.slicer.loadTexture(this.textureUrl);
    }
    this.slicer.setElements(this.spineDoc.skeleton.questforge?.elements || []);

    this.mountPersistentPreview(sidebar);
    sidebar.querySelector('#rigging-panel')?.remove();
    this.renderSlicerSidebarHTML(sidebar);
    this.bindSlicerToolEvents();
  }

  private mountRiggingTab(workspace: HTMLElement, sidebar: HTMLElement): void {
    sidebar.querySelector('#slicer-elements-panel')?.remove();
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
        this.highlightBoneInSidebar(bone?.name || null, true);
      },
      onBoneModified: (bone) => {
        this.poseManager.saveActivePoseBones();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
        this.timeline?.setDocument(this.spineDoc);
        this.highlightBoneInSidebar(bone?.name || null, false);
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
    previewPanel.id = 'persistent-preview-container';
    previewPanel.innerHTML = `
      <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span>Live Looping Preview</span>
          <span style="font-size:0.65rem; color:#38bdf8;">PIXI.js v8</span>
        </div>
        <button class="btn-studio btn-toggle-preview" style="padding:1px 6px; font-size:0.65rem;" title="Collapse/Expand Preview">▼</button>
      </div>
      <div class="panel-body preview-collapsible-body">
        <div class="preview-box" id="persistent-preview-box"></div>
        <div class="preview-controls">
          <div class="form-row">
            <span class="form-label">Pose / Skin</span>
            <select class="studio-select select-preview-pose" style="flex:1;">
              ${this.poseManager.getPoseList().map(p => `<option value="${p}" ${p === this.poseManager.getActivePose() ? 'selected' : ''}>${p.toUpperCase()}</option>`).join('')}
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
      <div class="studio-resizer-v" id="preview-panel-resizer" title="Drag to resize preview panel">
        <div class="resizer-handle"></div>
      </div>
    `;
    sidebar.prepend(previewPanel);

    const box = previewPanel.querySelector('#persistent-preview-box') as HTMLElement;
    this.previewPlayer = new PersistentPreviewPlayer(box);
    this.previewPlayer.setSpineDocument(this.spineDoc);
    this.previewPlayer.setPose(this.poseManager.getActivePose());

    const toggleBtn = previewPanel.querySelector('.btn-toggle-preview') as HTMLElement;
    const collBody = previewPanel.querySelector('.preview-collapsible-body') as HTMLElement;
    toggleBtn?.addEventListener('click', () => {
      const isHidden = collBody.style.display === 'none';
      collBody.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? '▼' : '▲';
    });

    const resizerV = previewPanel.querySelector('#preview-panel-resizer') as HTMLElement;
    if (resizerV && box) {
      let isResizingV = false;
      let startY = 0;
      let startH = 0;

      resizerV.addEventListener('mousedown', (e: MouseEvent) => {
        isResizingV = true;
        startY = e.clientY;
        startH = box.getBoundingClientRect().height;
        resizerV.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isResizingV) return;
        const dy = e.clientY - startY;
        const newH = Math.min(450, Math.max(90, startH + dy));
        box.style.height = `${newH}px`;
      });

      window.addEventListener('mouseup', () => {
        if (isResizingV) {
          isResizingV = false;
          resizerV.classList.remove('resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }

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
      const selectedPose = posePreviewSelect.value;
      this.previewPlayer?.setPose(selectedPose);
      this.poseManager.setActivePose(selectedPose);

      // If the newly active pose currently has 0 bound attachments, auto-bind matching elements!
      const hasAnyAttachment = this.poseManager.getSlots().some(s => this.poseManager.getSlotAttachment(s.name) !== null);
      if (!hasAnyAttachment) {
        this.poseManager.autoBindPoseElements(selectedPose);
      }

      // Sync active-pose select in rigging toolbar if present
      const toolbarPoseSelect = this.container.querySelector('.select-active-pose') as HTMLSelectElement | null;
      if (toolbarPoseSelect) toolbarPoseSelect.value = selectedPose;
      const hud = this.container.querySelector('#hud-bone-pose');
      if (hud) hud.textContent = selectedPose.toUpperCase();

      const sidebarContainer = this.container.querySelector('#right-sidebar') as HTMLElement | null;
      if (sidebarContainer && this.currentTab === 'rigging') {
        this.renderRiggingSidebarHTML(sidebarContainer);
      }
    });
  }

  private renderSlicerSidebarHTML(sidebar: HTMLElement): void {
    // Remove rigging panel if present
    sidebar.querySelector('#rigging-panel')?.remove();

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
          ${thumb ? `<img src="${thumb}" class="element-thumb" alt="${el.name}" style="flex-shrink:0; width:28px; height:28px; object-fit:contain; border-radius:3px; background:#0f172a;" />` : `<div class="element-thumb-placeholder" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:#1e293b; border-radius:3px; font-size:0.75rem; flex-shrink:0;" title="${el.name}">🎨</div>`}

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
      riggingPanel.style.minHeight = '0';
      sidebar.appendChild(riggingPanel);
    }

    // Save previous scroll position
    const scrollContainer = riggingPanel.querySelector('.rigging-panel-scroll-body') as HTMLElement | null;
    const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    const bones = this.poseManager.getBones();
    const slots = this.poseManager.getSlots();
    const elements = this.spineDoc.skeleton.questforge?.elements || [];
    const selectedBoneName = this.boneEditor?.getSelectedBone()?.name || null;
    const activePose = this.poseManager.getActivePose();

    // Elements matching current pose
    const posePrefix = activePose === 'front' ? 'f_' : (activePose === 'side' ? 's_' : (activePose === 'back' ? 'b_' : `${activePose}_`));
    const altPrefix = activePose === 'front' ? 'front_' : (activePose === 'side' ? 'side_' : (activePose === 'back' ? 'back_' : ''));

    const poseElements = elements.filter(el =>
      el.name.startsWith(posePrefix) || (altPrefix ? el.name.startsWith(altPrefix) : false) || el.name.toLowerCase().includes(`_${activePose}`)
    );
    const otherElements = elements.filter(el => !poseElements.includes(el));

    const boundAttachments = slots.map(s => this.poseManager.getSlotAttachment(s.name)).filter(Boolean);
    const currentGlobalScale = boundAttachments.length > 0 && boundAttachments[0]?.scaleX !== undefined
      ? boundAttachments[0].scaleX
      : 0.25;

    riggingPanel.innerHTML = `
      <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Bones & Layers (${activePose.toUpperCase()})</span>
        <button class="btn-studio btn-auto-align-all" style="font-size:0.68rem; padding:2px 8px; background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; font-weight:600;" title="Align all cutouts with bone directions and auto-scale to bone lengths">
          ⚡ Auto-Align & Fit
        </button>
      </div>

      <!-- Mode Switcher Tabs: Draw Order (Z-Stack) vs Bone Hierarchy vs Element Gallery -->
      <div class="sidebar-tab-bar" style="display:flex; border-bottom:1px solid var(--studio-border); background:#0b1120;">
        <button class="btn-studio btn-tab-draw-order ${this.riggingSidebarMode === 'drawOrder' ? 'active' : ''}" style="flex:1; border-radius:0; border:none; padding:7px 2px; font-size:0.7rem; font-weight:600; display:flex; align-items:center; justify-content:center; gap:4px; background:${this.riggingSidebarMode === 'drawOrder' ? '#1e293b' : 'transparent'}; color:${this.riggingSidebarMode === 'drawOrder' ? '#38bdf8' : 'var(--studio-text-muted)'};">
          📑 Draw Order
        </button>
        <button class="btn-studio btn-tab-bone-tree ${this.riggingSidebarMode === 'boneTree' ? 'active' : ''}" style="flex:1; border-radius:0; border:none; padding:7px 2px; font-size:0.7rem; font-weight:600; display:flex; align-items:center; justify-content:center; gap:4px; background:${this.riggingSidebarMode === 'boneTree' ? '#1e293b' : 'transparent'}; color:${this.riggingSidebarMode === 'boneTree' ? '#38bdf8' : 'var(--studio-text-muted)'};">
          🌳 Bone Tree
        </button>
        <button class="btn-studio btn-tab-element-gallery ${this.riggingSidebarMode === 'elementGallery' ? 'active' : ''}" style="flex:1; border-radius:0; border:none; padding:7px 2px; font-size:0.7rem; font-weight:600; display:flex; align-items:center; justify-content:center; gap:4px; background:${this.riggingSidebarMode === 'elementGallery' ? '#1e293b' : 'transparent'}; color:${this.riggingSidebarMode === 'elementGallery' ? '#38bdf8' : 'var(--studio-text-muted)'};">
          🎨 Elements (${elements.length})
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

      ${this.riggingSidebarMode === 'drawOrder' ? `
        <!-- Available Elements for this Pose (e.g. SIDE) -->
        <div class="pose-elements-tray" style="background:#090d16; border-bottom:1px solid var(--studio-border); padding:6px 8px; display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.68rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:4px;">
              <span>🎨</span> Available ${activePose.toUpperCase()} Elements (${poseElements.length})
            </span>
            <button class="btn-studio btn-auto-bind-pose" style="font-size:0.65rem; padding:2px 8px; color:#10b981; border-color:rgba(16,185,129,0.4); font-weight:600;" title="Auto-bind all matching ${activePose.toUpperCase()} elements to slots and align them">
              ⚡ Auto-Bind All to Bones
            </button>
          </div>
          <div class="pose-chips-container" style="display:flex; gap:4px; overflow-x:auto; padding-bottom:3px; scrollbar-width:thin;">
            ${poseElements.length > 0 ? poseElements.map(el => {
              const thumb = this.slicer?.generateThumbnail(el) || '';
              return `
                <div class="pose-elem-chip" data-elem-name="${el.name}" title="${el.name} (${el.bounds.width}x${el.bounds.height}) — Click to assign to selected bone" style="display:flex; align-items:center; gap:4px; background:#1e293b; border:1px solid var(--studio-border); border-radius:4px; padding:2px 6px; font-size:0.65rem; cursor:pointer; flex-shrink:0;">
                  ${thumb ? `<img src="${thumb}" style="width:18px; height:18px; object-fit:contain; border-radius:2px; background:#020617;" />` : ''}
                  <span style="font-weight:600; color:#e2e8f0;">${el.name}</span>
                </div>
              `;
            }).join('') : `
              <div style="font-size:0.65rem; color:var(--studio-text-muted); padding:2px 0;">
                No elements prefixed with '${posePrefix}' found.
              </div>
            `}
          </div>
        </div>

        <div class="panel-body rigging-panel-scroll-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding:8px;">
          <div style="font-size:0.68rem; color:var(--studio-text-muted); padding:2px 4px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#38bdf8; font-weight:600;">▲ Front (Drawn on top)</span>
            <span style="font-size:0.63rem;">Drag layers to reorder Z-Stack</span>
          </div>

          <div class="slot-list-container" style="display:flex; flex-direction:column; gap:6px;">
            ${slots.slice().reverse().map((slot, revIdx) => {
              const actualIdx = slots.length - 1 - revIdx;
              const isTop = actualIdx === slots.length - 1;
              const isBottom = actualIdx === 0;
              const isSelected = slot.bone === selectedBoneName;
              const isExpanded = this.expandedSlots.has(slot.name) || isSelected;
              const currentAttach = this.poseManager.getSlotAttachment(slot.name);
              const attachElem = elements.find(e => e.name === currentAttach?.name);
              const currentAttachThumb = attachElem ? (this.slicer?.generateThumbnail(attachElem) || '') : '';
              const rot = currentAttach?.rotation || 0;
              const scX = currentAttach?.scaleX ?? 1;

              const badgeLabel = isTop
                ? `Z:${actualIdx + 1} Front`
                : (isBottom ? `Z:1 Back` : `Z:${actualIdx + 1}`);

              return `
                <div class="slot-binding-row ${isSelected ? 'selected active' : ''}" data-slot="${slot.name}" data-bone="${slot.bone}" data-sidx="${actualIdx}" draggable="true">
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
                      <span class="drag-handle" title="Drag to reorder layer in Z-stack">⠿</span>
                      <span class="slot-z-badge" style="font-size:0.65rem; padding:1px 6px; border-radius:3px; background:${isTop ? '#0284c7' : (isBottom ? '#334155' : '#1e3a5f')}; color:#fff; font-weight:700; font-family:var(--studio-font-mono); flex-shrink:0;">${badgeLabel}</span>
                      <span class="slot-bone-name" style="font-weight:700; font-size:0.75rem; color:${isSelected ? '#38bdf8' : '#e2e8f0'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🦴 ${slot.bone}</span>
                    </div>
                    <div style="display:flex; gap:3px; align-items:center; flex-shrink:0;">
                      <button class="btn-studio btn-slot-up" data-sidx="${actualIdx}" style="padding:1px 5px; font-size:0.65rem;" title="Bring Forward (Higher Z / Front)" ${isTop ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▲</button>
                      <button class="btn-studio btn-slot-down" data-sidx="${actualIdx}" style="padding:1px 5px; font-size:0.65rem;" title="Send Backward (Lower Z / Back)" ${isBottom ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▼</button>
                      <button class="btn-studio btn-toggle-slot" data-slot="${slot.name}" style="padding:1px 5px; font-size:0.65rem;" title="Toggle Transform Sliders">${isExpanded ? '▴' : '▾'}</button>
                    </div>
                  </div>

                  <div style="display:flex; align-items:center; gap:5px; margin-top:2px;">
                    <span style="font-size:0.68rem; color:var(--studio-text-muted); flex-shrink:0;">Element:</span>
                    ${currentAttachThumb ? `<img src="${currentAttachThumb}" class="slot-attach-thumb" style="width:20px; height:20px; object-fit:contain; border-radius:3px; background:#020617; border:1px solid var(--studio-border); flex-shrink:0;" title="${currentAttach?.name}" />` : `<span style="font-size:0.75rem; flex-shrink:0; opacity:0.35;">🖼️</span>`}
                    <select class="studio-select select-slot-element" data-slot="${slot.name}" style="flex:1; font-size:0.72rem; padding:2px 4px; min-width:0;">
                      <option value="">(None)</option>
                      ${poseElements.length > 0 ? `
                        <optgroup label="⭐ ${activePose.toUpperCase()} Elements">
                          ${poseElements.map(el => `<option value="${el.name}" ${currentAttach?.name === el.name ? 'selected' : ''}>${el.name}</option>`).join('')}
                        </optgroup>
                      ` : ''}
                      ${otherElements.length > 0 ? `
                        <optgroup label="Other Sliced Elements">
                          ${otherElements.map(el => `<option value="${el.name}" ${currentAttach?.name === el.name ? 'selected' : ''}>${el.name}</option>`).join('')}
                        </optgroup>
                      ` : ''}
                    </select>
                    <button class="btn-studio btn-open-elem-picker" data-slot="${slot.name}" style="padding:2px 5px; font-size:0.65rem; flex-shrink:0;" title="Browse and pick element visually from thumbnail gallery">🖼️ Pick</button>
                    <button class="btn-studio btn-slot-rot-auto" data-slot="${slot.name}" style="padding:2px 6px; font-size:0.65rem; flex-shrink:0;" title="Auto-align with bone direction and scale">⚡ Auto</button>
                  </div>

                  ${isExpanded && currentAttach ? `
                    <div class="slot-attach-details" style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; background:#090d16; padding:6px; border-radius:4px; margin-top:4px;">
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

          <div style="font-size:0.68rem; color:var(--studio-text-muted); padding:4px 4px 2px; text-align:right;">
            ▼ Back (Drawn at bottom of canvas)
          </div>
        </div>
      ` : this.riggingSidebarMode === 'boneTree' ? `
        <div class="panel-body rigging-panel-scroll-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding:8px;">
          <div style="font-size:0.68rem; color:var(--studio-text-muted); padding:2px 4px 6px;">
            Skeletal Parent-Child Hierarchy (Click node to select bone in viewport):
          </div>
          ${this.renderBoneHierarchyTreeHTML(bones, slots, elements, selectedBoneName)}
        </div>
      ` : `
        <div class="panel-body rigging-panel-scroll-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding:8px;">
          <div style="font-size:0.68rem; color:var(--studio-text-muted); padding:2px 4px;">
            All Sliced Graphics (Click element to bind to selected bone 🦴 <b>${selectedBoneName || 'None'}</b>):
          </div>
          ${this.renderElementGalleryHTML(elements, slots, activePose, poseElements, otherElements, selectedBoneName)}
        </div>
      `}
    `;

    // 1. Tab switching
    riggingPanel.querySelector('.btn-tab-draw-order')?.addEventListener('click', () => {
      this.riggingSidebarMode = 'drawOrder';
      this.renderRiggingSidebarHTML(sidebar);
    });
    riggingPanel.querySelector('.btn-tab-bone-tree')?.addEventListener('click', () => {
      this.riggingSidebarMode = 'boneTree';
      this.renderRiggingSidebarHTML(sidebar);
    });
    riggingPanel.querySelector('.btn-tab-element-gallery')?.addEventListener('click', () => {
      this.riggingSidebarMode = 'elementGallery';
      this.renderRiggingSidebarHTML(sidebar);
    });

    // 2. Auto-align all button
    riggingPanel.querySelector('.btn-auto-align-all')?.addEventListener('click', () => {
      this.poseManager.autoAlignAllAttachments();
      this.renderRiggingSidebarHTML(sidebar);
      this.boneEditor?.render();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
    });

    // 2b. Auto-bind pose elements button
    riggingPanel.querySelector('.btn-auto-bind-pose')?.addEventListener('click', () => {
      this.poseManager.autoBindPoseElements(activePose);
      this.renderRiggingSidebarHTML(sidebar);
      this.boneEditor?.render();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
    });

    // 2c. Available pose element chips
    riggingPanel.querySelectorAll('.pose-elem-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const elemName = chip.getAttribute('data-elem-name')!;
        const elem = elements.find(el => el.name === elemName);
        if (!elem) return;

        const selBone = this.boneEditor?.getSelectedBone();
        if (selBone) {
          const slot = slots.find(s => s.bone === selBone.name);
          if (slot) {
            this.poseManager.bindElementToSlot(slot.name, elem);
            this.renderRiggingSidebarHTML(sidebar);
            this.boneEditor?.render();
            this.previewPlayer?.setSpineDocument(this.spineDoc);
            return;
          }
        }
        // If no bone selected, prompt to select a bone
        alert(`Element selected: "${elemName}". Select a bone in the viewport or layer list to assign it.`);
      });
    });

    // 3. Global scale slider and chips
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

    // 4. Per-slot rotation controls
    riggingPanel.querySelectorAll('.input-slot-rot').forEach(input => {
      input.addEventListener('input', () => {
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
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotName = btn.getAttribute('data-slot')!;
        const val = parseInt(btn.getAttribute('data-val')!, 10);
        this.poseManager.setSlotAttachmentTransform(slotName, { rotation: val });
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    riggingPanel.querySelectorAll('.btn-slot-rot-auto').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotName = btn.getAttribute('data-slot')!;
        const attach = this.poseManager.getSlotAttachment(slotName);
        const elem = elements.find(el => el.name === attach?.name);
        if (elem) {
          const def = this.poseManager.computeDefaultElementTransform(slotName, elem);
          this.poseManager.setSlotAttachmentTransform(slotName, {
            rotation: def.rotation,
            scaleX: def.scaleX,
            scaleY: def.scaleY
          });
          this.renderRiggingSidebarHTML(sidebar);
          this.boneEditor?.render();
          this.previewPlayer?.setSpineDocument(this.spineDoc);
        }
      });
    });

    // 5. Per-slot scale controls
    riggingPanel.querySelectorAll('.input-slot-scale').forEach(input => {
      input.addEventListener('input', () => {
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
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotName = btn.getAttribute('data-slot')!;
        const val = parseFloat(btn.getAttribute('data-val')!);
        this.poseManager.setSlotAttachmentTransform(slotName, { scaleX: val, scaleY: val });
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();
        this.previewPlayer?.setSpineDocument(this.spineDoc);
      });
    });

    // 6. Bind element dropdown change
    riggingPanel.querySelectorAll('.select-slot-element').forEach(sel => {
      sel.addEventListener('change', (e) => {
        e.stopPropagation();
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

    // 6b. Open Element Picker Modal
    riggingPanel.querySelectorAll('.btn-open-elem-picker').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotName = btn.getAttribute('data-slot')!;
        this.openElementPickerModal(slotName, sidebar);
      });
    });

    // 7. Toggle slot controls expand/collapse
    riggingPanel.querySelectorAll('.btn-toggle-slot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotName = btn.getAttribute('data-slot')!;
        if (this.expandedSlots.has(slotName)) {
          this.expandedSlots.delete(slotName);
        } else {
          this.expandedSlots.add(slotName);
        }
        this.renderRiggingSidebarHTML(sidebar);
      });
    });

    // 8. Bind slot up / down in draw order
    // Up (▲): Bring Forward (move towards Front: actualIdx + 1)
    riggingPanel.querySelectorAll('.btn-slot-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sidx = parseInt(btn.getAttribute('data-sidx')!, 10);
        if (sidx < slots.length - 1) {
          this.poseManager.moveSlotDrawOrder(sidx, sidx + 1);
          this.renderRiggingSidebarHTML(sidebar);
          this.boneEditor?.render();
          const curSlot = slots[sidx + 1];
          if (curSlot) {
            this.boneEditor?.selectBone(curSlot.bone);
            this.highlightBoneInSidebar(curSlot.bone, true);
          }
        }
      });
    });

    // Down (▼): Send Backward (move towards Back: actualIdx - 1)
    riggingPanel.querySelectorAll('.btn-slot-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sidx = parseInt(btn.getAttribute('data-sidx')!, 10);
        if (sidx > 0) {
          this.poseManager.moveSlotDrawOrder(sidx, sidx - 1);
          this.renderRiggingSidebarHTML(sidebar);
          this.boneEditor?.render();
          const curSlot = slots[sidx - 1];
          if (curSlot) {
            this.boneEditor?.selectBone(curSlot.bone);
            this.highlightBoneInSidebar(curSlot.bone, true);
          }
        }
      });
    });

    // 9. Drag & Drop Reordering on .slot-binding-row
    riggingPanel.querySelectorAll('.slot-binding-row').forEach(row => {
      row.addEventListener('dragstart', (e: DragEvent) => {
        const slotName = row.getAttribute('data-slot');
        if (!slotName || !e.dataTransfer) return;
        e.dataTransfer.setData('text/plain', slotName);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });

      row.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          row.classList.add('drop-target-above');
          row.classList.remove('drop-target-below');
        } else {
          row.classList.add('drop-target-below');
          row.classList.remove('drop-target-above');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drop-target-above', 'drop-target-below');
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging', 'drop-target-above', 'drop-target-below');
      });

      row.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        row.classList.remove('drop-target-above', 'drop-target-below');
        const srcName = e.dataTransfer?.getData('text/plain');
        const dstName = row.getAttribute('data-slot');
        if (!srcName || !dstName || srcName === dstName) return;

        // Current UI order is top to bottom (slots reversed)
        const uiOrder = slots.slice().reverse().map(s => s.name);
        const srcUiIdx = uiOrder.indexOf(srcName);
        if (srcUiIdx === -1) return;
        uiOrder.splice(srcUiIdx, 1);

        const dstUiIdx = uiOrder.indexOf(dstName);
        const rect = row.getBoundingClientRect();
        const isAbove = e.clientY < rect.top + rect.height / 2;
        const insertIdx = isAbove ? dstUiIdx : dstUiIdx + 1;
        uiOrder.splice(insertIdx, 0, srcName);

        // Convert UI order back to doc.slots order (reverse of UI)
        const newDocSlots = uiOrder.reverse();
        this.poseManager.reorderSlotsByNames(newDocSlots);
        this.renderRiggingSidebarHTML(sidebar);
        this.boneEditor?.render();

        const movedSlot = slots.find(s => s.name === srcName);
        if (movedSlot) {
          this.boneEditor?.selectBone(movedSlot.bone);
          this.highlightBoneInSidebar(movedSlot.bone, true);
        }
      });

      // Row click to select bone in viewport
      row.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('select') || target.closest('input')) return;
        const boneName = row.getAttribute('data-bone');
        if (boneName) {
          this.boneEditor?.selectBone(boneName);
          this.highlightBoneInSidebar(boneName, false);
        }
      });
    });

    // 10. Tree Node click to select bone
    riggingPanel.querySelectorAll('.bone-tree-node').forEach(node => {
      node.addEventListener('click', () => {
        const boneName = node.getAttribute('data-bone');
        if (boneName) {
          this.boneEditor?.selectBone(boneName);
          this.highlightBoneInSidebar(boneName, false);
        }
      });
    });

    // 11. Element Gallery card click to bind to selected bone
    riggingPanel.querySelectorAll('.elem-gallery-card').forEach(card => {
      card.addEventListener('click', () => {
        const elemName = card.getAttribute('data-elem-name')!;
        const elem = elements.find(el => el.name === elemName);
        if (!elem) return;

        const selBone = this.boneEditor?.getSelectedBone();
        if (selBone) {
          const slot = slots.find(s => s.bone === selBone.name);
          if (slot) {
            this.poseManager.bindElementToSlot(slot.name, elem);
            this.renderRiggingSidebarHTML(sidebar);
            this.boneEditor?.render();
            this.previewPlayer?.setSpineDocument(this.spineDoc);
            return;
          }
        }
        alert(`Select a bone in the viewport or tree first, then click an element to bind it.`);
      });
    });

    // Restore scroll position
    const newScrollContainer = riggingPanel.querySelector('.rigging-panel-scroll-body') as HTMLElement | null;
    if (newScrollContainer && savedScrollTop > 0) {
      newScrollContainer.scrollTop = savedScrollTop;
    }

    // Ensure active bone is highlighted in sidebar
    if (selectedBoneName) {
      this.highlightBoneInSidebar(selectedBoneName, false);
    }
  }

  private renderBoneHierarchyTreeHTML(
    bones: SpineBoneData[],
    slots: SpineSlotData[],
    elements: VectorOutlineElement[],
    selectedBoneName: string | null
  ): string {
    const childrenMap = new Map<string, SpineBoneData[]>();
    const rootBones: SpineBoneData[] = [];

    for (const b of bones) {
      if (!b.parent || b.name === 'root') {
        rootBones.push(b);
      } else {
        if (!childrenMap.has(b.parent)) childrenMap.set(b.parent, []);
        childrenMap.get(b.parent)!.push(b);
      }
    }

    const renderNode = (b: SpineBoneData, depth: number): string => {
      const isSelected = b.name === selectedBoneName;
      const children = childrenMap.get(b.name) || [];
      const slot = slots.find(s => s.bone === b.name);
      const attach = slot ? this.poseManager.getSlotAttachment(slot.name) : null;

      return `
        <div class="bone-tree-node ${isSelected ? 'selected active' : ''}" data-bone="${b.name}" style="padding-left:${8 + depth * 16}px; display:flex; align-items:center; gap:6px; padding-top:6px; padding-bottom:6px; border-radius:6px; cursor:pointer; margin-bottom:2px; border:1px solid ${isSelected ? 'var(--studio-accent)' : 'transparent'}; background:${isSelected ? 'rgba(14, 116, 144, 0.25)' : 'transparent'};">
          <span style="font-size:0.8rem; color:#64748b;">${children.length > 0 ? '📁' : '🦴'}</span>
          <span style="font-size:0.75rem; font-weight:700; color:${isSelected ? '#38bdf8' : '#e2e8f0'};">${b.name}</span>
          ${attach ? `<span style="font-size:0.62rem; color:#38bdf8; background:#0f172a; padding:1px 5px; border-radius:3px; border:1px solid #1e293b;">${attach.name}</span>` : ''}
          <span style="font-size:0.62rem; color:#64748b; font-family:var(--studio-font-mono); margin-left:auto;">${b.rotation || 0}° L:${b.length || 0}</span>
        </div>
        ${children.map(c => renderNode(c, depth + 1)).join('')}
      `;
    };

    return rootBones.map(r => renderNode(r, 0)).join('');
  }

  private renderElementGalleryHTML(
    elements: VectorOutlineElement[],
    slots: SpineSlotData[],
    activePose: string,
    poseElements: VectorOutlineElement[],
    otherElements: VectorOutlineElement[],
    selectedBoneName: string | null
  ): string {
    const renderCard = (el: VectorOutlineElement) => {
      const thumb = this.slicer?.generateThumbnail(el) || '';
      const boundSlot = slots.find(s => this.poseManager.getSlotAttachment(s.name)?.name === el.name);
      return `
        <div class="elem-gallery-card" data-elem-name="${el.name}" style="background:#1e293b; border:1px solid var(--studio-border); border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; cursor:pointer; transition:all 0.15s ease;">
          <div style="height:60px; background:#020617; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${thumb ? `<img src="${thumb}" style="max-height:100%; max-width:100%; object-fit:contain;" />` : `<span style="font-size:0.8rem; opacity:0.3;">🖼️</span>`}
          </div>
          <div style="font-weight:700; font-size:0.72rem; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${el.name}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.62rem; color:var(--studio-text-muted);">
            <span>${el.bounds.width}×${el.bounds.height}</span>
            ${boundSlot ? `<span style="color:#38bdf8; font-weight:600;">🦴 ${boundSlot.bone}</span>` : '<span style="color:#64748b;">(unbound)</span>'}
          </div>
        </div>
      `;
    };

    return `
      ${poseElements.length > 0 ? `
        <div style="font-weight:700; font-size:0.72rem; color:#38bdf8; margin-top:4px;">⭐ ${activePose.toUpperCase()} Graphics:</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:6px;">
          ${poseElements.map(renderCard).join('')}
        </div>
      ` : ''}

      ${otherElements.length > 0 ? `
        <div style="font-weight:700; font-size:0.72rem; color:var(--studio-text-muted); margin-top:8px;">Other Sliced Graphics:</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:6px;">
          ${otherElements.map(renderCard).join('')}
        </div>
      ` : ''}
    `;
  }

  private openElementPickerModal(slotName: string, sidebar: HTMLElement): void {
    const existing = document.querySelector('.element-picker-backdrop');
    if (existing) existing.remove();

    const elements = this.spineDoc.skeleton.questforge?.elements || [];
    const activePose = this.poseManager.getActivePose();
    const slot = this.poseManager.getSlots().find(s => s.name === slotName);
    const boneName = slot ? slot.bone : slotName;

    const posePrefix = activePose === 'front' ? 'f_' : (activePose === 'side' ? 's_' : (activePose === 'back' ? 'b_' : `${activePose}_`));
    const altPrefix = activePose === 'front' ? 'front_' : (activePose === 'side' ? 'side_' : (activePose === 'back' ? 'back_' : ''));
    const poseElements = elements.filter(el =>
      el.name.startsWith(posePrefix) || (altPrefix ? el.name.startsWith(altPrefix) : false) || el.name.toLowerCase().includes(`_${activePose}`)
    );

    const backdrop = document.createElement('div');
    backdrop.className = 'element-picker-backdrop';
    backdrop.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);';

    backdrop.innerHTML = `
      <div class="element-picker-modal" style="background:#0f172a; border:1px solid var(--studio-border); border-radius:10px; width:520px; max-width:92vw; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--studio-border); background:#0b1120;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.1rem;">🖼️</span>
            <div>
              <div style="font-weight:700; font-size:0.85rem; color:#fff;">Assign Element to 🦴 ${boneName}</div>
              <div style="font-size:0.68rem; color:#38bdf8;">Pose: ${activePose.toUpperCase()} • Slot: ${slotName}</div>
            </div>
          </div>
          <button class="btn-studio btn-close-picker-modal" style="padding:2px 8px; font-size:0.8rem;">✕</button>
        </div>

        <div style="padding:8px 12px; background:#090d16; border-bottom:1px solid var(--studio-border); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.7rem; color:var(--studio-text-muted);">Click any graphic card to bind:</span>
          <button class="btn-studio btn-unbind-slot-picker" style="font-size:0.68rem; padding:2px 8px; color:#ef4444;">(Clear / Unbind)</button>
        </div>

        <div class="picker-cards-grid" style="flex:1; overflow-y:auto; padding:12px; display:grid; grid-template-columns:repeat(auto-fill, minmax(105px, 1fr)); gap:8px;">
          ${elements.map(el => {
            const isPoseMatch = poseElements.includes(el);
            const thumb = this.slicer?.generateThumbnail(el) || '';
            return `
              <div class="picker-elem-card" data-elem-name="${el.name}" style="background:#1e293b; border:1px solid ${isPoseMatch ? '#0284c7' : 'var(--studio-border)'}; border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px; cursor:pointer; transition:all 0.15s ease; position:relative;">
                ${isPoseMatch ? `<span style="position:absolute; top:4px; right:4px; font-size:0.58rem; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px; font-weight:700;">${activePose.toUpperCase()}</span>` : ''}
                <div style="height:65px; background:#020617; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                  ${thumb ? `<img src="${thumb}" style="max-height:100%; max-width:100%; object-fit:contain;" />` : `<span style="font-size:0.8rem; opacity:0.3;">🖼️</span>`}
                </div>
                <div style="font-weight:700; font-size:0.72rem; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${el.name}">${el.name}</div>
                <div style="font-size:0.62rem; color:var(--studio-text-muted); font-family:var(--studio-font-mono);">${el.bounds.width}×${el.bounds.height}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const closeModal = () => backdrop.remove();
    backdrop.querySelector('.btn-close-picker-modal')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    backdrop.querySelector('.btn-unbind-slot-picker')?.addEventListener('click', () => {
      this.poseManager.unbindSlotAttachment(slotName);
      this.renderRiggingSidebarHTML(sidebar);
      this.boneEditor?.render();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
      closeModal();
    });

    backdrop.querySelectorAll('.picker-elem-card').forEach(card => {
      card.addEventListener('click', () => {
        const elemName = card.getAttribute('data-elem-name')!;
        const elem = elements.find(el => el.name === elemName);
        if (elem) {
          this.poseManager.bindElementToSlot(slotName, elem);
          this.renderRiggingSidebarHTML(sidebar);
          this.boneEditor?.render();
          this.previewPlayer?.setSpineDocument(this.spineDoc);
        }
        closeModal();
      });
    });
  }

  private bindRiggingEvents(workspace: HTMLElement, sidebar: HTMLElement): void {
    const poseSelect = workspace.querySelector('.select-active-pose') as HTMLSelectElement;
    poseSelect?.addEventListener('change', () => {
      const newPose = poseSelect.value;
      this.poseManager.setActivePose(newPose);

      // If the newly active pose currently has 0 bound attachments, auto-bind matching elements!
      const hasAnyAttachment = this.poseManager.getSlots().some(s => this.poseManager.getSlotAttachment(s.name) !== null);
      if (!hasAnyAttachment) {
        this.poseManager.autoBindPoseElements(newPose);
      }

      this.renderRiggingSidebarHTML(sidebar);
      this.boneEditor?.selectBone(null);
      this.boneEditor?.render();
      const hud = workspace.querySelector('#hud-bone-pose');
      if (hud) hud.textContent = newPose.toUpperCase();
      this.previewPlayer?.setSpineDocument(this.spineDoc);
      this.previewPlayer?.setPose(newPose);

      const previewPoseSelect = this.container.querySelector('.select-preview-pose') as HTMLSelectElement | null;
      if (previewPoseSelect) previewPoseSelect.value = newPose;
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

    // Draggable Sidebar Horizontal Resizer
    const resizerH = this.container.querySelector('#sidebar-resizer') as HTMLElement;
    const sidebar = this.container.querySelector('#right-sidebar') as HTMLElement;
    if (resizerH && sidebar) {
      let isResizingH = false;
      let startX = 0;
      let startW = 0;

      resizerH.addEventListener('mousedown', (e: MouseEvent) => {
        isResizingH = true;
        startX = e.clientX;
        startW = sidebar.getBoundingClientRect().width;
        resizerH.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isResizingH) return;
        const dx = startX - e.clientX;
        const newW = Math.min(800, Math.max(280, startW + dx));
        sidebar.style.width = `${newW}px`;
      });

      window.addEventListener('mouseup', () => {
        if (isResizingH) {
          isResizingH = false;
          resizerH.classList.remove('resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }
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
    let targetEl: HTMLElement | null = null;
    this.container.querySelectorAll('.element-item').forEach(item => {
      const isMatch = item.getAttribute('data-elem-id') === id;
      item.classList.toggle('active', isMatch);
      if (isMatch) targetEl = item as HTMLElement;
    });
    if (targetEl) {
      (targetEl as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private highlightBoneInSidebar(name: string | null, shouldScroll: boolean = true): void {
    let targetEl: HTMLElement | null = null;

    this.container.querySelectorAll('.slot-binding-row').forEach(row => {
      const isMatch = row.getAttribute('data-bone') === name || row.getAttribute('data-slot') === name;
      row.classList.toggle('selected', isMatch);
      row.classList.toggle('active', isMatch);
      (row as HTMLElement).style.borderColor = isMatch ? 'var(--studio-accent)' : 'var(--studio-border)';
      if (isMatch) targetEl = row as HTMLElement;
    });

    this.container.querySelectorAll('.bone-tree-node').forEach(node => {
      const isMatch = node.getAttribute('data-bone') === name;
      node.classList.toggle('selected', isMatch);
      node.classList.toggle('active', isMatch);
      if (isMatch && !targetEl) targetEl = node as HTMLElement;
    });

    if (shouldScroll && targetEl) {
      (targetEl as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
