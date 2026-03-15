/**
 * Unit tests for Toolbar — "Import Nodes (Internet)" offline guard.
 *
 * The Toolbar receives an `isInternetOnline` prop (boolean | null) from
 * AppLayout, which probes /api/import/internet-map/ping at startup.
 *
 * Behaviour under test:
 *   isInternetOnline=false  → button disabled, "(offline)" suffix, offline tooltip
 *   isInternetOnline=true   → button enabled, no suffix, online tooltip
 *   isInternetOnline=null   → button enabled (null = still checking; don't block use)
 *   Clicking while online   → calls onImportFromMap
 *   Clicking while offline  → does NOT call onImportFromMap
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Toolbar } from '../../src/components/layout/Toolbar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render Toolbar and open the Plan dropdown so Import Nodes buttons are visible. */
function openPlanMenu(props: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const result = render(<Toolbar hasPlan={true} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
  return result;
}

function getInternetBtn() {
  // The button text is "Import Nodes (Internet)" optionally suffixed with " (offline)"
  return screen.getByText(/Import Nodes \(Internet\)/i).closest('button')!;
}

// ---------------------------------------------------------------------------
// Offline state (isInternetOnline=false)
// ---------------------------------------------------------------------------

describe('Toolbar — Import Nodes (Internet) — offline state', () => {
  it('button has "disabled" class when isInternetOnline=false', () => {
    openPlanMenu({ isInternetOnline: false });
    expect(getInternetBtn().className).toContain('disabled');
  });

  it('button shows "(offline)" suffix when isInternetOnline=false', () => {
    openPlanMenu({ isInternetOnline: false });
    expect(getInternetBtn().textContent).toContain('(offline)');
  });

  it('button title is the offline tooltip when isInternetOnline=false', () => {
    openPlanMenu({ isInternetOnline: false });
    expect(getInternetBtn().getAttribute('title')).toContain(
      'No internet connection'
    );
  });

  it('clicking while offline does NOT call onImportFromMap', () => {
    const onImportFromMap = vi.fn();
    openPlanMenu({ isInternetOnline: false, onImportFromMap });
    fireEvent.click(getInternetBtn());
    expect(onImportFromMap).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Online state (isInternetOnline=true)
// ---------------------------------------------------------------------------

describe('Toolbar — Import Nodes (Internet) — online state', () => {
  it('button does NOT have "disabled" class when isInternetOnline=true', () => {
    openPlanMenu({ isInternetOnline: true });
    expect(getInternetBtn().className).not.toContain('disabled');
  });

  it('button does NOT show "(offline)" suffix when isInternetOnline=true', () => {
    openPlanMenu({ isInternetOnline: true });
    expect(getInternetBtn().textContent).not.toContain('(offline)');
  });

  it('button title is the online tooltip when isInternetOnline=true', () => {
    openPlanMenu({ isInternetOnline: true });
    expect(getInternetBtn().getAttribute('title')).toContain(
      'Import nodes from online mesh network maps'
    );
  });

  it('clicking while online calls onImportFromMap', () => {
    const onImportFromMap = vi.fn();
    openPlanMenu({ isInternetOnline: true, onImportFromMap });
    fireEvent.click(getInternetBtn());
    expect(onImportFromMap).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Null / checking state (isInternetOnline=null — default)
// ---------------------------------------------------------------------------

describe('Toolbar — Import Nodes (Internet) — null/checking state', () => {
  it('button does NOT have "disabled" class when isInternetOnline=null', () => {
    openPlanMenu({ isInternetOnline: null });
    expect(getInternetBtn().className).not.toContain('disabled');
  });

  it('button does NOT have "disabled" class when isInternetOnline is omitted', () => {
    openPlanMenu({}); // default = null
    expect(getInternetBtn().className).not.toContain('disabled');
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('Toolbar — Import Nodes (Internet) — accessibility', () => {
  it('Plan menu with isInternetOnline=false has no axe violations', async () => {
    const { container } = openPlanMenu({ isInternetOnline: false });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Plan menu with isInternetOnline=true has no axe violations', async () => {
    const { container } = openPlanMenu({ isInternetOnline: true });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
