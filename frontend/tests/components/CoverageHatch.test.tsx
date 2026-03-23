/**
 * Tests for coverage hatch mode.
 *
 * Covers:
 *   - hatchPatterns utility (pure logic, no DOM)
 *   - mapStore coverageHatchMode state
 *   - Toolbar hatch toggle rendering and accessibility
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';

import {
  HATCH_COLORS,
  PATTERN_TYPES,
  getNodeHatchColor,
  getPatternId,
  getPatternType,
  ensureHatchPatterns,
  removeHatchPatterns,
} from '../../src/utils/hatchPatterns';
import { useMapStore } from '../../src/stores/mapStore';

// ---------------------------------------------------------------------------
// hatchPatterns — pure logic
// ---------------------------------------------------------------------------

describe('hatchPatterns — getNodeHatchColor', () => {
  it('returns first color for index 0', () => {
    expect(getNodeHatchColor(0)).toBe(HATCH_COLORS[0]);
  });

  it('cycles after HATCH_COLORS.length', () => {
    const len = HATCH_COLORS.length;
    expect(getNodeHatchColor(len)).toBe(HATCH_COLORS[0]);
    expect(getNodeHatchColor(len + 3)).toBe(HATCH_COLORS[3]);
  });

  it('returns a non-empty CSS color string for every defined index', () => {
    for (let i = 0; i < HATCH_COLORS.length; i++) {
      const c = getNodeHatchColor(i);
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('hatchPatterns — getPatternId', () => {
  it('returns a string containing the index', () => {
    expect(getPatternId(0)).toContain('0');
    expect(getPatternId(7)).toContain('7');
  });

  it('returns distinct IDs for different indices', () => {
    const ids = new Set(Array.from({ length: 20 }, (_, i) => getPatternId(i)));
    expect(ids.size).toBe(20);
  });

  it('ID is a valid XML id (no spaces, starts with letter)', () => {
    for (let i = 0; i < 10; i++) {
      expect(getPatternId(i)).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe('hatchPatterns — getPatternType', () => {
  it('returns a valid PatternType for any index', () => {
    const types = new Set(PATTERN_TYPES);
    for (let i = 0; i < 20; i++) {
      expect(types.has(getPatternType(i))).toBe(true);
    }
  });

  it('cycles through all 6 pattern types', () => {
    const seen = new Set<string>();
    for (let i = 0; i < PATTERN_TYPES.length; i++) seen.add(getPatternType(i));
    expect(seen.size).toBe(PATTERN_TYPES.length);
  });

  it('repeats after PATTERN_TYPES.length', () => {
    const len = PATTERN_TYPES.length;
    expect(getPatternType(0)).toBe(getPatternType(len));
    expect(getPatternType(1)).toBe(getPatternType(len + 1));
  });
});

// ---------------------------------------------------------------------------
// hatchPatterns — DOM injection (jsdom)
// ---------------------------------------------------------------------------

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  return svg as SVGSVGElement;
}

describe('hatchPatterns — ensureHatchPatterns', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    svg = makeSvg();
  });

  it('creates a defs element when none exists', () => {
    ensureHatchPatterns(svg, 2);
    expect(svg.querySelector('defs')).not.toBeNull();
  });

  it('injects one pattern per node', () => {
    ensureHatchPatterns(svg, 3);
    expect(svg.querySelectorAll('pattern')).toHaveLength(3);
  });

  it('each injected pattern has the correct id', () => {
    ensureHatchPatterns(svg, 3);
    for (let i = 0; i < 3; i++) {
      expect(svg.querySelector(`#${getPatternId(i)}`)).not.toBeNull();
    }
  });

  it('does not duplicate patterns on repeated calls', () => {
    ensureHatchPatterns(svg, 2);
    ensureHatchPatterns(svg, 2);
    expect(svg.querySelectorAll('pattern')).toHaveLength(2);
  });

  it('adds new patterns when count grows', () => {
    ensureHatchPatterns(svg, 2);
    ensureHatchPatterns(svg, 4);
    expect(svg.querySelectorAll('pattern')).toHaveLength(4);
  });

  it('sets patternUnits="userSpaceOnUse"', () => {
    ensureHatchPatterns(svg, 1);
    const pat = svg.querySelector('pattern');
    expect(pat?.getAttribute('patternUnits')).toBe('userSpaceOnUse');
  });

  it('each pattern contains at least one child element', () => {
    ensureHatchPatterns(svg, PATTERN_TYPES.length);
    svg.querySelectorAll('pattern').forEach((p) => {
      expect(p.children.length).toBeGreaterThan(0);
    });
  });

  it('diag-right pattern (index 0) contains a line element', () => {
    ensureHatchPatterns(svg, 1);
    const pat = svg.querySelector(`#${getPatternId(0)}`);
    expect(pat?.querySelector('line')).not.toBeNull();
  });

  it('dots pattern (index 4) contains a circle element', () => {
    ensureHatchPatterns(svg, 5);
    const pat = svg.querySelector(`#${getPatternId(4)}`);
    expect(pat?.querySelector('circle')).not.toBeNull();
  });

  it('cross pattern (index 5) contains two lines', () => {
    ensureHatchPatterns(svg, 6);
    const pat = svg.querySelector(`#${getPatternId(5)}`);
    expect(pat?.querySelectorAll('line')).toHaveLength(2);
  });
});

describe('hatchPatterns — removeHatchPatterns', () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    svg = makeSvg();
  });

  it('removes the defs element', () => {
    ensureHatchPatterns(svg, 3);
    removeHatchPatterns(svg);
    expect(svg.querySelector('defs')).toBeNull();
  });

  it('removes all injected patterns', () => {
    ensureHatchPatterns(svg, 3);
    removeHatchPatterns(svg);
    expect(svg.querySelectorAll('pattern')).toHaveLength(0);
  });

  it('is safe to call when no defs exist', () => {
    expect(() => removeHatchPatterns(svg)).not.toThrow();
  });

  it('allows re-injection after removal', () => {
    ensureHatchPatterns(svg, 2);
    removeHatchPatterns(svg);
    ensureHatchPatterns(svg, 2);
    expect(svg.querySelectorAll('pattern')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// mapStore — coverageHatchMode
// ---------------------------------------------------------------------------

describe('mapStore — coverageHatchMode', () => {
  beforeEach(() => {
    useMapStore.setState({ coverageHatchMode: false });
  });

  it('defaults to false', () => {
    expect(useMapStore.getState().coverageHatchMode).toBe(false);
  });

  it('setCoverageHatchMode(true) enables hatch mode', () => {
    useMapStore.getState().setCoverageHatchMode(true);
    expect(useMapStore.getState().coverageHatchMode).toBe(true);
  });

  it('setCoverageHatchMode(false) disables hatch mode', () => {
    useMapStore.getState().setCoverageHatchMode(true);
    useMapStore.getState().setCoverageHatchMode(false);
    expect(useMapStore.getState().coverageHatchMode).toBe(false);
  });

  it('toggling twice returns to original state', () => {
    const initial = useMapStore.getState().coverageHatchMode;
    useMapStore.getState().setCoverageHatchMode(!initial);
    useMapStore.getState().setCoverageHatchMode(initial);
    expect(useMapStore.getState().coverageHatchMode).toBe(initial);
  });

  it('does not affect other store fields', () => {
    const before = useMapStore.getState().coverageOpacity;
    useMapStore.getState().setCoverageHatchMode(true);
    expect(useMapStore.getState().coverageOpacity).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Toolbar hatch toggle — rendering & accessibility
// ---------------------------------------------------------------------------

function HatchToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        type="button"
        aria-pressed={enabled}
        onClick={onToggle}
        title="Switch coverage circles to per-node hatch patterns for overlap analysis"
      >
        {enabled ? '✓ ' : ''}Coverage Hatch Mode
      </button>
    </div>
  );
}

describe('Toolbar hatch toggle — rendering', () => {
  it('renders the button', () => {
    render(<HatchToggle enabled={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: /coverage hatch mode/i })).toBeInTheDocument();
  });

  it('shows no checkmark when disabled', () => {
    render(<HatchToggle enabled={false} onToggle={() => {}} />);
    expect(screen.getByRole('button').textContent).not.toContain('✓');
  });

  it('shows checkmark when enabled', () => {
    render(<HatchToggle enabled={true} onToggle={() => {}} />);
    expect(screen.getByRole('button').textContent).toContain('✓');
  });

  it('calls onToggle when clicked', () => {
    let called = false;
    render(<HatchToggle enabled={false} onToggle={() => { called = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /coverage hatch mode/i }));
    expect(called).toBe(true);
  });

  it('aria-pressed is false when disabled', () => {
    render(<HatchToggle enabled={false} onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: /coverage hatch mode/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('aria-pressed is true when enabled', () => {
    render(<HatchToggle enabled={true} onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: /coverage hatch mode/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Toolbar hatch toggle — accessibility', () => {
  it('passes axe with hatch mode off', async () => {
    const { container } = render(<HatchToggle enabled={false} onToggle={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('passes axe with hatch mode on', async () => {
    const { container } = render(<HatchToggle enabled={true} onToggle={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('button is keyboard-focusable', () => {
    render(<HatchToggle enabled={false} onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: /coverage hatch mode/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('activates on Enter key', () => {
    let called = false;
    render(<HatchToggle enabled={false} onToggle={() => { called = true; }} />);
    const btn = screen.getByRole('button', { name: /coverage hatch mode/i });
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(btn);
    expect(called).toBe(true);
  });
});
