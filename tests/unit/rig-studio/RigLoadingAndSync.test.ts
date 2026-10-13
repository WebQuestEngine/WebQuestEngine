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
});
