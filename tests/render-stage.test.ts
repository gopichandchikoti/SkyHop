// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Stage } from '../src/render/stage';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = document.createElement('canvas');
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

interface FakeRendererShape {
  domElement: HTMLCanvasElement;
  setPixelRatio: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function container(width: number, height: number): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });
  document.body.append(element);
  return element;
}

describe('Stage', () => {
  const handlers = () => ({ onContextLost: vi.fn(), onContextRestored: vi.fn() });

  it('mounts an accessible canvas and sizes the camera to the container', () => {
    const host = container(800, 400);
    const stage = new Stage(host, handlers());
    const renderer = stage.renderer as unknown as FakeRendererShape;
    expect(host.contains(renderer.domElement)).toBe(true);
    expect(renderer.domElement.getAttribute('aria-label')).toBe('SkyHop game view');
    expect(stage.aspect).toBe(2);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    expect(stage.framing.visibleWidth).toBeCloseTo(stage.framing.visibleHeight * 2, 3);
  });

  it('re-frames on resize and survives a zero-sized container', () => {
    const host = container(0, 0);
    const stage = new Stage(host, handlers());
    expect(stage.aspect).toBe(1);
    Object.defineProperty(host, 'clientWidth', { value: 390, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 844, configurable: true });
    stage.resize();
    expect(stage.aspect).toBeCloseTo(390 / 844, 5);
    expect(stage.framing.camY).toBeGreaterThan(6.7);
  });

  it('forwards pixel ratio changes, camera moves and renders', () => {
    const stage = new Stage(container(640, 360), handlers());
    const renderer = stage.renderer as unknown as FakeRendererShape;
    stage.setPixelRatio(1.5);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    stage.placeCamera(1, 0.2, -0.1);
    expect(stage.camera.position.x).toBeCloseTo(stage.framing.camX + 0.2);
    expect(stage.camera.position.y).toBeCloseTo(stage.framing.camY + 1 - 0.1);
    expect(stage.camera.position.z).toBeCloseTo(stage.framing.distance);
    stage.render();
    expect(renderer.render).toHaveBeenCalledWith(stage.scene, stage.camera);
  });

  it('reports a lost graphics context and its restoration', () => {
    const callbacks = handlers();
    const stage = new Stage(container(640, 360), callbacks);
    const canvas = (stage.renderer as unknown as FakeRendererShape).domElement;
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(callbacks.onContextLost).toHaveBeenCalled();
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks.onContextRestored).toHaveBeenCalled();
  });

  it('disposes the renderer and removes its canvas', () => {
    const host = container(640, 360);
    const stage = new Stage(host, handlers());
    const renderer = stage.renderer as unknown as FakeRendererShape;
    stage.dispose();
    expect(renderer.dispose).toHaveBeenCalled();
    expect(host.contains(renderer.domElement)).toBe(false);
  });
});
