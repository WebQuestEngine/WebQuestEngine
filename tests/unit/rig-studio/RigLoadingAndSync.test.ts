import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RigStudioApp } from '../../../src/rig-studio/RigStudioApp';
import { RigProjectData } from '../../../src/rig-studio/types';

describe('RigStudioApp - Rig Loading and Graphic Synchronization', () => {
  let container: HTMLElement;
  let app: RigStudioApp;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    // Standalone mode initializes app
    app = new RigStudioApp(container);
  });

  it('loads a rigged character project with its graphics and attachments', () => {
    const mockRigData: RigProjectData = {
      format: 'questforge-rig-project',
      version: '1.0',
      characterName: 'Heroic Knight',
      activeView: 'front',
      views: {
        front: {
          label: 'Front',
          imageUrl: 'data:image/png;base64,mockBase64KnightFront',
          fileName: 'knight_front.png',
          fileSize: '500 KB',
          joints: {
            head: { x: 0, y: -310 },
            neck: { x: 0, y: -265 },
            chest: { x: 0, y: -230 },
            shoulder_l: { x: 30, y: -230 },
            shoulder_r: { x: -30, y: -230 },
            elbow_l: { x: 55, y: -185 },
            elbow_r: { x: -55, y: -185 },
            wrist_l: { x: 75, y: -135 },
            wrist_r: { x: -75, y: -135 },
            hand_l: { x: 85, y: -110 },
            hand_r: { x: -85, y: -110 },
            hip_l: { x: 22, y: -150 },
            hip_r: { x: -22, y: -150 },
            knee_l: { x: 25, y: -90 },
            knee_r: { x: -25, y: -90 },
            ankle_l: { x: 28, y: -35 },
            ankle_r: { x: -28, y: -35 },
            foot_l: { x: 32, y: 0 },
            foot_r: { x: -32, y: 0 },
          },
          envelopes: {
            head: 36,
            chest: 32,
            shoulder_l: 18,
            shoulder_r: 18
          },
          parts: {
            head: {
              boneId: 'head',
              fileName: 'knight_helmet.png',
              imageUrl: 'data:image/png;base64,mockHelmetPng',
              scale: 1.0,
              offsetX: 0,
              offsetY: 0,
              rotation: 0,
              pivotX: 0.5,
              pivotY: 0.8
            },
            shoulder_l: {
              boneId: 'shoulder_l',
              fileName: 'knight_pauldron_l.png',
              imageUrl: 'data:image/png;base64,mockPauldronPng',
              scale: 1.0,
              pivotX: 0.3,
              pivotY: 0.2
            }
          }
        }
      },
      partsLibrary: [
        {
          id: 'part_helmet',
          name: 'Helmet',
          imageUrl: 'data:image/png;base64,mockHelmetPng',
          width: 80,
          height: 80,
          assignedBoneId: 'head',
          pivotX: 0.5,
          pivotY: 0.8
        }
      ]
    };

    app.loadRigProjectData(mockRigData);

    // Verify character name was loaded
    const views = (app as any).views;
    expect(views.front.fileName).toBe('knight_front.png');
    expect(views.front.joints.head).toEqual({ x: 0, y: -310 });
    expect(views.front.parts.head).toBeDefined();
    expect(views.front.parts.head.fileName).toBe('knight_helmet.png');
    expect(views.front.parts.shoulder_l.fileName).toBe('knight_pauldron_l.png');

    // Verify parts library was restored
    const partsLib = (app as any).partsLibrary;
    expect(partsLib.length).toBe(1);
    expect(partsLib[0].name).toBe('Helmet');
    expect(partsLib[0].assignedBoneId).toBe('head');
  });

  it('synchronizes new graphics from slicing tab directly to the rig and bones tab', () => {
    const mockImg = document.createElement('img') as HTMLImageElement;
    app.setSlicerImage(mockImg, 'data:image/png;base64,mockGoblinSheet', 'goblin_sheet.png', '350 KB');

    // Slicer state must be updated
    expect((app as any).slicerImageFileName).toBe('goblin_sheet.png');
    expect((app as any).slicerImageUrl).toBe('data:image/png;base64,mockGoblinSheet');

    // Active Rig view must be automatically updated with the new graphic!
    const activeArt = (app as any).views[(app as any).activeView];
    expect(activeArt.fileName).toBe('goblin_sheet.png');
    expect(activeArt.imageUrl).toBe('data:image/png;base64,mockGoblinSheet');
    expect(activeArt.fileSize).toBe('350 KB');
  });

  it('switching from slicer to rig mode preserves and applies slicer artwork', () => {
    (app as any).slicerImage = new Image();
    (app as any).slicerImageUrl = 'data:image/png;base64,mockNewOrc';
    (app as any).slicerImageFileName = 'orc_sheet.png';

    app.switchStudioMode('rig');

    const activeArt = (app as any).views[(app as any).activeView];
    expect(activeArt.fileName).toBe('orc_sheet.png');
    expect(activeArt.imageUrl).toBe('data:image/png;base64,mockNewOrc');
  });

  it('merges rig and animation into an all-in-one workspace with active canvas and timeline', () => {
    // Mode switcher buttons must have Rig & Animation and Slicer
    const modeBtns = container.querySelectorAll('.studio-mode-btn');
    expect(modeBtns.length).toBe(2);
    expect(modeBtns[0].textContent).toContain('Rig & Animation');
    expect(modeBtns[1].textContent).toContain('Slicer');

    // Both rig viewport and timeline dock must be active in rig mode
    const rigViewport = container.querySelector('#rig-viewport-container') as HTMLElement;
    const timelineContainer = container.querySelector('#animation-timeline-container') as HTMLElement;
    expect(rigViewport.style.display).toBe('block');
    expect(timelineContainer.style.display).toBe('flex');
    expect(rigViewport.style.bottom).toBe('220px');

    // Toggle timeline visibility collapses timeline dock and expands canvas
    app.toggleTimelineVisibility();
    expect(app.getIsTimelineVisible()).toBe(false);
    expect(rigViewport.style.bottom).toBe('0px');
    expect(timelineContainer.style.display).toBe('none');

    // Toggle back
    app.toggleTimelineVisibility();
    expect(app.getIsTimelineVisible()).toBe(true);
    expect(rigViewport.style.bottom).toBe('220px');
    expect(timelineContainer.style.display).toBe('flex');
  });

  it('supports adjustable side panels widths and bottom timeline height with persistence', () => {
    // Verify splitter elements exist in the DOM
    const resizerLeft = container.querySelector('#resizer-left');
    const resizerRight = container.querySelector('#resizer-right');
    const resizerBottom = container.querySelector('#resizer-bottom');
    expect(resizerLeft).not.toBeNull();
    expect(resizerRight).not.toBeNull();
    expect(resizerBottom).not.toBeNull();

    const leftSidebar = container.querySelector('#left-sidebar') as HTMLElement;
    const rightSidebar = container.querySelector('#right-sidebar') as HTMLElement;
    const timelineContainer = container.querySelector('#animation-timeline-container') as HTMLElement;
    const rigViewport = container.querySelector('#rig-viewport-container') as HTMLElement;

    // Adjust left sidebar width
    expect(app.getLeftSidebarWidth()).toBe(240);
    app.setLeftSidebarWidth(320);
    expect(app.getLeftSidebarWidth()).toBe(320);
    expect(leftSidebar.style.width).toBe('320px');

    // Clamps left sidebar width
    app.setLeftSidebarWidth(50);
    expect(app.getLeftSidebarWidth()).toBe(160);
    app.setLeftSidebarWidth(1000);
    expect(app.getLeftSidebarWidth()).toBe(600);

    // Adjust right sidebar width
    expect(app.getRightSidebarWidth()).toBe(260);
    app.setRightSidebarWidth(380);
    expect(app.getRightSidebarWidth()).toBe(380);
    expect(rightSidebar.style.width).toBe('380px');

    // Clamps right sidebar width
    app.setRightSidebarWidth(50);
    expect(app.getRightSidebarWidth()).toBe(180);
    app.setRightSidebarWidth(1200);
    expect(app.getRightSidebarWidth()).toBe(700);

    // Adjust timeline height
    expect(app.getTimelineHeight()).toBe(220);
    expect(resizerBottom.querySelector('.resizer-grip-h')).not.toBeNull();
    app.setTimelineHeight(280);
    expect(app.getTimelineHeight()).toBe(280);
    expect(timelineContainer.style.height).toBe('280px');
    expect(rigViewport.style.bottom).toBe('280px');

    // Clamps timeline height
    app.setTimelineHeight(30);
    expect(app.getTimelineHeight()).toBe(90);

    // Double-click resizer resets timeline to 220px
    resizerBottom.dispatchEvent(new MouseEvent('dblclick'));
    expect(app.getTimelineHeight()).toBe(220);
    expect(timelineContainer.style.height).toBe('220px');

    // Toolbar height preset buttons
    const btnHeightL = container.querySelector('.btn-timeline-height-l') as HTMLElement | null;
    btnHeightL?.click();
    expect(app.getTimelineHeight()).toBe(360);
    expect(timelineContainer.style.height).toBe('360px');

    const btnHeightS = container.querySelector('.btn-timeline-height-s') as HTMLElement | null;
    btnHeightS?.click();
    expect(app.getTimelineHeight()).toBe(140);
    expect(timelineContainer.style.height).toBe('140px');
  });
});
