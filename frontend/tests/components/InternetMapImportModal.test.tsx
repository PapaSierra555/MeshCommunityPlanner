/**
 * Unit tests for InternetMapImportModal component.
 * Uses vi.stubGlobal('fetch') to mock the /api/import/internet-map endpoint.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import { InternetMapImportModal } from '../../src/components/plan/InternetMapImportModal';

// ---- Store mocks ----
vi.mock('../../src/stores/planStore', () => ({
  usePlanStore: (selector: (s: any) => any) => {
    const state = {
      current_plan: { id: 'plan-1', name: 'Test Plan', firmware_family: 'meshcore', region: 'us_fcc' },
      nodes: [],
      setNodes: vi.fn(),
    };
    return selector(state);
  },
}));

vi.mock('../../src/services/api', () => ({
  getAPIClient: () => ({
    createNode: vi.fn().mockResolvedValue({ id: 'new-node-1', name: 'Alpha' }),
  }),
}));

// ---- Helpers ----

const MOCK_NODES = [
  { name: 'Alpha', lat: 25.1, lon: -80.2, description: 'Node Alpha' },
  { name: 'Beta', lat: 25.2, lon: -80.3, description: 'Node Beta' },
  { name: 'Gamma', lat: 25.3, lon: -80.4, description: 'Node Gamma' },
];

function makeFetchOk(nodes = MOCK_NODES) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ nodes, count: nodes.length, source: 'meshcore' }),
  });
}

function makeFetchError() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 502,
    json: () => Promise.resolve({ detail: 'upstream error' }),
  });
}

function makeFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error('network failure'));
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  planId: 'plan-1',
};

// Helper: click Fetch Nodes and wait for phase 2
async function clickFetchAndWaitForPreview() {
  const fetchBtn = screen.getByRole('button', { name: /fetch nodes/i });
  await act(async () => { fireEvent.click(fetchBtn); });
  // Wait for the node table to appear (phase 2)
  await waitFor(() => expect(screen.queryByRole('table')).toBeTruthy());
}

describe('InternetMapImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ---- Rendering ----

  describe('rendering when closed', () => {
    it('renders nothing when isOpen=false', () => {
      const { container } = render(<InternetMapImportModal {...defaultProps} isOpen={false} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('phase 1 — source selection', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', makeFetchOk());
    });

    it('renders the dialog when isOpen=true', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('shows the MeshCore Map card', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      expect(screen.getByText('MeshCore Map')).toBeTruthy();
    });

    it('shows the Reticulum Network card', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      expect(screen.getByText('Reticulum Network')).toBeTruthy();
    });

    it('Reticulum card shows "Live" badge (not "Coming Soon")', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      // Both source cards show "Live" — verify at least one badge is present and no Coming Soon
      const liveBadges = screen.getAllByText('Live');
      expect(liveBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Coming Soon')).toBeNull();
    });

    it('clicking Reticulum card makes it active (aria-pressed=true)', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      const reticulumBtn = screen.getByRole('button', { name: /reticulum network/i });
      fireEvent.click(reticulumBtn);
      expect(reticulumBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('clicking Reticulum card updates the modal title', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /reticulum network/i }));
      expect(screen.getByText('Import Nodes — Reticulum Network')).toBeTruthy();
    });

    it('renders Fetch Nodes button in phase 1', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /fetch nodes/i })).toBeTruthy();
    });

    it('× button calls onClose in phase 1', () => {
      const onClose = vi.fn();
      render(<InternetMapImportModal {...defaultProps} onClose={onClose} />);
      const closeBtn = screen.getByTitle('Close');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ---- Loading / Error states ----

  describe('loading state', () => {
    it('shows loading spinner while fetching', async () => {
      // Use a never-resolving promise to freeze in loading state
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
      render(<InternetMapImportModal {...defaultProps} />);
      const fetchBtn = screen.getByRole('button', { name: /fetch nodes/i });
      fireEvent.click(fetchBtn);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /fetching/i })).toBeTruthy();
      });
    });

    it('fetch button is disabled while loading', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
      render(<InternetMapImportModal {...defaultProps} />);
      const fetchBtn = screen.getByRole('button', { name: /fetch nodes/i });
      fireEvent.click(fetchBtn);
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /fetching/i }) as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
      });
    });
  });

  describe('successful fetch → phase 2', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', makeFetchOk());
    });

    it('transitions to phase 2 and shows node table after successful fetch', async () => {
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      expect(screen.getByRole('table')).toBeTruthy();
    });

    it('shows node count badge', async () => {
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      expect(screen.getByText(`${MOCK_NODES.length} nodes found`)).toBeTruthy();
    });
  });

  describe('error states', () => {
    it('shows error message on HTTP error response', async () => {
      vi.stubGlobal('fetch', makeFetchError());
      render(<InternetMapImportModal {...defaultProps} />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /fetch nodes/i })); });
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText(/upstream error/i)).toBeTruthy();
      });
    });

    it('shows error message on network failure', async () => {
      vi.stubGlobal('fetch', makeFetchNetworkError());
      render(<InternetMapImportModal {...defaultProps} />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /fetch nodes/i })); });
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
      });
    });

    it('stays in phase 1 on error', async () => {
      vi.stubGlobal('fetch', makeFetchError());
      render(<InternetMapImportModal {...defaultProps} />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /fetch nodes/i })); });
      await waitFor(() => { screen.getByRole('alert'); });
      // Phase 1 button still there
      expect(screen.getByRole('button', { name: /fetch nodes/i })).toBeTruthy();
    });
  });

  describe('empty node list', () => {
    it('shows "0 nodes found" when API returns empty array', async () => {
      vi.stubGlobal('fetch', makeFetchOk([]));
      render(<InternetMapImportModal {...defaultProps} />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /fetch nodes/i })); });
      await waitFor(() => {
        expect(screen.getByText('0 nodes found')).toBeTruthy();
      });
    });
  });

  // ---- Phase 2 — node list ----

  describe('phase 2 — node list', () => {
    beforeEach(async () => {
      vi.stubGlobal('fetch', makeFetchOk());
    });

    async function renderAtPhase2() {
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
    }

    it('shows node names in the table', async () => {
      await renderAtPhase2();
      expect(screen.getByText('Alpha')).toBeTruthy();
      expect(screen.getByText('Beta')).toBeTruthy();
      expect(screen.getByText('Gamma')).toBeTruthy();
    });

    it('shows lat and lon values in the table', async () => {
      await renderAtPhase2();
      // toFixed(4) formatting
      expect(screen.getByText('25.1000')).toBeTruthy();
      expect(screen.getByText('-80.2000')).toBeTruthy();
    });

    it('has Name, Lat, Lon column headers', async () => {
      await renderAtPhase2();
      expect(screen.getByText('Name')).toBeTruthy();
      expect(screen.getByText('Lat')).toBeTruthy();
      expect(screen.getByText('Lon')).toBeTruthy();
    });

    it('filter input filters nodes by name', async () => {
      await renderAtPhase2();
      const filterInput = screen.getByPlaceholderText(/filter by name/i);
      fireEvent.change(filterInput, { target: { value: 'Alpha' } });
      expect(screen.getByText('Alpha')).toBeTruthy();
      expect(screen.queryByText('Beta')).toBeNull();
      expect(screen.queryByText('Gamma')).toBeNull();
    });

    it('all nodes pre-selected by default', async () => {
      await renderAtPhase2();
      const checkboxes = screen.getAllByRole('checkbox');
      // Each node row has one checkbox
      const nodeCheckboxes = checkboxes.filter((cb) =>
        (cb as HTMLInputElement).getAttribute('aria-label')?.startsWith('Select ')
      );
      expect(nodeCheckboxes.length).toBe(MOCK_NODES.length);
      nodeCheckboxes.forEach((cb) => expect((cb as HTMLInputElement).checked).toBe(true));
    });

    it('Select All selects all checkboxes', async () => {
      await renderAtPhase2();
      // Deselect first
      fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
      // Now select all — use exact match to avoid matching "Deselect All"
      fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
      const checkboxes = screen.getAllByRole('checkbox').filter((cb) =>
        (cb as HTMLInputElement).getAttribute('aria-label')?.startsWith('Select ')
      );
      checkboxes.forEach((cb) => expect((cb as HTMLInputElement).checked).toBe(true));
    });

    it('Deselect All unchecks all checkboxes', async () => {
      await renderAtPhase2();
      fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
      const checkboxes = screen.getAllByRole('checkbox').filter((cb) =>
        (cb as HTMLInputElement).getAttribute('aria-label')?.startsWith('Select ')
      );
      checkboxes.forEach((cb) => expect((cb as HTMLInputElement).checked).toBe(false));
    });

    it('Import button shows selected node count', async () => {
      await renderAtPhase2();
      // All 3 pre-selected
      const importBtn = screen.getByRole('button', { name: /import 3 selected/i });
      expect(importBtn).toBeTruthy();
    });

    it('Import button is disabled when 0 nodes selected', async () => {
      await renderAtPhase2();
      fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
      const importBtn = screen.getByRole('button', { name: /import 0 selected/i }) as HTMLButtonElement;
      expect(importBtn.disabled).toBe(true);
    });

    it('× button calls onClose in phase 2', async () => {
      const onClose = vi.fn();
      render(<InternetMapImportModal {...defaultProps} onClose={onClose} />);
      await clickFetchAndWaitForPreview();
      const closeBtn = screen.getByTitle('Close');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ---- Title ----

  describe('modal title', () => {
    it('shows "Import Nodes — MeshCore Map" in the header', () => {
      vi.stubGlobal('fetch', makeFetchOk());
      render(<InternetMapImportModal {...defaultProps} />);
      expect(screen.getByText('Import Nodes — MeshCore Map')).toBeTruthy();
    });
  });

  // ---- Bulk import warning (>5 nodes) ----

  describe('bulk import warning', () => {
    const BULK_NODES = Array.from({ length: 6 }, (_, i) => ({
      name: `Node${i + 1}`,
      lat: 25 + i * 0.1,
      lon: -80 - i * 0.1,
      description: '',
    }));

    beforeEach(() => {
      vi.stubGlobal('fetch', makeFetchOk(BULK_NODES));
    });

    it('shows bulk warning when >5 nodes selected and import clicked', async () => {
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      // All 6 pre-selected — click Import
      const importBtn = screen.getByRole('button', { name: /import 6 selected/i });
      fireEvent.click(importBtn);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByText(/importing 6 nodes/i)).toBeTruthy();
      });
    });

    it('confirm button in bulk warning proceeds with import', async () => {
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      fireEvent.click(screen.getByRole('button', { name: /import 6 selected/i }));
      await waitFor(() => screen.getByText(/importing 6 nodes/i));
      // Click the confirm button
      const confirmBtn = screen.getByRole('button', { name: /import 6 nodes/i });
      await act(async () => { fireEvent.click(confirmBtn); });
      // Warning dismissed
      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull();
      });
    });

    it('cancel button in bulk warning dismisses warning and shows import button again', async () => {
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      fireEvent.click(screen.getByRole('button', { name: /import 6 selected/i }));
      await waitFor(() => screen.getByText(/importing 6 nodes/i));
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      // Import button is back
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /import 6 selected/i })).toBeTruthy();
      });
    });

    it('no warning when ≤5 nodes selected', async () => {
      // Use only 3 nodes
      vi.stubGlobal('fetch', makeFetchOk(MOCK_NODES));
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      // 3 nodes pre-selected — click import directly, no warning alert
      const importBtn = screen.getByRole('button', { name: /import 3 selected/i });
      await act(async () => { fireEvent.click(importBtn); });
      // No alert/warning div
      expect(screen.queryByText(/importing 3 nodes/i)).toBeNull();
    });
  });

  // ---- Bulk warning text content ----

  describe('bulk import warning — text and button labels', () => {
    const BULK_NODES = Array.from({ length: 6 }, (_, i) => ({
      name: `Node${i + 1}`,
      lat: 25 + i * 0.1,
      lon: -80 - i * 0.1,
      description: '',
    }));

    beforeEach(() => {
      vi.stubGlobal('fetch', makeFetchOk(BULK_NODES));
    });

    async function openBulkWarning() {
      render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      fireEvent.click(screen.getByRole('button', { name: /import 6 selected/i }));
      await waitFor(() => screen.getByRole('alert'));
    }

    it('warning text mentions the exact node count', async () => {
      await openBulkWarning();
      expect(screen.getByText(/importing 6 nodes/i)).toBeTruthy();
    });

    it('warning has a confirm button labelled "Import 6 nodes"', async () => {
      await openBulkWarning();
      expect(screen.getByRole('button', { name: /import 6 nodes/i })).toBeTruthy();
    });

    it('warning has a cancel button labelled "Cancel"', async () => {
      await openBulkWarning();
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeTruthy();
    });

    it('warning role="alert" is present', async () => {
      await openBulkWarning();
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  // ---- Modal title icon ----

  describe('modal title branding', () => {
    it('title contains an img element (MeshCore icon)', () => {
      vi.stubGlobal('fetch', makeFetchOk());
      render(<InternetMapImportModal {...defaultProps} />);
      const title = document.querySelector('.imim-title');
      expect(title).not.toBeNull();
      const icon = title!.querySelector('img');
      expect(icon).not.toBeNull();
    });

    it('title icon has an alt attribute for accessibility', () => {
      vi.stubGlobal('fetch', makeFetchOk());
      render(<InternetMapImportModal {...defaultProps} />);
      const icon = document.querySelector('.imim-title img') as HTMLImageElement;
      // alt can be empty string (decorative) or descriptive — must be present
      expect(icon).not.toBeNull();
      expect(icon.hasAttribute('alt')).toBe(true);
    });
  });

  // ---- Accessibility ----

  describe('accessibility', () => {
    it('axe passes in phase 1 (isOpen=true)', async () => {
      vi.stubGlobal('fetch', makeFetchOk());
      const { container } = render(<InternetMapImportModal {...defaultProps} />);
      const overlay = document.querySelector('.imim-overlay') as HTMLElement;
      const results = await axe(overlay || container);
      expect(results.violations).toEqual([]);
    });

    it('axe passes in phase 2 after successful fetch', async () => {
      vi.stubGlobal('fetch', makeFetchOk());
      const { container } = render(<InternetMapImportModal {...defaultProps} />);
      await clickFetchAndWaitForPreview();
      const overlay = document.querySelector('.imim-overlay') as HTMLElement;
      const results = await axe(overlay || container);
      expect(results.violations).toEqual([]);
    });
  });

  // ---- Meshtastic MQTT source ----

  describe('Meshtastic MQTT source card', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', makeFetchOk());
    });

    it('renders the Meshtastic MQTT source card', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      expect(screen.getByText('Meshtastic MQTT')).toBeTruthy();
    });

    it('clicking Meshtastic card shows broker URL input', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /meshtastic mqtt/i }));
      const brokerInput = screen.getByPlaceholderText('mqtt.meshtastic.org');
      expect(brokerInput).toBeTruthy();
    });

    it('broker URL input defaults to mqtt.meshtastic.org', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /meshtastic mqtt/i }));
      const brokerInput = screen.getByPlaceholderText('mqtt.meshtastic.org') as HTMLInputElement;
      expect(brokerInput.value).toBe('mqtt.meshtastic.org');
    });

    it('duration slider is present when meshtastic source selected', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /meshtastic mqtt/i }));
      const slider = document.querySelector('#mqttDuration') as HTMLInputElement;
      expect(slider).not.toBeNull();
      expect(slider.type).toBe('range');
    });

    it('shows countdown text during loading when meshtastic selected', async () => {
      // Use a never-resolving fetch to hold in loading state
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
      render(<InternetMapImportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /meshtastic mqtt/i }));
      const fetchBtn = screen.getByRole('button', { name: /fetch nodes/i });
      fireEvent.click(fetchBtn);
      await waitFor(() => {
        expect(screen.getByText(/listening for meshtastic nodes/i)).toBeTruthy();
      });
    });

    it('clicking Meshtastic card sets it as active (aria-pressed=true)', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      const meshtasticBtn = screen.getByRole('button', { name: /meshtastic mqtt/i });
      fireEvent.click(meshtasticBtn);
      expect(meshtasticBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('clicking Meshtastic card updates the modal title', () => {
      render(<InternetMapImportModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /meshtastic mqtt/i }));
      expect(screen.getByText('Import Nodes — Meshtastic MQTT')).toBeTruthy();
    });
  });
});
