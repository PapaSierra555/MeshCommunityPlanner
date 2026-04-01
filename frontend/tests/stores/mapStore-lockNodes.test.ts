/**
 * Tests for lockNodePositions state in mapStore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../../src/stores/mapStore';

describe('mapStore — lockNodePositions', () => {
  beforeEach(() => {
    useMapStore.setState({ lockNodePositions: false });
  });

  it('lockNodePositions defaults to false', () => {
    const state = useMapStore.getState();
    expect(state.lockNodePositions).toBe(false);
  });

  it('setLockNodePositions(true) sets it to true', () => {
    useMapStore.getState().setLockNodePositions(true);
    expect(useMapStore.getState().lockNodePositions).toBe(true);
  });

  it('setLockNodePositions(false) sets it back to false', () => {
    useMapStore.getState().setLockNodePositions(true);
    useMapStore.getState().setLockNodePositions(false);
    expect(useMapStore.getState().lockNodePositions).toBe(false);
  });
});
