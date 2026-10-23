import { describe, it, expect, vi } from 'vitest';
import { RigStudioStore } from '../../../src/rig-studio/state/RigStudioStore';

describe('RigStudioStore', () => {
  it('initializes with default views and standard joint positions', () => {
    const store = new RigStudioStore();

    expect(store.getCharacterName()).toBe('Character');
    expect(store.getActiveView()).toBe('front');

    const views = store.getViews();
    expect(views.front).toBeDefined();
    expect(views.back).toBeDefined();
    expect(views.left).toBeDefined();
    expect(views.right).toBeDefined();

    expect(views.front.joints.head.y).toBeLessThan(views.front.joints.chest.y);
    expect(views.front.joints.chest.y).toBeLessThan(views.front.joints.hip_l.y);
    expect(views.front.boneOrder?.length).toBeGreaterThan(10);
  });

  it('notifies subscribers on state mutations', () => {
    const store = new RigStudioStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.setCharacterName('Sir Roland');

    expect(listener).toHaveBeenCalled();
    expect(store.getCharacterName()).toBe('Sir Roland');

    unsubscribe();
    store.setCharacterName('Master Eldrin');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getCharacterName()).toBe('Master Eldrin');
  });

  it('handles pose lifecycle: create, duplicate, duplicateAndMirror, and delete', () => {
    const store = new RigStudioStore();

    // Create Pose
    const poseId = store.createPose('Three Quarter Left', 'front', false);
    expect(poseId).toBe('three_quarter_left');
    expect(store.getActiveView()).toBe('three_quarter_left');
    expect(store.getView('three_quarter_left')?.label).toBe('Three Quarter Left');

    // Duplicate Pose
    const copyId = store.duplicatePose('three_quarter_left');
    expect(copyId).toBe('three_quarter_left_copy');
    expect(store.getView(copyId)?.label).toBe('Three Quarter Left (Copy)');

    // Duplicate and Mirror Pose
    const mirrorId = store.duplicateAndMirrorPose('three_quarter_left');
    expect(mirrorId).toBeDefined();
    expect(store.getView(mirrorId)?.label).toContain('Right');

    // Reserved poses cannot be deleted
    expect(store.deletePose('front')).toBe(false);

    // Custom poses can be deleted
    store.switchView(poseId);
    expect(store.deletePose(poseId)).toBe(true);
    expect(store.getView(poseId)).toBeUndefined();
    expect(store.getActiveView()).toBe('front');
  });

  it('manages bone layer ordering (move up, move down, move to top/bottom)', () => {
    const store = new RigStudioStore();
    const orderBefore = store.getBoneOrder('front');
    const firstBone = orderBefore[0];
    const lastBone = orderBefore[orderBefore.length - 1];

    // Cannot move bottom bone down
    expect(store.moveBoneDown('front', firstBone)).toBe(false);

    // Move first bone up
    expect(store.moveBoneUp('front', firstBone)).toBe(true);
    expect(store.getBoneOrder('front')[1]).toBe(firstBone);

    // Move first bone to top
    expect(store.moveBoneToTop('front', firstBone)).toBe(true);
    const orderAfterTop = store.getBoneOrder('front');
    expect(orderAfterTop[orderAfterTop.length - 1]).toBe(firstBone);

    // Move bone to bottom
    expect(store.moveBoneToBottom('front', firstBone)).toBe(true);
    expect(store.getBoneOrder('front')[0]).toBe(firstBone);
  });

  it('synchronizes facial rig modes across all views', () => {
    const store = new RigStudioStore();

    store.setCommonEyeMode('sclera_window');
    expect(store.getCommonEyeMode()).toBe('sclera_window');
    expect(store.getView('front')?.facialRig?.eyes?.mode).toBe('sclera_window');
    expect(store.getView('left')?.facialRig?.eyes?.mode).toBe('sclera_window');

    store.setCommonMouthMode('viseme_library');
    expect(store.getCommonMouthMode()).toBe('viseme_library');
    expect(store.getView('front')?.facialRig?.mouth?.mode).toBe('viseme_library');
  });

  it('manages animation clips: create, rename, duplicate, and delete', () => {
    const store = new RigStudioStore();

    store.createAnimation('run', ['front', 'left'], 0.8);
    expect(store.getAnimations().run).toBeDefined();
    expect(store.getActiveAnimationName()).toBe('run');
    expect(store.getAnimations().run.tracks.front?.duration).toBe(0.8);

    // Duplicate
    const dupName = store.duplicateAnimation('run');
    expect(dupName).toBe('run_copy');
    expect(store.getAnimations().run_copy).toBeDefined();

    // Rename
    expect(store.renameAnimation('run_copy', 'sprint')).toBe(true);
    expect(store.getAnimations().sprint).toBeDefined();
    expect(store.getAnimations().run_copy).toBeUndefined();

    // Delete
    expect(store.deleteAnimation('sprint')).toBe(true);
    expect(store.getAnimations().sprint).toBeUndefined();
  });

  it('records history and supports undo and redo', () => {
    const store = new RigStudioStore();

    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);

    store.createPose('Action Pose');
    expect(store.canUndo).toBe(true);
    expect(store.getActiveView()).toBe('action_pose');

    // Undo pose creation
    expect(store.undo()).toBe(true);
    expect(store.getView('action_pose')).toBeUndefined();
    expect(store.canRedo).toBe(true);

    // Redo pose creation
    expect(store.redo()).toBe(true);
    expect(store.getView('action_pose')).toBeDefined();
  });

  it('serializes and deserializes rig project data cleanly', () => {
    const store = new RigStudioStore();
    store.setCharacterName('Lady Gwendolyn');
    store.createPose('Jump');
    store.setCommonEyeMode('sprite_swap');

    const projectData = store.buildRigProjectData();
    expect(projectData.format).toBe('questforge-rig-project');
    expect(projectData.characterName).toBe('Lady Gwendolyn');
    expect(projectData.views.jump).toBeDefined();
    expect(projectData.commonEyeMode).toBe('sprite_swap');

    const newStore = new RigStudioStore();
    newStore.loadRigProjectData(projectData);

    expect(newStore.getCharacterName()).toBe('Lady Gwendolyn');
    expect(newStore.getView('jump')).toBeDefined();
    expect(newStore.getCommonEyeMode()).toBe('sprite_swap');
  });
});
