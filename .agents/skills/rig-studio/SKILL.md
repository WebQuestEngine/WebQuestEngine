---
name: rig-studio
description: >-
  Expert domain guidance and procedures for developing, debugging, and modifying
  the Character Rig Studio (src/rig-studio/), including 2D anatomical skeletal rigs,
  forward kinematics, rest/preview joints, bone layer ordering, spritesheet slicing,
  marching squares polygon tracing, timeline keyframing, and interactive sandbox preview.
---

# Character Rig Studio Agent & Domain Guide

Use this skill when working on Character Rig Studio features, bug fixes, or math calculations in `src/rig-studio/`.

---

## 1. Domain Structure

```
src/rig-studio/
├── RigStudioApp.ts          # Main orchestrator: views, menu actions, state restoration
├── RigStudioBridge.ts       # Typed bridge communicating with main game editor
├── types.ts                 # Bone, Joint, Keyframe, Sheet, and Slicer interfaces
├── rigging/
│   ├── AnatomicalRig.ts     # Bone hierarchy tree, standard rest coords, layer stack
│   ├── PoseRigManager.ts    # Multi-view direction manager (front, back, left, right)
│   └── RigStudioCanvas.ts   # Canvas rendering for bones, attachment polygons, meshes
├── slicer/                  # Marching squares contour extraction & automatic slicing
├── timeline/                # Keyframe timeline, track management, interpolation
└── preview/
    └── InteractiveSandbox.ts # Live testing sandbox with WASD / click-to-walk
```

---

## 2. Critical Mathematical & Architectural Rules

### 1. Coordinate System & Ground Origin
- Character origin `(0, 0)` is strictly located at ground level between the character's feet.
- Character height default reference is ~380px.
- X < 0 is screen-left, X > 0 is screen-right.

### 2. View Perspectives & Limb Flipping (`PoseRigManager.ts`)
- **Front View**: Character's RIGHT limbs appear on screen-LEFT (X < 0); Character's LEFT limbs appear on screen-RIGHT (X > 0).
- **Back View**: Coordinates flip perspective so character's RIGHT limbs appear on screen-RIGHT.
- Always check view transformations before calculating bone rotations or attachments.

### 3. Bone Layer Stacking Order
- Bones are rendered in a deterministic bottom-to-top order specified in `AnatomicalRig.ts` (`DEFAULT_BONE_LAYER_ORDER`).
- Example: Back limbs and accessories must render beneath the torso, while chest and foreground arms render on top.
- Whenever updating bone definitions, ensure layer indices match `tests/unit/rig-studio/BoneLayerOrdering.test.ts`.

### 4. Headless Testing
- All rig calculations (layer ordering, joint transforms, polygon bounding boxes, marching squares) must be testable in Node without requiring an active browser or canvas backend.

---

## 3. Verification Workflow

When making changes to Rig Studio:
1. Run the rig-specific unit test suites:
   ```bash
   npx vitest run tests/unit/rig-studio/
   ```
2. Run full test verification:
   ```bash
   npm test
   ```
3. Verify type compilation:
   ```bash
   npm run build
   ```
