import { describe, it, expect, beforeEach } from 'vitest';
import { KeyframeTimeline } from '../../../src/rig-studio/timeline/KeyframeTimeline';
import { getDefaultJointPositions } from '../../../src/rig-studio/rigging/AnatomicalRig';
import { StudioAnimationDefinition } from '../../../src/rig-studio/types';

describe('KeyframeTimeline - Copy, Paste, Close Cycle and Kinematics', () => {
  let container: HTMLDivElement;
  let restJoints: any;
  let animations: Record<string, StudioAnimationDefinition>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    restJoints = getDefaultJointPositions('front', 200, 400);

    animations = {
      walk: {
        name: 'walk',
        relevantSides: ['front', 'left', 'right'],
        tracks: {
          front: {
            duration: 1.0,
            keyframes: [
              {
                time: 0.0,
                name: 'Contact L',
                joints: {
                  ...restJoints,
                  foot_l: { x: restJoints.foot_l.x + 20, y: restJoints.foot_l.y - 10 }
                }
              },
              {
                time: 0.5,
                name: 'Pass L',
                joints: {
                  ...restJoints,
                  foot_l: { x: restJoints.foot_l.x - 15, y: restJoints.foot_l.y }
                }
              }
            ]
          }
        }
      }
    };
  });

  it('copies and pastes keyframes across timestamps', () => {
    let pastedTime: number | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onKeyframePasted: (t) => {
          pastedTime = t;
        }
      }
    );

    // Copy the keyframe at index 0 (time 0.0s)
    const copied = timeline.copyKeyframe(0);
    expect(copied).toBe(true);

    const clipboard = KeyframeTimeline.getClipboard();
    expect(clipboard).toBeDefined();
    expect(clipboard?.name).toBe('Contact L');
    expect(clipboard?.joints.foot_l.x).toBe(restJoints.foot_l.x + 20);

    // Set playhead time to 0.75s and paste
    timeline.setTime(0.75);
    const pasted = timeline.pasteKeyframe();
    expect(pasted).toBe(true);
    expect(pastedTime).toBe(0.75);

    const track = animations.walk.tracks.front!;
    expect(track.keyframes.length).toBe(3);
    const kfAt75 = track.keyframes.find(k => Math.abs(k.time - 0.75) < 0.01);
    expect(kfAt75).toBeDefined();
    expect(kfAt75?.joints.foot_l.x).toBe(restJoints.foot_l.x + 20);

    timeline.destroy();
  });

  it('closes walk cycle loop by copying 0.00s initial pose to duration end', () => {
    let closedDuration: number | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onCycleClosed: (dur) => {
          closedDuration = dur;
        }
      }
    );

    const track = animations.walk.tracks.front!;
    expect(track.keyframes.length).toBe(2);

    // Close the cycle
    const closed = timeline.closeCycle();
    expect(closed).toBe(true);
    expect(closedDuration).toBe(1.0);

    // Track should now have keyframe at 1.0s matching initial 0.00s contact pose
    expect(track.keyframes.length).toBe(3);
    const endKey = track.keyframes.find(k => Math.abs(k.time - 1.0) < 0.01);
    expect(endKey).toBeDefined();
    expect(endKey?.name).toContain('Contact L');
    expect(endKey?.joints.foot_l.x).toBe(track.keyframes[0].joints.foot_l.x);
    expect(endKey?.joints.foot_l.y).toBe(track.keyframes[0].joints.foot_l.y);

    timeline.destroy();
  });

  it('manages Kinematics Mode (IK / FK) toggle and notification', () => {
    let modeNotified: string | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onKinematicsModeChanged: (mode) => {
          modeNotified = mode;
        }
      }
    );

    expect(timeline.getKinematicsMode()).toBe('ik');

    timeline.setKinematicsMode('fk');
    expect(timeline.getKinematicsMode()).toBe('fk');

    timeline.setKinematicsMode('ik');
    expect(timeline.getKinematicsMode()).toBe('ik');

    timeline.destroy();
  });

  it('moves keyframes across the timeline and triggers onKeyframeMoved', () => {
    let movedResult: { index: number; oldTime: number; newTime: number } | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onKeyframeMoved: (index, oldTime, newTime) => {
          movedResult = { index, oldTime, newTime };
        }
      }
    );

    const track = animations.walk.tracks.front!;
    expect(track.keyframes[1].time).toBe(0.5);

    // Move keyframe at index 1 (0.5s) to 0.8s
    const moved = timeline.moveKeyframe(1, 0.8);
    expect(moved).toBe(true);
    expect(movedResult).toEqual({ index: 1, oldTime: 0.5, newTime: 0.8 });
    expect(track.keyframes[1].time).toBe(0.8);

    // Test moving past keyframe 0 to verify sorting
    timeline.moveKeyframe(1, 0.0);
    expect(track.keyframes[0].time).toBe(0.0);

    timeline.destroy();
  });

  it('sets animation timeline length and triggers onDurationChanged', () => {
    let notifiedDuration: number | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onDurationChanged: (d) => {
          notifiedDuration = d;
        }
      }
    );

    expect(timeline.getDuration()).toBe(1.0);

    timeline.setDuration(1.6);
    expect(timeline.getDuration()).toBe(1.6);
    expect(notifiedDuration).toBe(1.6);
    expect(animations.walk.tracks.front?.duration).toBe(1.6);

    // Clamps to min 0.1s
    timeline.setDuration(0.01);
    expect(timeline.getDuration()).toBe(0.1);

    timeline.destroy();
  });

  it('handles timeline zoom in, zoom out, and reset zoom', () => {
    let notifiedZoom: number | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onZoomChanged: (z) => {
          notifiedZoom = z;
        }
      }
    );

    expect(timeline.getZoom()).toBe(1.0);

    timeline.zoomIn();
    expect(timeline.getZoom()).toBe(1.5);
    expect(notifiedZoom).toBe(1.5);

    timeline.zoomOut();
    expect(timeline.getZoom()).toBe(1.0);

    timeline.setZoom(3.0);
    expect(timeline.getZoom()).toBe(3.0);

    timeline.resetZoom();
    expect(timeline.getZoom()).toBe(1.0);

    // Clamped between 0.5 and 5.0
    timeline.setZoom(10.0);
    expect(timeline.getZoom()).toBe(5.0);

    timeline.setZoom(0.1);
    expect(timeline.getZoom()).toBe(0.5);

    timeline.destroy();
  });

  it('manages collapsible element tracks and body groups', () => {
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints
    );

    // Verify elements container was rendered
    const elContainer = container.querySelector('.timeline-element-tracks-container');
    expect(elContainer).not.toBeNull();

    // Verify group rows exist
    const groupRows = container.querySelectorAll('.timeline-group-row');
    expect(groupRows.length).toBeGreaterThan(0);

    // Verify element rows exist
    const elementRows = container.querySelectorAll('.timeline-element-row');
    expect(elementRows.length).toBeGreaterThan(0);

    // Collapse all element groups
    timeline.collapseAllElementGroups();
    const rowsAfterCollapse = container.querySelectorAll('.timeline-element-row');
    expect(rowsAfterCollapse.length).toBe(0);

    // Expand all element groups
    timeline.expandAllElementGroups();
    const rowsAfterExpand = container.querySelectorAll('.timeline-element-row');
    expect(rowsAfterExpand.length).toBeGreaterThan(0);

    // Toggle single group
    timeline.toggleElementGroup('spine', false);
    timeline.toggleElementTracks(false);
    expect(container.querySelectorAll('.timeline-element-row').length).toBe(0);

    timeline.destroy();
  });

  describe('Fine-Tuned Per-Track Keyframe Editing, Multi-Select, and Rubberband', () => {
    it('adds keyframes to specific joint tracks without forcing full-body keying', () => {
      let notifiedJoint: string | undefined;
      const timeline = new KeyframeTimeline(
        container,
        animations,
        'walk',
        'front',
        restJoints,
        {
          onKeyframeAdded: (_time, _joints, jointId) => {
            notifiedJoint = jointId;
          }
        }
      );

      const track = animations.walk.tracks.front!;
      const initialCount = track.keyframes.length;

      // Add a keyframe specifically to knee_r at 0.35s
      timeline.addTrackKeyframe('knee_r', { x: 150, y: 320 }, 0.35);

      expect(notifiedJoint).toBe('knee_r');
      expect(track.keyframes.length).toBe(initialCount + 1);

      const trackKey = track.keyframes.find(k => Math.abs(k.time - 0.35) < 0.01);
      expect(trackKey).toBeDefined();
      expect(trackKey?.joints.knee_r).toEqual({ x: 150, y: 320 });
      // Only knee_r should be present on this track-specific keyframe
      expect(trackKey?.joints.foot_l).toBeUndefined();

      timeline.destroy();
    });

    it('interpolates each joint independently across its own keyed timestamps', () => {
      const trackKeyframes = [
        {
          time: 0.0,
          joints: {
            foot_l: { x: 100, y: 400 },
            knee_r: { x: 200, y: 300 }
          }
        },
        {
          time: 0.4,
          joints: {
            knee_r: { x: 220, y: 320 } // only knee_r keyed here
          }
        },
        {
          time: 1.0,
          joints: {
            foot_l: { x: 150, y: 400 },
            knee_r: { x: 200, y: 300 }
          }
        }
      ];

      animations.walk.tracks.front!.keyframes = trackKeyframes as any;

      const timeline = new KeyframeTimeline(
        container,
        animations,
        'walk',
        'front',
        restJoints
      );

      // At t=0.2s:
      // foot_l should interpolate between 0.0s (100) and 1.0s (150) -> ~110
      // knee_r should interpolate between 0.0s (200) and 0.4s (220) -> ~210
      timeline.setTime(0.2);
      const posed = timeline.getCurrentPose();

      expect(posed.foot_l.x).toBeCloseTo(105.2, 1);
      expect(posed.knee_r.x).toBeCloseTo(210, 0);

      // At t=0.7s:
      // foot_l: alpha=0.7 with smooth easing -> ~139.2
      // knee_r: alpha=0.5 between 0.4s (220) and 1.0s (200) -> 210
      timeline.setTime(0.7);
      const posedLater = timeline.getCurrentPose();

      expect(posedLater.foot_l.x).toBeCloseTo(139.2, 1);
      expect(posedLater.knee_r.x).toBeCloseTo(210, 0);

      timeline.destroy();
    });

    it('supports multi-selection and select-all across various tracks', () => {
      let notifiedCount = 0;
      const timeline = new KeyframeTimeline(
        container,
        animations,
        'walk',
        'front',
        restJoints,
        {
          onSelectionChanged: (count) => {
            notifiedCount = count;
          }
        }
      );

      // Add track keyframes
      timeline.addTrackKeyframe('knee_r', { x: 110, y: 300 }, 0.2);
      timeline.addTrackKeyframe('hand_l', { x: 80, y: 220 }, 0.4);

      expect(timeline.getSelectedKeyframeKeys().length).toBeGreaterThan(0);

      // Clear selection
      timeline.clearSelection();
      expect(timeline.getSelectedKeyframeKeys().length).toBe(0);

      // Select all keyframes
      timeline.selectAllKeyframes();
      const allKeys = timeline.getSelectedKeyframeKeys();
      expect(allKeys.length).toBeGreaterThanOrEqual(4);
      expect(notifiedCount).toBe(allKeys.length);

      timeline.destroy();
    });

    it('copies and pastes multi-selected track keys preserving relative timing', () => {
      const timeline = new KeyframeTimeline(
        container,
        animations,
        'walk',
        'front',
        restJoints
      );

      const track = animations.walk.tracks.front!;
      track.keyframes = [];

      // Add two keys on different tracks with 0.2s offset
      timeline.addTrackKeyframe('knee_r', { x: 150, y: 300 }, 0.1);
      timeline.addTrackKeyframe('hand_r', { x: 90, y: 210 }, 0.3);

      // Select both track keys specifically
      timeline.clearSelection();
      (timeline as any).selectedKeyframeKeys.add('joint:knee_r:0.100');
      (timeline as any).selectedKeyframeKeys.add('joint:hand_r:0.300');
      expect(timeline.getSelectedKeyframeKeys().length).toBe(2);

      // Copy multi-selection
      const copied = timeline.copyKeyframe();
      expect(copied).toBe(true);

      // Move playhead to 0.6s and paste
      timeline.setTime(0.6);
      const pasted = timeline.pasteKeyframe();
      expect(pasted).toBe(true);

      // Keyframes should now include keys at 0.6s (knee_r) and 0.8s (hand_r)
      const kfAt06 = track.keyframes.find(k => Math.abs(k.time - 0.6) < 0.01);
      const kfAt08 = track.keyframes.find(k => Math.abs(k.time - 0.8) < 0.01);

      expect(kfAt06).toBeDefined();
      expect(kfAt06?.joints.knee_r).toEqual({ x: 150, y: 300 });

      expect(kfAt08).toBeDefined();
      expect(kfAt08?.joints.hand_r).toEqual({ x: 90, y: 210 });

      timeline.destroy();
    });

    it('deletes specific track keyframes without deleting other joints at the same timestamp', () => {
      const timeline = new KeyframeTimeline(
        container,
        animations,
        'walk',
        'front',
        restJoints
      );

      const track = animations.walk.tracks.front!;
      track.keyframes = [
        {
          time: 0.5,
          joints: {
            knee_r: { x: 120, y: 300 },
            hand_l: { x: 80, y: 200 }
          }
        }
      ];

      // Re-render to generate DOM markers
      timeline.renderElementTracks();

      // Multi-select only the knee_r marker at 0.5s
      timeline.clearSelection();
      const kneeKeyId = 'joint:knee_r:0.500';
      timeline.selectAllKeyframes();
      // Remove all except kneeKeyId
      timeline.clearSelection();
      // Directly select knee_r key
      (timeline as any).selectedKeyframeKeys.add(kneeKeyId);

      // Delete selected
      const deleted = timeline.deleteSelectedKeyframes();
      expect(deleted).toBe(true);

      // The keyframe at 0.5s should still exist with hand_l intact, but knee_r removed!
      expect(track.keyframes.length).toBe(1);
      expect(track.keyframes[0].joints.knee_r).toBeUndefined();
      expect(track.keyframes[0].joints.hand_l).toEqual({ x: 80, y: 200 });

      // Now delete hand_l at 0.5s -> keyframe should be removed completely
      const handKeyId = 'joint:hand_l:0.500';
      (timeline as any).selectedKeyframeKeys.add(handKeyId);
      timeline.deleteSelectedKeyframes();
      expect(track.keyframes.length).toBe(0);

      timeline.destroy();
    });

    it('handles rubberband marquee selection element creation and destruction', () => {
      const timeline = new KeyframeTimeline(
        container,
        animations,
        'walk',
        'front',
        restJoints
      );

      const tracksList = container.querySelector('.timeline-tracks-list') as HTMLElement;
      expect(tracksList).not.toBeNull();

      // Trigger mousedown on empty tracks list to start rubberband
      const downEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        bubbles: true
      });
      tracksList.dispatchEvent(downEvent);

      const rubberbandEl = document.querySelector('.timeline-rubberband-box') as HTMLElement;
      expect(rubberbandEl).not.toBeNull();
      expect(rubberbandEl.style.display).toBe('block');

      // Trigger mousemove
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 300,
        clientY: 250,
        bubbles: true
      });
      window.dispatchEvent(moveEvent);

      expect(rubberbandEl.style.width).toBe('200px');
      expect(rubberbandEl.style.height).toBe('150px');

      // Trigger mouseup
      const upEvent = new MouseEvent('mouseup', {
        clientX: 300,
        clientY: 250,
        bubbles: true
      });
      window.dispatchEvent(upEvent);

      expect(rubberbandEl.style.display).toBe('none');

      timeline.destroy();
      expect(document.querySelector('.timeline-rubberband-box')).toBeNull();
    });
  });
});


