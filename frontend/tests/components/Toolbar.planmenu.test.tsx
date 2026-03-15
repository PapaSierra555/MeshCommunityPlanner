/**
 * Tests for Toolbar — Plan menu structure and Export Plan As nested submenu.
 * Covers the nested submenu added in PR #5 (toolbar-cleanup).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Toolbar } from '../../src/components/layout/Toolbar';

function openPlanMenu(props: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const result = render(<Toolbar {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
  return result;
}

describe('Toolbar — Plan menu items', () => {
  it('Plan menu opens on click', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('New Plan')).toBeInTheDocument();
  });

  it('Duplicate Plan is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Duplicate Plan')).toBeInTheDocument();
  });

  it('Import Plan(s) is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Import Plan(s)')).toBeInTheDocument();
  });

  it('Export Plan is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Export Plan')).toBeInTheDocument();
  });

  it('Import Nodes (CSV) is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Import Nodes (CSV)')).toBeInTheDocument();
  });

  it('Import Nodes (JSON) is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Import Nodes (JSON)')).toBeInTheDocument();
  });

  it('Import Nodes (Internet) is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Import Nodes (Internet)')).toBeInTheDocument();
  });

  it('Import Signal Data (CSV) is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Import Signal Data (CSV)')).toBeInTheDocument();
  });

  it('Export Nodes (CSV) is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Export Nodes (CSV)')).toBeInTheDocument();
  });

  it('Close Plan is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Close Plan')).toBeInTheDocument();
  });

  it('Delete Plan is present', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Delete Plan')).toBeInTheDocument();
  });

  it('clicking Import Signal Data (CSV) calls onImportSignal', () => {
    const onImportSignal = vi.fn();
    openPlanMenu({ hasPlan: true, onImportSignal });
    fireEvent.click(screen.getByText('Import Signal Data (CSV)'));
    expect(onImportSignal).toHaveBeenCalledOnce();
  });

  it('clicking Export Plan calls onExportPlan', () => {
    const onExportPlan = vi.fn();
    openPlanMenu({ hasPlan: true, onExportPlan });
    fireEvent.click(screen.getByText('Export Plan'));
    expect(onExportPlan).toHaveBeenCalledOnce();
  });

  it('Plan menu has no accessibility violations (axe)', async () => {
    const { container } = openPlanMenu({ hasPlan: true });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Toolbar — Export Plan As submenu', () => {
  it('"Export Plan As" trigger is present when hasPlan=true', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.getByText('Export Plan As', { exact: false })).toBeInTheDocument();
  });

  it('"Export Plan As" trigger is disabled when hasPlan=false', () => {
    openPlanMenu({ hasPlan: false });
    const trigger = screen.getByText('Export Plan As', { exact: false }).closest('button');
    expect(trigger).toBeDisabled();
  });

  it('"Export Plan As" has aria-haspopup="true"', () => {
    openPlanMenu({ hasPlan: true });
    const trigger = screen.getByText('Export Plan As', { exact: false }).closest('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
  });

  it('"Export Plan As" has aria-expanded="false" before opening', () => {
    openPlanMenu({ hasPlan: true });
    const trigger = screen.getByText('Export Plan As', { exact: false }).closest('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('submenu not visible before interaction', () => {
    openPlanMenu({ hasPlan: true });
    expect(screen.queryByText('KML (Google Earth / GIS)')).toBeNull();
    expect(screen.queryByText('GeoJSON (GIS / Web Maps)')).toBeNull();
  });

  it('hovering "Export Plan As" wrapper opens submenu', () => {
    openPlanMenu({ hasPlan: true });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText('KML (Google Earth / GIS)')).toBeInTheDocument();
    expect(screen.getByText('GeoJSON (GIS / Web Maps)')).toBeInTheDocument();
  });

  it('aria-expanded is "true" when submenu is open', () => {
    openPlanMenu({ hasPlan: true });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    const trigger = screen.getByText('Export Plan As', { exact: false }).closest('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking wrapper toggles submenu open', () => {
    openPlanMenu({ hasPlan: true });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.click(wrapper);
    expect(screen.getByText('KML (Google Earth / GIS)')).toBeInTheDocument();
  });

  it('mouse leave closes the submenu', () => {
    openPlanMenu({ hasPlan: true });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText('KML (Google Earth / GIS)')).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('KML (Google Earth / GIS)')).toBeNull();
  });

  it('clicking KML calls onExportKML', () => {
    const onExportKML = vi.fn();
    openPlanMenu({ hasPlan: true, onExportKML });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    fireEvent.click(screen.getByText('KML (Google Earth / GIS)'));
    expect(onExportKML).toHaveBeenCalledOnce();
  });

  it('clicking GeoJSON calls onExportGeoJSON', () => {
    const onExportGeoJSON = vi.fn();
    openPlanMenu({ hasPlan: true, onExportGeoJSON });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    fireEvent.click(screen.getByText('GeoJSON (GIS / Web Maps)'));
    expect(onExportGeoJSON).toHaveBeenCalledOnce();
  });

  it('submenu panel has role="menu"', () => {
    openPlanMenu({ hasPlan: true });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    const panel = wrapper.querySelector('[role="menu"]');
    expect(panel).not.toBeNull();
  });

  it('submenu items have role="menuitem"', () => {
    openPlanMenu({ hasPlan: true });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    const items = wrapper.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(2);
  });

  it('Plan menu with submenu open has no accessibility violations (axe)', async () => {
    const { container } = openPlanMenu({ hasPlan: true });
    const wrapper = screen.getByText('Export Plan As', { exact: false }).closest('.toolbar-submenu-wrapper')!;
    fireEvent.mouseEnter(wrapper);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
