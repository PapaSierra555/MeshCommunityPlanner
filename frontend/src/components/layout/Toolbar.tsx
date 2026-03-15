/**
 * Toolbar Component
 * Top toolbar with application title, Plan menu, Tools menu, Plan Info menu, and version badge.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import './Toolbar.css';
import meshtasticIcon from '../../assets/icons/meshtastic.svg';
import meshcoreIcon from '../../assets/icons/meshcore.svg';
import reticulumIcon from '../../assets/icons/reticulum.svg';

export interface PlanInfoEntry {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  firmware?: string;
  region?: string;
}

interface ToolbarProps {
  onToggleSidebar?: () => void;
  // Plan menu actions
  onNewPlan?: () => void;
  onOpenPlan?: () => void;
  onImportPlan?: () => void;
  onExportPlan?: () => void;
  onExportCSV?: () => void;
  onImportCSV?: () => void;
  onImportJSON?: () => void;
  onImportFromMap?: () => void;
  onImportSignal?: () => void;
  onExportKML?: () => void;
  onExportGeoJSON?: () => void;
  onDuplicatePlan?: () => void;
  onClosePlan?: () => void;
  onDeletePlan?: () => void;
  hasPlan?: boolean;
  // Tools menu actions
  onLineOfSight?: () => void;
  onCoverageAnalysis?: () => void;
  onViewshed?: () => void;
  onFindRoute?: () => void;
  onClearOverlays?: () => void;
  onLinkReport?: () => void;
  onExportMaterialList?: () => void;
  onExportNetworkPDF?: () => void;
  onTimeOnAir?: () => void;
  onChannelCapacity?: () => void;
  onFloodSim?: () => void;
  onSuggestPlacement?: () => void;
  onRepeaterChain?: () => void;
  onMeshCoreAirtime?: () => void;
  onMeshCoreCapacity?: () => void;
  onMeshCoreFreqCoord?: () => void;
  onReticulumAnnounce?: () => void;
  onRNSLinkBudget?: () => void;
  onRNSTransport?: () => void;
  onRNSThroughput?: () => void;
  onSaveScreenshot?: () => void;
  onToggleElevation?: () => void;
  elevationEnabled?: boolean;
  hasOverlays?: boolean;
  hasLOSOverlays?: boolean;
  selectedCount?: number;
  analysisLoading?: boolean;
  // App lifecycle
  onExitApp?: () => void;
  // Catalog
  onOpenCatalog?: () => void;
  // Tours
  onShowTour?: () => void;
  onShowCatalogTour?: () => void;
  // Plan Info data
  loadedPlans?: PlanInfoEntry[];
  totalNodeCount?: number;
  losLinkCount?: number;
  coverageOverlayCount?: number;
  networkRadioSummary?: string;
  coverageEnv?: string;
}

export function Toolbar({
  onToggleSidebar,
  onNewPlan,
  onOpenPlan,
  onImportPlan,
  onExportPlan,
  onExportCSV,
  onImportCSV,
  onImportJSON,
  onImportFromMap,
  onImportSignal,
  onExportKML,
  onExportGeoJSON,
  onDuplicatePlan,
  onClosePlan,
  onDeletePlan,
  hasPlan = false,
  onLineOfSight,
  onCoverageAnalysis,
  onViewshed,
  onFindRoute,
  onLinkReport,
  onClearOverlays,
  onExportMaterialList,
  onExportNetworkPDF,
  onTimeOnAir,
  onChannelCapacity,
  onFloodSim,
  onSuggestPlacement,
  onRepeaterChain,
  onMeshCoreAirtime,
  onMeshCoreCapacity,
  onMeshCoreFreqCoord,
  onReticulumAnnounce,
  onRNSLinkBudget,
  onRNSTransport,
  onRNSThroughput,
  onSaveScreenshot,
  onToggleElevation,
  elevationEnabled = false,
  hasOverlays = false,
  hasLOSOverlays = false,
  selectedCount = 0,
  analysisLoading = false,
  onExitApp,
  onOpenCatalog,
  onShowTour,
  onShowCatalogTour,
  loadedPlans = [],
  totalNodeCount = 0,
  losLinkCount = 0,
  coverageOverlayCount = 0,
  networkRadioSummary,
  coverageEnv,
}: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<null | 'plan' | 'tools' | 'catalog' | 'info' | 'appinfo' | 'moretools'>(null);
  const [exportSubmenuOpen, setExportSubmenuOpen] = useState(false);
  const [moreToolsProtocol, setMoreToolsProtocol] = useState<'meshtastic' | 'meshcore' | 'reticulum' | null>(null);
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());
  const [expandedHelpSections, setExpandedHelpSections] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const appInfoRef = useRef<HTMLDivElement>(null);
  const moreToolsRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  // Focus trap for AppInfo modal
  useEffect(() => {
    if (openMenu !== 'appinfo') return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = appInfoRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [openMenu]);

  // Focus trap for More Tools modal
  useEffect(() => {
    if (openMenu !== 'moretools') return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = moreToolsRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [openMenu]);

  // Auto-expand all plans when dropdown opens, reset when closed
  useEffect(() => {
    if (openMenu === 'info') {
      setExpandedPlanIds(new Set(loadedPlans.map((p) => p.id)));
    }
  }, [openMenu, loadedPlans]);

  // Reset help accordion when modal closes
  useEffect(() => {
    if (openMenu !== 'appinfo') setExpandedHelpSections(new Set());
  }, [openMenu]);

  // Reset protocol selection when More Tools closes
  useEffect(() => {
    if (openMenu !== 'moretools') setMoreToolsProtocol(null);
  }, [openMenu]);

  // Close Export Plan As submenu when Plan menu closes
  useEffect(() => {
    if (openMenu !== 'plan') setExportSubmenuOpen(false);
  }, [openMenu]);

  const toggleHelpSection = useCallback((id: string) => {
    setExpandedHelpSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleMenuClick = useCallback((menu: 'plan' | 'tools' | 'catalog' | 'info' | 'appinfo' | 'moretools') => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }, []);

  const handleItemClick = useCallback((action?: () => void) => {
    if (action) {
      setOpenMenu(null);
      action();
    }
  }, []);

  const togglePlanExpanded = useCallback((planId: string) => {
    setExpandedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }, []);

  return (
    <header className="toolbar" role="banner">
      <div className="toolbar-content">
        <div className="toolbar-left">
          <button
            className="toolbar-btn toolbar-toggle"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
            type="button"
          >
            &#9776;
          </button>
          <h1 className="app-title">Mesh Community Planner</h1>

          {/* Dropdown Menus */}
          <div className="toolbar-menus" ref={menuRef}>
            {/* Plan Menu */}
            <div className="toolbar-menu">
              <button
                className={`toolbar-menu-btn${openMenu === 'plan' ? ' active' : ''}`}
                type="button"
                onClick={() => handleMenuClick('plan')}
              >
                Plan <span className="menu-arrow" aria-hidden="true">&#9662;</span>
              </button>
              {openMenu === 'plan' && (
                <div className="toolbar-dropdown">
                  <button className="toolbar-dropdown-item" type="button"
                    onClick={() => handleItemClick(onNewPlan)}
                    title="Create a new empty mesh network plan">
                    New Plan
                  </button>
                  <button className="toolbar-dropdown-item" type="button"
                    onClick={() => handleItemClick(onOpenPlan)}
                    title="Open an existing plan from the database">
                    Open Plan
                  </button>
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onDuplicatePlan)}
                    title="Create an exact copy of the current plan and all its nodes">
                    Duplicate Plan
                  </button>
                  <button className="toolbar-dropdown-item" type="button"
                    onClick={() => handleItemClick(onImportPlan)}
                    title="Import plan(s) from .meshplan.json files on disk">
                    Import Plan(s)
                  </button>
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onExportPlan)}
                    title="Save the current plan as a .meshplan.json file for sharing or backup">
                    Export Plan
                  </button>
                  <div
                    className={`toolbar-submenu-wrapper${!hasPlan ? ' disabled' : ''}`}
                    onMouseEnter={() => hasPlan && setExportSubmenuOpen(true)}
                    onMouseLeave={() => setExportSubmenuOpen(false)}
                    onClick={() => hasPlan && setExportSubmenuOpen(!exportSubmenuOpen)}
                    onKeyUp={(e) => { if (e.key === ' ') setExportSubmenuOpen(!exportSubmenuOpen); }}
                  >
                    <button
                      className={`toolbar-dropdown-item toolbar-submenu-trigger${!hasPlan ? ' disabled' : ''}`}
                      type="button"
                      aria-haspopup="true"
                      aria-expanded={exportSubmenuOpen}
                      title="Export the current plan in different mapping formats"
                      disabled={!hasPlan}
                    >
                      Export Plan As
                      <span className="toolbar-submenu-arrow" aria-hidden="true">&#9656;</span>
                    </button>
                    {hasPlan && exportSubmenuOpen && (
                      <div className="toolbar-submenu-panel" role="menu">
                        <button
                          role="menuitem"
                          className="toolbar-dropdown-item"
                          type="button"
                          onClick={() => { setExportSubmenuOpen(false); handleItemClick(onExportKML); }}
                          title="Export plan as KML for Google Earth, ArcGIS, and other GIS tools"
                        >
                          KML (Google Earth / GIS)
                        </button>
                        <button
                          role="menuitem"
                          className="toolbar-dropdown-item"
                          type="button"
                          onClick={() => { setExportSubmenuOpen(false); handleItemClick(onExportGeoJSON); }}
                          title="Export plan as GeoJSON for QGIS, ArcGIS, mapbox, and other GIS tools"
                        >
                          GeoJSON (GIS / Web Maps)
                        </button>
                       </div>
                    )}
                  </div>
                  <div className="toolbar-dropdown-separator" />
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onImportCSV)}
                    title="Import node locations from a CSV file — requires name, latitude, longitude columns">
                    Import Nodes (CSV)
                  </button>
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onImportJSON)}
                    title="Import node locations from a JSON file with a layers array (name, latitude, longitude, antenna_height_a)">
                    Import Nodes (JSON)
                  </button>
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onImportFromMap)}
                    title="Import nodes from online mesh network maps (MeshCore Map, rmap.world)">
                    Import Nodes (Internet)
                  </button>
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onImportSignal)}
                    title="Import RSSI/SNR signal observations from a CSV export — compare predicted link budgets against real-world measurements">
                    Import Signal Data (CSV)
                  </button>
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onExportCSV)}
                    title="Export all node locations and configuration as a CSV spreadsheet">
                    Export Nodes (CSV)
                  </button>
                  <div className="toolbar-dropdown-separator" />
                  <button className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onClosePlan)}
                    title="Close the current plan without deleting it">
                    Close Plan
                  </button>
                  <button className={`toolbar-dropdown-item toolbar-dropdown-item-danger${!hasPlan ? ' disabled' : ''}`} type="button"
                    onClick={() => hasPlan && handleItemClick(onDeletePlan)}
                    title="Permanently delete the current plan and all its nodes">
                    Delete Plan
                  </button>
                </div>
              )}
            </div>

            {/* Plan Info Menu */}
            <div className="toolbar-menu">
              <button
                className={`toolbar-menu-btn${openMenu === 'info' ? ' active' : ''}`}
                type="button"
                onClick={() => handleMenuClick('info')}
              >
                Plan Info <span className="menu-arrow" aria-hidden="true">&#9662;</span>
              </button>
              {openMenu === 'info' && (
                <div className="toolbar-dropdown toolbar-info-dropdown">
                  {loadedPlans.length > 0 ? (
                    <>
                      {/* Summary banner */}
                      {loadedPlans.length > 1 && (
                        <div className="toolbar-info-summary">
                          {loadedPlans.length} Plans Loaded &middot; {totalNodeCount} Nodes Total
                        </div>
                      )}

                      {/* Per-plan sections */}
                      {loadedPlans.map((plan) => {
                        const isExpanded = expandedPlanIds.has(plan.id);
                        const isSingle = loadedPlans.length === 1;
                        return (
                          <div key={plan.id} className="toolbar-info-plan">
                            <div
                              className={`toolbar-info-plan-header${isSingle ? ' single' : ''}`}
                              onClick={() => !isSingle && togglePlanExpanded(plan.id)}
                            >
                              <span className="toolbar-info-plan-name">{plan.name}</span>
                              <span className="toolbar-info-plan-badge">{plan.nodeCount} node{plan.nodeCount !== 1 ? 's' : ''}</span>
                              {!isSingle && (
                                <span className="toolbar-info-chevron">{isExpanded ? '\u25B4' : '\u25BE'}</span>
                              )}
                            </div>
                            {(isSingle || isExpanded) && (
                              <div className="toolbar-info-plan-body">
                                {plan.description && (
                                  <div className="toolbar-info-row">
                                    <span className="toolbar-info-label">Description</span>
                                    <span className="toolbar-info-value toolbar-info-desc">{plan.description}</span>
                                  </div>
                                )}
                                <div className="toolbar-info-row">
                                  <span className="toolbar-info-label">Nodes</span>
                                  <span className="toolbar-info-value">{plan.nodeCount}</span>
                                </div>
                                {plan.firmware && (
                                  <div className="toolbar-info-row">
                                    <span className="toolbar-info-label">Firmware</span>
                                    <span className="toolbar-info-value">{plan.firmware}</span>
                                  </div>
                                )}
                                {plan.region && (
                                  <div className="toolbar-info-row">
                                    <span className="toolbar-info-label">Region</span>
                                    <span className="toolbar-info-value">{plan.region}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Shared network stats */}
                      <div className="toolbar-dropdown-separator" />
                      <div className="toolbar-info-row">
                        <span className="toolbar-info-label">Total Nodes</span>
                        <span className="toolbar-info-value">{totalNodeCount}</span>
                      </div>
                      <div className="toolbar-info-row">
                        <span className="toolbar-info-label">LOS Links</span>
                        <span className="toolbar-info-value">{losLinkCount > 0 ? losLinkCount : 'None'}</span>
                      </div>
                      <div className="toolbar-info-row">
                        <span className="toolbar-info-label">Coverage Overlays</span>
                        <span className="toolbar-info-value">{coverageOverlayCount > 0 ? coverageOverlayCount : 'None'}</span>
                      </div>
                      {networkRadioSummary && (
                        <>
                          <div className="toolbar-dropdown-separator" />
                          <div className="toolbar-info-row">
                            <span className="toolbar-info-label">Radio</span>
                            <span className="toolbar-info-value">{networkRadioSummary}</span>
                          </div>
                        </>
                      )}
                      {coverageEnv && (
                        <div className="toolbar-info-row">
                          <span className="toolbar-info-label">Environment</span>
                          <span className="toolbar-info-value">{coverageEnv}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="toolbar-info-empty">No plan loaded</div>
                  )}
                </div>
              )}
            </div>

            {/* Tools Menu */}
            <div className="toolbar-menu">
              <button
                className={`toolbar-menu-btn${openMenu === 'tools' ? ' active' : ''}`}
                type="button"
                onClick={() => handleMenuClick('tools')}
              >
                Tools <span className="menu-arrow" aria-hidden="true">&#9662;</span>
              </button>
              {openMenu === 'tools' && (
                <div className="toolbar-dropdown">
                  <button
                    className={`toolbar-dropdown-item${!hasPlan || analysisLoading ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasPlan && !analysisLoading && handleItemClick(onLineOfSight)}
                    title="Calculate line-of-sight links between nodes using terrain data. Select 2+ nodes for a subset, or run on all nodes.">
                    Line of Sight{selectedCount >= 2 ? ` (${selectedCount} nodes)` : ' (all nodes)'}
                  </button>
                  <button
                    className={`toolbar-dropdown-item${!hasPlan || analysisLoading ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasPlan && !analysisLoading && handleItemClick(onCoverageAnalysis)}
                    title="Generate a coverage heatmap showing radio signal strength across the area">
                    {analysisLoading ? 'Computing...' : `Coverage Analysis${selectedCount > 0 ? ` (${selectedCount} nodes)` : ' (all nodes)'}`}
                  </button>
                  <button
                    className={`toolbar-dropdown-item${!hasPlan || analysisLoading ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasPlan && !analysisLoading && handleItemClick(onViewshed)}
                    title="Analyze line-of-sight visibility from one node to all others using SRTM terrain">
                    Viewshed Analysis{selectedCount === 1 ? ' (1 observer)' : ''}
                  </button>
                  <button
                    className={`toolbar-dropdown-item${!hasPlan || !hasLOSOverlays ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasPlan && hasLOSOverlays && handleItemClick(onFindRoute)}
                    title="Find the shortest multi-hop path between two selected nodes using LOS links">
                    Find Route{selectedCount === 2 ? ' (2 nodes)' : ''}
                  </button>
                  <div className="toolbar-dropdown-separator" />
                  <button
                    className="toolbar-dropdown-item"
                    type="button"
                    onClick={() => handleItemClick(onToggleElevation)}
                    title="Toggle an elevation heatmap layer showing terrain height (requires SRTM data download)">
                    {elevationEnabled ? '\u2713 ' : ''}Elevation Heatmap
                  </button>
                  <div className="toolbar-dropdown-separator" />
                  <button
                    className="toolbar-dropdown-item"
                    type="button"
                    onClick={() => { setOpenMenu(null); setTimeout(() => setOpenMenu('moretools'), 0); }}
                    title="Open the protocol-organized tool library">
                    More Tools
                    <span className="toolbar-dropdown-protocol-icons" aria-hidden="true">
                      <img src={meshtasticIcon} alt="" className="toolbar-protocol-icon" />
                      <img src={meshcoreIcon} alt="" className="toolbar-protocol-icon" />
                      <img src={reticulumIcon} alt="" className="toolbar-protocol-icon" />
                    </span>
                  </button>
                  <div className="toolbar-dropdown-separator" />
                  <button
                    className={`toolbar-dropdown-item${!hasLOSOverlays ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasLOSOverlays && handleItemClick(onLinkReport)}
                    title="View a detailed table of all LOS links with distance, signal, and quality metrics">
                    Link Report
                  </button>
                  <div className="toolbar-dropdown-separator" />
                  <button
                    className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasPlan && handleItemClick(onExportMaterialList)}
                    title="Generate a Bill of Materials listing all devices, antennas, and accessories with costs">
                    Export Material List
                  </button>
                  <button
                    className={`toolbar-dropdown-item${!hasPlan ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasPlan && handleItemClick(onExportNetworkPDF)}
                    title="Generate a professional PDF report with network topology, link quality, and recommendations">
                    Export Network Report (PDF)
                  </button>
                  <div className="toolbar-dropdown-separator" />
                  <button
                    className="toolbar-dropdown-item"
                    type="button"
                    onClick={() => handleItemClick(onSaveScreenshot)}
                    title="Save the current map view as a PNG image">
                    Save Screenshot
                  </button>
                  <button
                    className={`toolbar-dropdown-item toolbar-dropdown-item-danger${!hasOverlays ? ' disabled' : ''}`}
                    type="button"
                    onClick={() => hasOverlays && handleItemClick(onClearOverlays)}
                    title="Remove all analysis overlays (LOS, coverage, viewshed, routes) from the map">
                    Clear Overlays
                  </button>
                </div>
              )}
            </div>

            {/* Catalog Menu */}
            <div className="toolbar-menu">
              <button
                className={`toolbar-menu-btn${openMenu === 'catalog' ? ' active' : ''}`}
                type="button"
                onClick={() => handleMenuClick('catalog')}
              >
                Catalog <span className="menu-arrow" aria-hidden="true">&#9662;</span>
              </button>
              {openMenu === 'catalog' && (
                <div className="toolbar-dropdown">
                  <button className="toolbar-dropdown-item" type="button"
                    onClick={() => handleItemClick(onOpenCatalog)}
                    title="Add, edit, or remove devices, antennas, cables, and PA modules in the hardware catalog">
                    Manage Catalog
                  </button>
                </div>
              )}
            </div>

            {/* Help — opens modal, not a dropdown */}
            <div className="toolbar-menu">
              <button
                className={`toolbar-menu-btn${openMenu === 'appinfo' ? ' active' : ''}`}
                type="button"
                onClick={() => handleMenuClick('appinfo')}
              >
                Help
              </button>
            </div>
          </div>
        </div>
        <nav className="toolbar-actions">
          <span className="toolbar-version">v1.2.0</span>
          <button
            className="toolbar-exit-btn"
            type="button"
            onClick={onExitApp}
            title="Close the Mesh Community Planner application"
            aria-label="Exit application"
          >
            Exit
          </button>
        </nav>
      </div>
      {/* Help Modal */}
      {openMenu === 'appinfo' && (
        <div className="appinfo-overlay" onClick={() => setOpenMenu(null)} role="dialog" aria-modal="true" aria-label="App Info" ref={appInfoRef}>
          <div className="appinfo-modal" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <div className="appinfo-modal-header">
              <div>
                <div className="appinfo-title">Mesh Community Planner</div>
                <div className="appinfo-version">Version 1.2.0</div>
              </div>
              <button className="appinfo-close" type="button" onClick={() => setOpenMenu(null)} title="Close">&times;</button>
            </div>

            <div className="appinfo-modal-body">
              {/* About — always expanded */}
              <div className="appinfo-section">
                <div className="appinfo-heading">About</div>
                <p className="appinfo-text">
                  Open-source LoRa mesh network planning tool for Meshtastic, MeshCore, and Reticulum
                  communities. Provides line-of-sight analysis, terrain-aware coverage modeling, bill of
                  materials generation, and deployment planning.
                </p>
              </div>

              {/* Feature Guide — collapsible, blue accent */}
              <div className="appinfo-section appinfo-section-guide">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('guide')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('guide')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('guide'); } }}
                >
                  Feature Guide for Community Planners
                  <span className="appinfo-chevron">{expandedHelpSections.has('guide') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('guide') && (
                  <div className="appinfo-section-body">
                    <ul className="appinfo-guide-list">
                      <li><strong>Plan Management</strong> &mdash; Organize multiple deployment scenarios; compare options for your area</li>
                      <li><strong>Interactive Map &amp; Node Placement</strong> &mdash; Place nodes on a real map around community centers, shelters, key intersections</li>
                      <li><strong>Line-of-Sight &amp; Coverage Analysis</strong> &mdash; See which nodes can communicate before buying anything; identify gaps</li>
                      <li><strong>CSV Import &amp; Export</strong> &mdash; Bring in locations from a spreadsheet; share plans with volunteers and stakeholders</li>
                      <li><strong>KML Export for Mapping</strong> &mdash; Export to Google Earth for grant applications, community presentations, government coordination</li>
                      <li><strong>Channel Capacity Estimator</strong> &mdash; Understand device limits before congestion; plan for community growth</li>
                      <li><strong>LoRa Airtime Calculator</strong> &mdash; Estimate message timing and battery life for solar/battery nodes in remote locations</li>
                      <li><strong>Bill of Materials &amp; Cost Estimation</strong> &mdash; Shopping list with costs for budgeting, grant writing, procurement</li>
                      <li><strong>Message Flooding Simulation</strong> &mdash; Visualize how messages propagate hop-by-hop through your mesh; identify bottlenecks and unreachable nodes</li>
                      <li><strong>Automatic Node Placement</strong> &mdash; Get AI-suggested locations for new nodes to maximize coverage across your community area</li>
                      <li><strong>Professional PDF Report</strong> &mdash; Generate multi-page network reports with executive summary, node inventory, link quality, and BOM for stakeholders</li>
                      <li><strong>GeoJSON Export</strong> &mdash; Export plan data as GeoJSON for use in GIS tools, web maps, and data analysis workflows</li>
                      <li><strong>Viewshed Analysis</strong> &mdash; Analyze terrain visibility from any node to determine which other nodes have clear line-of-sight</li>
                      <li><strong>Elevation Heatmap</strong> &mdash; Toggle a terrain elevation overlay using NASA SRTM 30m data. The hypsometric color scale runs from steel-blue (below sea level) through greens, yellows, and oranges to snow-white (high peaks), with terrain-type labels (Coastal, Lowland, Mountain, Alpine&hellip;) shown beside each color swatch. Use the dual-handle range slider to stretch the full color spectrum across your local elevation band for maximum contrast in flat terrain &mdash; drag the Min/Max thumbs, type values directly into the number fields (press Enter to apply), or scroll the mouse wheel on a focused thumb for fine 10m adjustments. Page&nbsp;Up/Down moves a focused slider ±100m. Check <em>Remember range</em> to persist your Min/Max settings across browser sessions via localStorage. The opacity slider controls overlay transparency (0&thinsp;%&ndash;100&thinsp;%).</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Catalog Data — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('catalog')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('catalog')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('catalog'); } }}
                >
                  Catalog Data
                  <span className="appinfo-chevron">{expandedHelpSections.has('catalog') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('catalog') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      All hardware catalog data — including device specifications, antenna parameters, cable
                      losses, and pricing — is stored locally within this application and is provided for
                      estimation and planning purposes only. Catalog data can be customized via the Catalog
                      Manager (toolbar &rarr; Catalog &rarr; Manage Catalog). The user is solely responsible
                      for maintaining accurate pricing and specification data. Always verify current pricing
                      and specifications with your preferred supplier before making purchasing decisions.
                    </p>
                  </div>
                )}
              </div>

              {/* Electrical Safety — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('electrical')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('electrical')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('electrical'); } }}
                >
                  Electrical Safety
                  <span className="appinfo-chevron">{expandedHelpSections.has('electrical') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('electrical') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      All work involving electronics installation, electrical wiring, soldering, battery
                      connections, and power supply assembly should be performed by or under the supervision
                      of qualified personnel. Lithium batteries pose fire and explosion risks if mishandled,
                      short-circuited, overcharged, or physically damaged. Always use appropriate battery
                      protection circuits (BMS) and follow manufacturer specifications.
                    </p>
                  </div>
                )}
              </div>

              {/* Antenna & RF — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('antenna')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('antenna')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('antenna'); } }}
                >
                  Antenna &amp; RF Equipment
                  <span className="appinfo-chevron">{expandedHelpSections.has('antenna') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('antenna') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      Antenna installations must comply with local regulations including FCC Part 15/97 (US),
                      ETSI EN 300 220 (EU), or equivalent authority in your region. Exceeding legal transmit
                      power limits or using unauthorized frequency bands may result in regulatory penalties.
                      RF exposure limits must be observed — maintain safe distances from active antennas as
                      specified by the device manufacturer.
                    </p>
                  </div>
                )}
              </div>

              {/* LoRa Airtime — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('airtime')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('airtime')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('airtime'); } }}
                >
                  LoRa Airtime Calculations
                  <span className="appinfo-chevron">{expandedHelpSections.has('airtime') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('airtime') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      The LoRa Airtime Calculator uses the standard Semtech time-on-air formula (SX1276/SX1262
                      datasheets) to estimate packet transmission duration. These calculations are mathematical
                      approximations based on ideal conditions and do not account for real-world factors such as
                      channel access delays, retransmissions, protocol overhead (Meshtastic headers, routing),
                      frequency hopping dwell times, or receiver processing time.
                    </p>
                    <p className="appinfo-text">
                      Duty cycle limits shown (10% for EU 868 MHz, 100% for US 915 MHz) are simplified
                      regulatory references. Actual duty cycle regulations vary by sub-band, region, and
                      application. Consult your regional authority (FCC, ETSI, etc.) for binding requirements.
                      Battery consumption estimates are based on catalog TX current values and assume continuous
                      transmission at the stated current draw — actual consumption will vary with device
                      firmware, sleep modes, and operating conditions.
                    </p>
                  </div>
                )}
              </div>

              {/* Data Import & Export — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('importexport')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('importexport')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('importexport'); } }}
                >
                  Data Import &amp; Export
                  <span className="appinfo-chevron">{expandedHelpSections.has('importexport') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('importexport') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      CSV export includes all node configuration fields; re-importing a CSV preserves exact
                      settings for each node. CSV import auto-fills missing fields from the plan&apos;s current
                      radio defaults &mdash; verify critical settings (frequency, TX power, modem preset) after
                      importing.
                    </p>
                    <p className="appinfo-text">
                      KML export is for visualization only; KML files cannot be re-imported into the planner.
                      Coordinate accuracy depends on the source data; GPS coordinates should use the WGS84 datum
                      (standard for most consumer GPS devices and mapping services).
                    </p>
                  </div>
                )}
              </div>

              {/* Channel Capacity — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('capacity')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('capacity')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('capacity'); } }}
                >
                  Channel Capacity Estimation
                  <span className="appinfo-chevron">{expandedHelpSections.has('capacity') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('capacity') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      The Channel Capacity Estimator uses the Pure ALOHA model, which assumes a single collision
                      domain where all nodes can hear all other nodes. Real Meshtastic mesh networks use frequency
                      hopping and time-slotted channel access, which changes collision dynamics significantly.
                    </p>
                    <p className="appinfo-text">
                      The estimator does not model retransmissions, routing overhead, or multi-hop relay
                      amplification. Estimates are intentionally conservative &mdash; actual network capacity may be
                      higher with Meshtastic&apos;s managed flooding protocol. Use the results as planning guidance,
                      not as precise performance guarantees.
                    </p>
                  </div>
                )}
              </div>

              {/* Antenna Mounting — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('mounting')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('mounting')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('mounting'); } }}
                >
                  Antenna Mounting &amp; Elevated Installations
                  <span className="appinfo-chevron">{expandedHelpSections.has('mounting') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('mounting') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      Mounting antennas on rooftops, towers, masts, or other elevated structures involves
                      risk of falls, structural damage, and electrical hazard. All elevated installations
                      should be performed by qualified personnel using proper fall protection equipment.
                      Installations must be properly grounded and lightning-protected per local electrical
                      codes. Consider wind loading, ice loading, and structural capacity of mounting surfaces.
                      Consult a structural engineer for tower or heavy mast installations.
                    </p>
                  </div>
                )}
              </div>

              {/* Solar & Outdoor — collapsible */}
              <div className="appinfo-section">
                <div
                  className="appinfo-heading appinfo-heading-collapsible"
                  onClick={() => toggleHelpSection('solar')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedHelpSections.has('solar')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHelpSection('solar'); } }}
                >
                  Solar &amp; Outdoor Installations
                  <span className="appinfo-chevron">{expandedHelpSections.has('solar') ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedHelpSections.has('solar') && (
                  <div className="appinfo-section-body">
                    <p className="appinfo-text">
                      Outdoor and solar-powered installations must use weatherproof enclosures rated for the
                      deployment environment (IP65 or higher recommended). Solar panels and charge controllers
                      must be sized appropriately for the load and local solar conditions. All outdoor wiring
                      must use UV-resistant cable and weatherproof connectors. Ensure proper ventilation to
                      prevent battery overheating in enclosed installations.
                    </p>
                  </div>
                )}
              </div>

              {/* Legal Disclaimer — always expanded */}
              <div className="appinfo-section appinfo-section-legal">
                <div className="appinfo-heading">Legal Disclaimer</div>
                <p className="appinfo-text">
                  This software is provided for planning purposes only, on an &ldquo;as is&rdquo; basis without
                  warranties of any kind, either express or implied. The user assumes all responsibility
                  for electronics installation, electrical wiring, device assembly, antenna mounting,
                  structural modifications, and regulatory compliance. The software developers and
                  contributors assume no liability for damage, injury, property loss, regulatory
                  violations, or any other consequences resulting from the use of this tool or its output.
                </p>
                <p className="appinfo-text">
                  Coverage predictions, line-of-sight analyses, and cost estimates are approximations
                  based on mathematical models and catalog data. Actual performance will vary based on
                  terrain, weather, obstructions, equipment condition, and installation quality. Always
                  verify results with field testing before making purchasing or deployment decisions.
                </p>
              </div>
            </div>

            <div className="appinfo-modal-footer">
              <div className="appinfo-footer-btns">
                <button
                  className="appinfo-tour-btn"
                  type="button"
                  onClick={() => { setOpenMenu(null); onShowTour?.(); }}
                  title="Walk through the main features of Mesh Community Planner step by step"
                >
                  Show App Tour
                </button>
                <button
                  className="appinfo-tour-btn"
                  type="button"
                  onClick={() => { setOpenMenu(null); onShowCatalogTour?.(); }}
                  title="Walk through how to use the Hardware Catalog Manager"
                >
                  Show Catalog Manager Tour
                </button>
              </div>
              <span>Map data: OpenStreetMap contributors (ODbL). Elevation data: NASA SRTM.</span>
            </div>
          </div>
        </div>
      )}

      {/* More Tools Modal */}
      {openMenu === 'moretools' && (
        <div className="appinfo-overlay" onClick={() => setOpenMenu(null)} role="dialog" aria-modal="true" aria-label="More Tools" ref={moreToolsRef}>
          <div className="appinfo-modal" style={{ width: '580px' }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <div className="appinfo-modal-header">
              <div>
                <div className="appinfo-title">More Tools</div>
                <div className="appinfo-version">Select your LoRa mesh protocol</div>
              </div>
              <button className="appinfo-close" type="button" onClick={() => setOpenMenu(null)} title="Close">&times;</button>
            </div>
            <div className="appinfo-modal-body" style={{ paddingTop: '1rem' }}>

              {/* Protocol Selector */}
              <div className="moretools-protocol-tabs" role="tablist" aria-label="Protocol selection">
                <button
                  className={`moretools-tab${moreToolsProtocol === 'meshtastic' ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={moreToolsProtocol === 'meshtastic'}
                  onClick={() => setMoreToolsProtocol('meshtastic')}
                >
                  <img src={meshtasticIcon} alt="" aria-hidden="true" className="moretools-tab-icon" />
                  <span>Meshtastic</span>
                </button>
                <button
                  className={`moretools-tab${moreToolsProtocol === 'meshcore' ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={moreToolsProtocol === 'meshcore'}
                  onClick={() => setMoreToolsProtocol('meshcore')}
                >
                  <img src={meshcoreIcon} alt="" aria-hidden="true" className="moretools-tab-icon" />
                  <span>MeshCore</span>
                </button>
                <button
                  className={`moretools-tab${moreToolsProtocol === 'reticulum' ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={moreToolsProtocol === 'reticulum'}
                  onClick={() => setMoreToolsProtocol('reticulum')}
                >
                  <img src={reticulumIcon} alt="" aria-hidden="true" className="moretools-tab-icon" />
                  <span>Reticulum</span>
                </button>
              </div>

              {/* No selection yet */}
              {!moreToolsProtocol && (
                <div className="moretools-pick-prompt">
                  Choose a protocol above to see available tools and calculators.
                </div>
              )}

              {/* Meshtastic tools */}
              {moreToolsProtocol === 'meshtastic' && (
                <div className="moretools-protocol-section" role="tabpanel">
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onTimeOnAir?.(); }}
                    title="Calculate LoRa packet airtime, data rate, and duty cycle">
                    <span className="moretools-btn-name">LoRa Airtime Calculator</span>
                    <span className="moretools-btn-desc">Packet airtime, data rate, and duty cycle for any modem preset</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onChannelCapacity?.(); }}
                    title="Estimate channel utilization and find optimal modem preset">
                    <span className="moretools-btn-name">Channel Capacity Estimator</span>
                    <span className="moretools-btn-desc">Channel utilization, collision probability, and optimal preset for your node count</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    disabled={!hasPlan || !hasLOSOverlays}
                    onClick={() => { setOpenMenu(null); if (hasPlan && hasLOSOverlays) onFloodSim?.(); }}
                    title={!hasPlan ? 'Open a plan first' : !hasLOSOverlays ? 'Run Line of Sight analysis first' : 'Simulate message flooding through the mesh'}>
                    <span className="moretools-btn-name">Message Flooding Simulator</span>
                    <span className="moretools-btn-desc">
                      {!hasLOSOverlays ? 'Requires LOS analysis — run Tools \u2192 Line of Sight first' : 'Simulate message propagation hop-by-hop through your mesh network'}
                    </span>
                  </button>
                  <button className="moretools-btn" type="button"
                    disabled={!hasPlan}
                    onClick={() => { setOpenMenu(null); if (hasPlan) onSuggestPlacement?.(); }}
                    title="Get suggested node placement locations to maximize coverage">
                    <span className="moretools-btn-name">Suggest Node Placement</span>
                    <span className="moretools-btn-desc">AI-assisted placement suggestions to maximize mesh coverage</span>
                  </button>
                </div>
              )}

              {/* MeshCore tools */}
              {moreToolsProtocol === 'meshcore' && (
                <div className="moretools-protocol-section" role="tabpanel">
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onRepeaterChain?.(); }}
                    title="Calculate hop-by-hop link budget for a MeshCore repeater chain">
                    <span className="moretools-btn-name">Repeater Chain Calculator</span>
                    <span className="moretools-btn-desc">Hop-by-hop link budget and signal margin across a chain of MeshCore repeaters</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onMeshCoreAirtime?.(); }}
                    title="Calculate duty cycle compliance and required airtime factor for your MeshCore repeater">
                    <span className="moretools-btn-name">Airtime &amp; Duty Cycle Calculator</span>
                    <span className="moretools-btn-desc">Duty cycle budget, EU regulatory compliance, and required AF for your RF profile</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onMeshCoreCapacity?.(); }}
                    title="Plan repeater count and flood.max for your MeshCore network density">
                    <span className="moretools-btn-name">Network Density Planner</span>
                    <span className="moretools-btn-desc">Client ACL limits, neighbor table saturation, flood traffic load, and flood.max recommendations</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onMeshCoreFreqCoord?.(); }}
                    title="Coordinate channel frequencies across multiple co-located MeshCore networks">
                    <span className="moretools-btn-name">RF Channel Frequency Coordinator</span>
                    <span className="moretools-btn-desc">Assign non-interfering center frequencies to co-located MeshCore networks in metro deployments</span>
                  </button>
                </div>
              )}

              {/* Reticulum tools */}
              {moreToolsProtocol === 'reticulum' && (
                <div className="moretools-protocol-section" role="tabpanel">
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onReticulumAnnounce?.(); }}
                    title="Calculate safe announce intervals and channel utilization for Reticulum over LoRa/RNode">
                    <span className="moretools-btn-name">Announce Rate Calculator</span>
                    <span className="moretools-btn-desc">Safe announce intervals and channel utilization for Reticulum over LoRa / RNode</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onRNSLinkBudget?.(); }}
                    title="Full link budget and range estimate for RNode-to-RNode hops">
                    <span className="moretools-btn-name">RNode Link Budget &amp; Range</span>
                    <span className="moretools-btn-desc">SX1276/SX1262 chipset link budget, max range estimate, and RNS 5 bps minimum check</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onRNSTransport?.(); }}
                    title="How many transport nodes your RNS network needs and where to place them">
                    <span className="moretools-btn-name">Transport Node Placement Advisor</span>
                    <span className="moretools-btn-desc">Minimum transport nodes, announce budget consumption, interface mode guidance, and SPOF detection</span>
                  </button>
                  <button className="moretools-btn" type="button"
                    onClick={() => { setOpenMenu(null); onRNSThroughput?.(); }}
                    title="Calculate end-to-end throughput and LXMF delivery time across multi-interface Reticulum paths">
                    <span className="moretools-btn-name">Multi-Interface Throughput Analyzer</span>
                    <span className="moretools-btn-desc">End-to-end throughput, LXMF delivery time, and bottleneck identification across mixed LoRa/WiFi/TCP/I2P paths</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </header>
  );
}
