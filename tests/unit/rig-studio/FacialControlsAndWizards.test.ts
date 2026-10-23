import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  openEyeSetupWizard,
  openMouthSetupWizard,
  showModeChangeWarningModal,
  EYE_MODE_DESCRIPTIONS,
  MOUTH_MODE_DESCRIPTIONS
} from '../../../src/rig-studio/dialogs/FacialSetupWizard';
import { KeyframeTimeline, interpolateFacialPose } from '../../../src/rig-studio/timeline/KeyframeTimeline';
import { RigStudioApp } from '../../../src/rig-studio/RigStudioApp';
import { FacialPoseData, EyeRigConfig, MouthRigConfig } from '../../../src/rig-studio/types';

describe('Facial Controls & Setup Wizards', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('FacialSetupWizard - Eye & Mouth Setup Wizards', () => {
    it('renders Eye Setup Wizard with all 3 architecture modes and description cards', () => {
      let savedConfig: EyeRigConfig | null = null;
      openEyeSetupWizard({
        slicedParts: [
          { id: 'part_eye_open', name: 'Eye Open' },
          { id: 'part_eye_closed', name: 'Eye Closed' }
        ],
        onSave: (cfg) => {
          savedConfig = cfg;
        }
      });

      const modal = document.querySelector('.wizard-modal');
      expect(modal).not.toBeNull();
      expect(modal?.textContent).toContain('Eye Rig Setup Wizard');

      const modeCards = modal?.querySelectorAll('.wizard-mode-card');
      expect(modeCards?.length).toBe(3);

      // Verify descriptions match technical proposal
      expect(modal?.textContent).toContain('Frame-by-Frame Sprite Swap');
      expect(modal?.textContent).toContain('Sclera Window Clipping Mask');
      expect(modal?.textContent).toContain('Procedural Vector Eyes');

      // Click Skip Wizard to test skip button
      const skipBtn = modal?.querySelector('.btn-wizard-skip') as HTMLButtonElement;
      expect(skipBtn).not.toBeNull();
      skipBtn.click();

      // Modal closed and savedConfig is generated
      expect(document.querySelector('.wizard-modal')).toBeNull();
      expect(savedConfig).not.toBeNull();
      expect(savedConfig?.mode).toBe('sclera_window');
    });

    it('navigates Eye Setup Wizard through steps to bind slots and finish', () => {
      let savedConfig: EyeRigConfig | null = null;
      openEyeSetupWizard({
        slicedParts: [
          { id: 'sclera_1', name: 'Sclera Base' },
          { id: 'pupil_1', name: 'Eye Pupil' },
          { id: 'lid_1', name: 'Upper Eyelid' }
        ],
        onSave: (cfg) => {
          savedConfig = cfg;
        }
      });

      let modal = document.querySelector('.wizard-modal');
      // Select Mode 2: Sclera Window
      const scleraCard = modal?.querySelector('[data-mode="sclera_window"]') as HTMLElement;
      scleraCard.click();

      // Next step
      modal = document.querySelector('.wizard-modal');
      const nextBtn = modal?.querySelector('.btn-wizard-next') as HTMLButtonElement;
      nextBtn.click();

      modal = document.querySelector('.wizard-modal');
      expect(modal?.textContent).toContain('Step 2 of 2');

      // Finish wizard
      const finishBtn = modal?.querySelector('.btn-wizard-finish') as HTMLButtonElement;
      finishBtn.click();

      expect(savedConfig).not.toBeNull();
      expect(savedConfig?.mode).toBe('sclera_window');
    });

    it('renders Mouth Setup Wizard and allows interactive jaw/smile preview calibration', () => {
      let savedConfig: MouthRigConfig | null = null;
      openMouthSetupWizard({
        slicedParts: [
          { id: 'vis_rest', name: 'Mouth Rest' },
          { id: 'vis_smile', name: 'Mouth Smile' }
        ],
        onSave: (cfg) => {
          savedConfig = cfg;
        }
      });

      const modal = document.querySelector('.wizard-modal');
      expect(modal).not.toBeNull();
      expect(modal?.textContent).toContain('Mouth Rig Setup Wizard');

      const modeCards = modal?.querySelectorAll('.wizard-mode-card');
      expect(modeCards?.length).toBe(4);

      // Verify modes
      expect(modal?.textContent).toContain('Sliced Viseme Library');
      expect(modal?.textContent).toContain('Masked Cavity Sandwich');
      expect(modal?.textContent).toContain('Single-Sprite Mesh Warp');
      expect(modal?.textContent).toContain('Procedural Vector Lips');

      // Click Skip
      const skipBtn = modal?.querySelector('.btn-wizard-skip') as HTMLButtonElement;
      skipBtn.click();

      expect(savedConfig).not.toBeNull();
      expect(savedConfig?.mode).toBe('viseme_library');
    });

    it('prompts mode change warning modal when switching between distinct architectures', () => {
      let confirmed = false;
      showModeChangeWarningModal({
        feature: 'Eye Rig',
        currentModeName: 'Sclera Window Clipping Mask',
        targetModeName: 'Frame-by-Frame Sprite Swap',
        onConfirm: () => {
          confirmed = true;
        }
      });

      const modal = document.querySelector('.studio-modal');
      expect(modal).not.toBeNull();
      expect(modal?.textContent).toContain('Warning: Switch Eye Rig Architecture?');
      expect(modal?.textContent).toContain('Reset graphic slot assignments');

      const confirmBtn = modal?.querySelector('.btn-warning-confirm') as HTMLButtonElement;
      confirmBtn.click();

      expect(confirmed).toBe(true);
    });
  });

  describe('KeyframeTimeline - Facial Pose Keyframing & Interpolation', () => {
    it('interpolates scalar facial channels smoothly across timestamps', () => {
      const poseA: FacialPoseData = {
        eyelids_blink_l: 0.0,
        eyelids_blink_r: 0.0,
        eyebrows_height_l: 0,
        lips_open: 0.0,
        lips_smile: 0.0,
        viseme: 'rest'
      };

      const poseB: FacialPoseData = {
        eyelids_blink_l: 1.0,
        eyelids_blink_r: 1.0,
        eyebrows_height_l: 10,
        lips_open: 0.8,
        lips_smile: 0.6,
        viseme: 'smile'
      };

      // Midpoint at t = 0.5
      const keyframes = [
        { time: 0.0, face: poseA },
        { time: 1.0, face: poseB }
      ];
      const mid = interpolateFacialPose(keyframes, 0.5, 1.0);
      expect(mid.eyelids_blink_l).toBeCloseTo(0.5, 2);
      expect(mid.eyelids_blink_r).toBeCloseTo(0.5, 2);
      expect(mid.eyebrows_height_l).toBeCloseTo(5, 1);
      expect(mid.lips_open).toBeCloseTo(0.4, 2);
      expect(mid.lips_smile).toBeCloseTo(0.3, 2);
      expect(mid.viseme).toBe('rest'); // Viseme stays with earlier keyframe until threshold
    });

    it('records and samples facial keyframes on the timeline', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const animations = {
        idle: {
          name: 'idle',
          relevantSides: ['front'],
          tracks: {
            front: {
              duration: 2.0,
              fps: 30,
              keyframes: [
                {
                  time: 0.0,
                  joints: { head: { x: 0, y: -312 }, neck: { x: 0, y: -260 } },
                  face: { eyelids_blink_l: 0, lips_open: 0, viseme: 'rest' }
                },
                {
                  time: 1.0,
                  joints: { head: { x: 0, y: -312 }, neck: { x: 0, y: -260 } },
                  face: { eyelids_blink_l: 1.0, lips_open: 0.5, viseme: 'ah' }
                }
              ]
            }
          }
        }
      };

      const timeline = new KeyframeTimeline(
        container,
        animations,
        'idle',
        'front',
        { head: { x: 0, y: -312 }, neck: { x: 0, y: -260 } } as any
      );

      // Sample at 0.5s
      timeline.setTime(0.5);
      const poseMid = timeline.getCurrentFacialPose();
      expect(poseMid.eyelids_blink_l).toBeCloseTo(0.5, 2);
      expect(poseMid.lips_open).toBeCloseTo(0.25, 2);

      // Add a custom keyframe at 1.5s
      timeline.addFacialKeyframe(1.5, { eyelids_blink_l: 0.2, lips_open: 0.9, viseme: 'oh' });
      timeline.setTime(1.5);
      const pose15 = timeline.getCurrentFacialPose();
      expect(pose15.viseme).toBe('oh');
      expect(pose15.lips_open).toBe(0.9);

      timeline.destroy();
    });
  });

  describe('RigStudioApp - Face Tab & Live Controls', () => {
    it('switches to Face tab and interacts with expression sliders', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = new RigStudioApp(container);
      const rightSidebar = container.querySelector('#right-sidebar') as HTMLElement;
      expect(rightSidebar).not.toBeNull();

      // Click Face tab button
      const faceTabBtn = rightSidebar.querySelector('[data-tab="face"]') as HTMLButtonElement;
      expect(faceTabBtn).not.toBeNull();
      faceTabBtn.click();

      // Verify Face tab content rendered
      expect(rightSidebar.textContent).toContain('Facial Rigging & Controls');
      expect(rightSidebar.querySelector('#btn-open-eye-wizard')).not.toBeNull();
      expect(rightSidebar.querySelector('#btn-open-mouth-wizard')).not.toBeNull();

      // Verify Viseme chips
      const chips = rightSidebar.querySelectorAll('.btn-face-viseme-chip');
      expect(chips.length).toBe(9);

      // Verify expression sliders
      const openSlider = rightSidebar.querySelector('[data-prop="lips_open"]') as HTMLInputElement;
      expect(openSlider).not.toBeNull();
      openSlider.value = '0.75';
      openSlider.dispatchEvent(new Event('input'));

      const openVal = rightSidebar.querySelector('#val-face-lips-open');
      expect(openVal?.textContent).toBe('75%');

      // Verify Face Placement sliders exist and update offsets
      const offXSlider = rightSidebar.querySelector('#inp-face-offset-x') as HTMLInputElement;
      expect(offXSlider).not.toBeNull();
      offXSlider.value = '15';
      offXSlider.dispatchEvent(new Event('input'));
      expect(rightSidebar.querySelector('#val-face-offset-x')?.textContent).toBe('15px');
    });

    it('displays property subtrack keyframes even when keyframe was created at parent joint level', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const animations = {
        idle: {
          name: 'idle',
          relevantSides: ['front'],
          tracks: {
            front: {
              duration: 2.0,
              fps: 30,
              keyframes: [
                {
                  time: 0.0,
                  joints: { head: { x: 10, y: -300 }, neck: { x: 10, y: -250 } }
                },
                {
                  time: 1.0,
                  joints: { head: { x: 25, y: -290 }, neck: { x: 20, y: -245 } }
                }
              ]
            }
          }
        }
      };

      const timeline = new KeyframeTimeline(
        container,
        animations,
        'idle',
        'front',
        { head: { x: 0, y: -300 }, neck: { x: 0, y: -250 } } as any
      );

      // Expand head bone track
      timeline.toggleBoneExpanded('head');
      expect(timeline.isBoneExpanded('head')).toBe(true);

      // Verify that property subtracks (x, y, rotation, scale) contain keyframe markers
      const headSubtracks = container.querySelectorAll('.property-subtrack[data-joint="head"]');
      expect(headSubtracks.length).toBe(4);

      // Subtrack X should show markers at 0.0s and 1.0s
      const xTrack = container.querySelector('.property-subtrack[data-joint="head"][data-prop="x"]');
      const markers = xTrack?.querySelectorAll('.element-key-marker.prop-marker');
      expect(markers?.length).toBe(2);

      timeline.destroy();
    });

    it('allows toggling facial feature visibility across views including back view without hard-coding', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = new RigStudioApp(container);
      const rightSidebar = container.querySelector('#right-sidebar') as HTMLElement;
      (rightSidebar.querySelector('[data-tab="face"]') as HTMLButtonElement).click();

      // Verify view toggle chips exist for front, back, left, right
      const viewChips = rightSidebar.querySelectorAll('.btn-face-view-toggle');
      expect(viewChips.length).toBeGreaterThanOrEqual(4);

      const backChip = Array.from(viewChips).find(b => b.getAttribute('data-view') === 'back') as HTMLButtonElement;
      expect(backChip).not.toBeNull();
      // By default back view is not active
      expect(backChip.classList.contains('active')).toBe(false);

      // Canvas should not have facial view enabled for back by default
      const canvas = (app as any).canvas;
      canvas.setActiveView('back');
      expect(canvas.isFacialViewEnabled()).toBe(false);
      expect(canvas.getFacialWorldCenter()).toBeNull();

      // Click the Back chip to enable facial features on back view
      backChip.click();

      // Back view chip is now active
      const updatedBackChip = rightSidebar.querySelector('.btn-face-view-toggle[data-view="back"]') as HTMLButtonElement;
      expect(updatedBackChip.classList.contains('active')).toBe(true);

      // Canvas now considers back view enabled because user selected it
      expect(canvas.isFacialViewEnabled()).toBe(true);
      expect(canvas.getFacialWorldCenter()).not.toBeNull();
    });

    it('manages N-instances of eyes, mouths, and eyebrows for custom creatures and profile views', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = new RigStudioApp(container);
      const rightSidebar = container.querySelector('#right-sidebar') as HTMLElement;
      (rightSidebar.querySelector('[data-tab="face"]') as HTMLButtonElement).click();

      // Click "Add Eye" button
      const addEyeBtn = rightSidebar.querySelector('#btn-add-eye-instance') as HTMLButtonElement;
      expect(addEyeBtn).not.toBeNull();
      addEyeBtn.click();

      // Expect eye instances cards to exist (default conversion produces 3 eyes)
      let eyeCards = rightSidebar.querySelectorAll('.eye-instance-card');
      expect(eyeCards.length).toBe(3);

      // Verify we can add a 4th eye (N-eyes creature)
      addEyeBtn.click();
      eyeCards = rightSidebar.querySelectorAll('.eye-instance-card');
      expect(eyeCards.length).toBe(4);

      // Adjust 4th eye name and offsets
      const fourthNameInput = eyeCards[3].querySelector('.inp-eye-inst-name') as HTMLInputElement;
      fourthNameInput.value = 'Alien Forehead Eye';
      fourthNameInput.dispatchEvent(new Event('input'));
      expect((app as any).facialRig.eyeInstances[3].name).toBe('Alien Forehead Eye');

      const fourthXInput = eyeCards[3].querySelector('.inp-eye-inst-x') as HTMLInputElement;
      fourthXInput.value = '5';
      fourthXInput.dispatchEvent(new Event('input'));
      expect((app as any).facialRig.eyeInstances[3].offsetX).toBe(5);

      // Set side view filter on 4th eye
      const viewSelect = eyeCards[3].querySelector('.sel-eye-inst-view') as HTMLSelectElement;
      viewSelect.value = 'left';
      viewSelect.dispatchEvent(new Event('change'));
      expect((app as any).facialRig.eyeInstances[3].enabledViews).toEqual(['left']);

      // Add Mouth instance
      const addMouthBtn = rightSidebar.querySelector('#btn-add-mouth-instance') as HTMLButtonElement;
      expect(addMouthBtn).not.toBeNull();
      addMouthBtn.click();

      let mouthCards = rightSidebar.querySelectorAll('.mouth-instance-card');
      expect(mouthCards.length).toBe(2);

      // Add Eyebrow instance
      const addBrowBtn = rightSidebar.querySelector('#btn-add-brow-instance') as HTMLButtonElement;
      expect(addBrowBtn).not.toBeNull();
      addBrowBtn.click();

      let browCards = rightSidebar.querySelectorAll('.brow-instance-card');
      expect(browCards.length).toBe(3);

      // Delete an eye instance
      const delEyeBtn = eyeCards[0].querySelector('.btn-eye-inst-del') as HTMLButtonElement;
      delEyeBtn.click();

      eyeCards = rightSidebar.querySelectorAll('.eye-instance-card');
      expect(eyeCards.length).toBe(3);
    });

    it('ensures each side has its own independent face features, offsets, and visibility while synchronizing common animation mode', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = new RigStudioApp(container);
      const rightSidebar = container.querySelector('#right-sidebar') as HTMLElement;
      (rightSidebar.querySelector('[data-tab="face"]') as HTMLButtonElement).click();

      // 1. Verify Front view face defaults
      expect((app as any).activeView).toBe('front');
      const frontRig = (app as any).facialRig;
      expect(frontRig.offsetX).toBe(0);
      expect(frontRig.eyeInstances.length).toBe(2);
      expect(frontRig.eyeInstances[0].id).toBe('eye_left');
      expect(frontRig.eyeInstances[1].id).toBe('eye_right');

      // Adjust Front face offset X to 25px
      const inpOffX = rightSidebar.querySelector('#inp-face-offset-x') as HTMLInputElement;
      inpOffX.value = '25';
      inpOffX.dispatchEvent(new Event('input'));
      expect((app as any).facialRig.offsetX).toBe(25);
      expect((app as any).views.front.facialRig.offsetX).toBe(25);

      // 2. Switch to Left side view
      app.switchView('left');
      expect((app as any).activeView).toBe('left');
      const leftRig = (app as any).facialRig;

      // Left view has its own independent offset and single profile eye instance
      expect(leftRig.offsetX).toBe(-6);
      expect(leftRig.eyeInstances.length).toBe(1);
      expect(leftRig.eyeInstances[0].name).toContain('Profile');

      // Front view offset was preserved and NOT affected by Left view
      expect((app as any).views.front.facialRig.offsetX).toBe(25);
      expect((app as any).views.front.facialRig.eyeInstances.length).toBe(2);

      // 3. Switch to Back view
      app.switchView('back');
      expect((app as any).activeView).toBe('back');
      const backRig = (app as any).facialRig;

      // Back view face is disabled by default, not hardcoded
      expect(backRig.enabled).toBe(false);
      expect((app as any).canvas.isFacialViewEnabled()).toBe(false);

      // User enables face on Back view via side toggle button
      (rightSidebar.querySelector('[data-tab="face"]') as HTMLButtonElement).click();
      const toggleSideBtn = rightSidebar.querySelector('#btn-toggle-side-face') as HTMLButtonElement;
      expect(toggleSideBtn).not.toBeNull();
      toggleSideBtn.click();

      // Now Back view face is enabled and can have its own customized features
      expect((app as any).facialRig.enabled).toBe(true);
      expect((app as any).views.back.facialRig.enabled).toBe(true);
      expect((app as any).canvas.isFacialViewEnabled()).toBe(true);

      // 4. Test common animation mode synchronization
      // When animation mode is set (e.g. to sclera_window), all sides must sync their animation mode
      app.setCommonEyeMode('sclera_window');
      expect((app as any).commonEyeMode).toBe('sclera_window');
      expect((app as any).views.front.facialRig.eyes.mode).toBe('sclera_window');
      expect((app as any).views.left.facialRig.eyes.mode).toBe('sclera_window');
      expect((app as any).views.right.facialRig.eyes.mode).toBe('sclera_window');
      expect((app as any).views.back.facialRig.eyes.mode).toBe('sclera_window');

      // But their geometric placement and instances remain independent!
      expect((app as any).views.front.facialRig.offsetX).toBe(25);
      expect((app as any).views.front.facialRig.eyeInstances.length).toBe(2);
      expect((app as any).views.left.facialRig.offsetX).toBe(-6);
      expect((app as any).views.left.facialRig.eyeInstances.length).toBe(1);

      // Same for mouth common animation mode
      app.setCommonMouthMode('viseme_library');
      expect((app as any).commonMouthMode).toBe('viseme_library');
      expect((app as any).views.front.facialRig.mouth.mode).toBe('viseme_library');
      expect((app as any).views.left.facialRig.mouth.mode).toBe('viseme_library');
      expect((app as any).views.right.facialRig.mouth.mode).toBe('viseme_library');
      expect((app as any).views.back.facialRig.mouth.mode).toBe('viseme_library');
    });

    it('persists and restores per-side facial rigs and common animation mode via buildRigProjectData and loadRigProjectData', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = new RigStudioApp(container);
      app.switchView('left');
      (app as any).facialRig.offsetX = -18;
      app.syncFacialRigToActiveView();
      app.setCommonEyeMode('sprite_swap');
      app.setCommonMouthMode('cavity_sandwich');

      // Export project data
      const project = app.buildRigProjectData();
      expect(project.views.left.facialRig).toBeDefined();
      expect(project.views.left.facialRig?.offsetX).toBe(-18);
      expect(project.commonEyeMode).toBe('sprite_swap');
      expect(project.commonMouthMode).toBe('cavity_sandwich');

      // Create new instance and load project
      document.body.innerHTML = '';
      const container2 = document.createElement('div');
      document.body.appendChild(container2);
      const app2 = new RigStudioApp(container2);
      app2.loadRigProjectData(project);

      expect((app2 as any).commonEyeMode).toBe('sprite_swap');
      expect((app2 as any).commonMouthMode).toBe('cavity_sandwich');
      expect((app2 as any).views.left.facialRig.offsetX).toBe(-18);
      expect((app2 as any).views.left.facialRig.eyes.mode).toBe('sprite_swap');
      expect((app2 as any).views.front.facialRig.eyes.mode).toBe('sprite_swap');
      expect((app2 as any).views.left.facialRig.mouth.mode).toBe('cavity_sandwich');
    });
  });
});

