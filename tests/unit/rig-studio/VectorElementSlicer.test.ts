import { describe, it, expect, beforeEach } from 'vitest';
import { VectorElementSlicer } from '../../../src/rig-studio/slicer/VectorElementSlicer';
import { VectorOutlineElement } from '../../../src/rig-studio/types';

describe('VectorElementSlicer - Polygon Editing Tools', () => {
  let container: HTMLElement;
  let slicer: VectorElementSlicer;

  const sampleElement: VectorOutlineElement = {
    id: 'test_elem_1',
    name: 'arm_sample',
    polygon: [
      { x: 10, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 100 },
      { x: 10, y: 100 }
    ],
    bounds: { x: 10, y: 10, width: 90, height: 90 },
    pivot: { x: 45, y: 45 },
    deformationMode: 'cutout'
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    slicer = new VectorElementSlicer(container);
    slicer.setElements([JSON.parse(JSON.stringify(sampleElement))]);
    slicer.selectElement('test_elem_1');
  });

  it('adds a node along the closest edge of the selected polygon', () => {
    // Top edge goes from (10, 10) to (100, 10)
    const success = slicer.addNodeAtPoint(50, 12);
    expect(success).toBe(true);

    const elem = slicer.getSelectedElement();
    expect(elem?.polygon.length).toBe(5);
    expect(elem?.polygon[1]).toEqual({ x: 50, y: 10 });
  });

  it('deletes selected node while preserving element structure (requires at least 3 nodes)', () => {
    slicer.addNodeAtPoint(50, 12);
    expect(slicer.getSelectedElement()?.polygon.length).toBe(5);

    slicer.selectVertex(1);
    expect(slicer.getSelectedVertexIndex()).toBe(1);

    const deleted = slicer.deleteSelectedNode();
    expect(deleted).toBe(true);
    expect(slicer.getSelectedElement()?.polygon.length).toBe(4);

    // Delete down to 3 nodes
    slicer.deleteNodeAtIndex(0);
    expect(slicer.getSelectedElement()?.polygon.length).toBe(3);

    // Trying to delete below 3 nodes should fail
    const cannotDelete = slicer.deleteNodeAtIndex(0);
    expect(cannotDelete).toBe(false);
    expect(slicer.getSelectedElement()?.polygon.length).toBe(3);
  });

  it('splits selected element into two separate elements using knife cut line', () => {
    // Cut down the vertical line at x = 55
    const success = slicer.splitSelectedElement({ x: 55, y: 0 }, { x: 55, y: 120 });
    expect(success).toBe(true);

    const elements = slicer.getElements();
    expect(elements.length).toBe(2);

    const [partA, partB] = elements;
    expect(partA.polygon.length).toBeGreaterThanOrEqual(3);
    expect(partB.polygon.length).toBeGreaterThanOrEqual(3);

    // Part A and Part B have valid bounding boxes
    expect(partA.bounds.width).toBeGreaterThan(0);
    expect(partB.bounds.width).toBeGreaterThan(0);
  });

  it('smooths selected element using Chaikin algorithm', () => {
    const success = slicer.smoothSelectedElement(1);
    expect(success).toBe(true);

    const elem = slicer.getSelectedElement();
    expect(elem?.polygon.length).toBe(8); // 4 corners * 2
  });

  it('subdivides selected element by adding midpoints to all edges', () => {
    const success = slicer.subdivideSelectedElement();
    expect(success).toBe(true);

    const elem = slicer.getSelectedElement();
    expect(elem?.polygon.length).toBe(8);
  });

  it('simplifies selected element using Douglas-Peucker reduction', () => {
    // Subdivide first to create dense nodes
    slicer.subdivideSelectedElement();
    expect(slicer.getSelectedElement()?.polygon.length).toBe(8);

    // Simplify flat rectangular edges
    const success = slicer.simplifySelectedElement(2.0);
    expect(success).toBe(true);
    expect(slicer.getSelectedElement()?.polygon.length).toBeLessThanOrEqual(5);
  });
});
