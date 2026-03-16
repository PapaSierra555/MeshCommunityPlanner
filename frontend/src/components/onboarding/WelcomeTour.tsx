/**
 * WelcomeTour — Onboarding Wizard
 * Dark-themed 7-step tour covering all major features.
 * Shows automatically on first launch; user can dismiss permanently.
 */

import { useState, useEffect, useCallback } from 'react';
import './WelcomeTour.css';

export interface WelcomeTourProps {
  onComplete?: () => void;
  /** When true, show regardless of localStorage (used with key prop for re-trigger). */
  forceShow?: boolean;
}

// Permanent dismiss key — stores the build ID when user opts out.
// When a new build is deployed, the stored build ID won't match and the tour re-appears.
const PERMANENT_KEY = 'meshPlannerTourPermanentDismiss';
// Session dismiss key — stores the auth token of the session that dismissed the tour.
// When the app restarts, a new auth token is generated, so this naturally expires.
const SESSION_KEY = 'meshPlannerTourSession';
// Legacy key from previous implementation — cleaned up on mount
const LEGACY_KEY = 'meshPlannerTourDismissed_v2';

const TOTAL_STEPS = 9;

/** Get the current session's auth token (changes every app restart). */
function getSessionToken(): string {
  return (window as any).__MESH_PLANNER_AUTH__ || '';
}

/** Check if the tour was dismissed in the current session. */
function isDismissedThisSession(): boolean {
  return localStorage.getItem(SESSION_KEY) === getSessionToken();
}

/** Check if the user permanently opted out of the tour for this build. */
function isPermanentlyDismissed(): boolean {
  return localStorage.getItem(PERMANENT_KEY) === __BUILD_ID__;
}

interface TourStep {
  title: string;
  content: string;
  bullets?: string[];
  tip?: string;
  icon: JSX.Element;
}

/* ---------- SVG Illustrations per step ---------- */

const IconWelcome = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    <rect x="10" y="15" width="100" height="60" rx="6" stroke="#4472C4" strokeWidth="2" fill="rgba(68,114,196,0.1)" />
    <circle cx="35" cy="38" r="6" fill="#2ecc71" />
    <circle cx="85" cy="38" r="6" fill="#2ecc71" />
    <circle cx="60" cy="58" r="6" fill="#2ecc71" />
    <line x1="35" y1="38" x2="85" y2="38" stroke="#4472C4" strokeWidth="1.5" strokeDasharray="4 2" />
    <line x1="35" y1="38" x2="60" y2="58" stroke="#4472C4" strokeWidth="1.5" strokeDasharray="4 2" />
    <line x1="85" y1="38" x2="60" y2="58" stroke="#4472C4" strokeWidth="1.5" strokeDasharray="4 2" />
    <text x="60" y="12" textAnchor="middle" fill="#7fb3f0" fontSize="8" fontWeight="600">MESH NETWORK</text>
  </svg>
);

const IconPlan = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    <rect x="15" y="10" width="90" height="70" rx="4" stroke="#4472C4" strokeWidth="2" fill="rgba(68,114,196,0.08)" />
    <rect x="22" y="20" width="50" height="6" rx="2" fill="#4472C4" opacity="0.6" />
    <rect x="22" y="30" width="35" height="4" rx="2" fill="#95a5a6" opacity="0.5" />
    <rect x="22" y="38" width="76" height="1" fill="#34495e" />
    <rect x="22" y="44" width="60" height="4" rx="2" fill="#95a5a6" opacity="0.4" />
    <rect x="22" y="52" width="60" height="4" rx="2" fill="#95a5a6" opacity="0.4" />
    <rect x="22" y="60" width="40" height="4" rx="2" fill="#95a5a6" opacity="0.4" />
    <rect x="68" y="64" width="30" height="10" rx="3" fill="#2ecc71" opacity="0.7" />
    <text x="83" y="72" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="600">OPEN</text>
  </svg>
);

const IconMap = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    <rect x="5" y="5" width="110" height="80" rx="4" stroke="#34495e" strokeWidth="1.5" fill="rgba(37,52,67,0.3)" />
    <path d="M5 40 Q30 25, 55 35 T110 30" stroke="#2ecc71" strokeWidth="1" opacity="0.3" fill="none" />
    <path d="M5 55 Q40 45, 70 50 T110 48" stroke="#2ecc71" strokeWidth="1" opacity="0.2" fill="none" />
    {/* Nodes */}
    <circle cx="30" cy="30" r="5" fill="#e74c3c" stroke="#fff" strokeWidth="1.5" />
    <circle cx="75" cy="45" r="5" fill="#e74c3c" stroke="#fff" strokeWidth="1.5" />
    <circle cx="50" cy="65" r="5" fill="#e74c3c" stroke="#fff" strokeWidth="1.5" />
    <circle cx="95" cy="25" r="5" fill="#e74c3c" stroke="#fff" strokeWidth="1.5" />
    {/* Cursor */}
    <path d="M88 58 L92 68 L95 64 L100 68 L102 65 L97 61 L101 58 Z" fill="#ecf0f1" stroke="#1e2a38" strokeWidth="0.5" />
  </svg>
);

const IconRadio = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Antenna */}
    <line x1="60" y1="15" x2="60" y2="55" stroke="#95a5a6" strokeWidth="2" />
    <circle cx="60" cy="12" r="3" fill="#e74c3c" />
    {/* Signal waves */}
    <path d="M45 25 Q38 35, 45 45" stroke="#4472C4" strokeWidth="1.5" fill="none" opacity="0.5" />
    <path d="M38 20 Q28 35, 38 50" stroke="#4472C4" strokeWidth="1.5" fill="none" opacity="0.3" />
    <path d="M75 25 Q82 35, 75 45" stroke="#4472C4" strokeWidth="1.5" fill="none" opacity="0.5" />
    <path d="M82 20 Q92 35, 82 50" stroke="#4472C4" strokeWidth="1.5" fill="none" opacity="0.3" />
    {/* Base box */}
    <rect x="45" y="55" width="30" height="20" rx="3" stroke="#4472C4" strokeWidth="1.5" fill="rgba(68,114,196,0.15)" />
    <text x="60" y="68" textAnchor="middle" fill="#7fb3f0" fontSize="7" fontWeight="600">SF11</text>
    <text x="60" y="84" textAnchor="middle" fill="#95a5a6" fontSize="6">906.875 MHz</text>
  </svg>
);

const IconAnalysis = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Two nodes with LOS line */}
    <circle cx="25" cy="50" r="5" fill="#2ecc71" stroke="#fff" strokeWidth="1.5" />
    <circle cx="95" cy="30" r="5" fill="#2ecc71" stroke="#fff" strokeWidth="1.5" />
    <line x1="25" y1="50" x2="95" y2="30" stroke="#16a34a" strokeWidth="2" />
    {/* Terrain */}
    <path d="M5 75 L25 65 L45 70 L60 55 L75 60 L95 50 L115 65 L115 85 L5 85 Z" fill="rgba(46,204,113,0.1)" stroke="#2ecc71" strokeWidth="1" />
    {/* Fresnel zone */}
    <ellipse cx="60" cy="40" rx="35" ry="8" stroke="#eab308" strokeWidth="1" strokeDasharray="3 2" fill="none" opacity="0.5" />
    {/* Coverage circle */}
    <circle cx="25" cy="50" r="18" stroke="#4472C4" strokeWidth="1" strokeDasharray="3 2" fill="rgba(68,114,196,0.08)" />
    <text x="60" y="12" textAnchor="middle" fill="#7fb3f0" fontSize="7" fontWeight="600">LINE OF SIGHT</text>
  </svg>
);

const IconAirtime = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Clock face */}
    <circle cx="60" cy="45" r="30" stroke="#4472C4" strokeWidth="2" fill="rgba(68,114,196,0.08)" />
    <circle cx="60" cy="45" r="1.5" fill="#ecf0f1" />
    {/* Clock hands */}
    <line x1="60" y1="45" x2="60" y2="24" stroke="#ecf0f1" strokeWidth="2" strokeLinecap="round" />
    <line x1="60" y1="45" x2="75" y2="45" stroke="#ecf0f1" strokeWidth="1.5" strokeLinecap="round" />
    {/* Hour markers */}
    <line x1="60" y1="17" x2="60" y2="20" stroke="#7fb3f0" strokeWidth="1.5" />
    <line x1="60" y1="70" x2="60" y2="73" stroke="#7fb3f0" strokeWidth="1.5" />
    <line x1="32" y1="45" x2="35" y2="45" stroke="#7fb3f0" strokeWidth="1.5" />
    <line x1="85" y1="45" x2="88" y2="45" stroke="#7fb3f0" strokeWidth="1.5" />
    {/* RF wave arcs */}
    <path d="M95 30 Q102 40, 95 50" stroke="#2ecc71" strokeWidth="1.5" fill="none" opacity="0.6" />
    <path d="M100 25 Q110 40, 100 55" stroke="#2ecc71" strokeWidth="1.5" fill="none" opacity="0.4" />
    {/* Label */}
    <text x="60" y="86" textAnchor="middle" fill="#7fb3f0" fontSize="7" fontWeight="600">TIME ON AIR</text>
  </svg>
);

const IconDataIO = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Spreadsheet */}
    <rect x="20" y="10" width="50" height="60" rx="3" stroke="#27ae60" strokeWidth="1.5" fill="rgba(39,174,96,0.08)" />
    <line x1="20" y1="22" x2="70" y2="22" stroke="#27ae60" strokeWidth="1" opacity="0.4" />
    <line x1="20" y1="34" x2="70" y2="34" stroke="#27ae60" strokeWidth="1" opacity="0.4" />
    <line x1="20" y1="46" x2="70" y2="46" stroke="#27ae60" strokeWidth="1" opacity="0.4" />
    <line x1="20" y1="58" x2="70" y2="58" stroke="#27ae60" strokeWidth="1" opacity="0.4" />
    <line x1="40" y1="10" x2="40" y2="70" stroke="#27ae60" strokeWidth="1" opacity="0.4" />
    <text x="30" y="18" textAnchor="middle" fill="#27ae60" fontSize="5" fontWeight="600">CSV</text>
    {/* Right arrow (export) */}
    <path d="M75 30 L95 30 L95 24 L108 35 L95 46 L95 40 L75 40 Z" fill="#4472C4" opacity="0.6" />
    {/* Left arrow (import) */}
    <path d="M75 55 L95 55 L95 49 L108 60 L95 71 L95 65 L75 65 Z" fill="#e67e22" opacity="0.6" transform="scale(-1,1) translate(-183,0)" />
  </svg>
);

const IconCapacity = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* Network nodes */}
    <circle cx="25" cy="30" r="5" fill="#2ecc71" stroke="#fff" strokeWidth="1" />
    <circle cx="55" cy="20" r="5" fill="#2ecc71" stroke="#fff" strokeWidth="1" />
    <circle cx="85" cy="30" r="5" fill="#2ecc71" stroke="#fff" strokeWidth="1" />
    <circle cx="40" cy="50" r="5" fill="#2ecc71" stroke="#fff" strokeWidth="1" />
    <circle cx="70" cy="50" r="5" fill="#2ecc71" stroke="#fff" strokeWidth="1" />
    {/* Links */}
    <line x1="25" y1="30" x2="55" y2="20" stroke="#4472C4" strokeWidth="1" opacity="0.4" />
    <line x1="55" y1="20" x2="85" y2="30" stroke="#4472C4" strokeWidth="1" opacity="0.4" />
    <line x1="25" y1="30" x2="40" y2="50" stroke="#4472C4" strokeWidth="1" opacity="0.4" />
    <line x1="85" y1="30" x2="70" y2="50" stroke="#4472C4" strokeWidth="1" opacity="0.4" />
    <line x1="40" y1="50" x2="70" y2="50" stroke="#4472C4" strokeWidth="1" opacity="0.4" />
    {/* Gauge meter */}
    <path d="M35 80 A25 25 0 0 1 85 80" stroke="#34495e" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M35 80 A25 25 0 0 1 68 62" stroke="#2ecc71" strokeWidth="4" fill="none" strokeLinecap="round" />
    {/* Gauge needle */}
    <line x1="60" y1="80" x2="68" y2="64" stroke="#ecf0f1" strokeWidth="2" strokeLinecap="round" />
    <circle cx="60" cy="80" r="2" fill="#ecf0f1" />
    <text x="60" y="88" textAnchor="middle" fill="#7fb3f0" fontSize="5" fontWeight="600">CAPACITY</text>
  </svg>
);

const IconExport = () => (
  <svg viewBox="0 0 120 90" fill="none" className="tour-icon">
    {/* PDF document */}
    <rect x="10" y="10" width="30" height="38" rx="2" stroke="#e74c3c" strokeWidth="1.5" fill="rgba(231,76,60,0.1)" />
    <text x="25" y="34" textAnchor="middle" fill="#e74c3c" fontSize="8" fontWeight="700">PDF</text>
    {/* CSV document */}
    <rect x="45" y="10" width="30" height="38" rx="2" stroke="#27ae60" strokeWidth="1.5" fill="rgba(39,174,96,0.1)" />
    <text x="60" y="34" textAnchor="middle" fill="#27ae60" fontSize="8" fontWeight="700">CSV</text>
    {/* Cards */}
    <rect x="80" y="10" width="30" height="38" rx="2" stroke="#e67e22" strokeWidth="1.5" fill="rgba(230,126,34,0.1)" />
    <text x="95" y="34" textAnchor="middle" fill="#e67e22" fontSize="7" fontWeight="700">CARDS</text>
    {/* Download arrow */}
    <path d="M55 58 L65 58 L65 65 L72 65 L60 78 L48 65 L55 65 Z" fill="#4472C4" opacity="0.7" />
  </svg>
);

/* ---------- Step Definitions ---------- */

const STEPS: TourStep[] = [
  {
    title: 'Welcome to Mesh Community Planner',
    content: 'Plan and visualize LoRa mesh network deployments for Meshtastic, MeshCore, and Reticulum communities.',
    bullets: [
      'Interactive map with node placement and configuration',
      'Terrain-aware coverage modeling and line-of-sight analysis',
      'Import nodes directly from live MeshCore Map and Reticulum Network directories',
      'Bill of materials generation, PDF reports, CSV and KML exports',
    ],
    tip: 'This tour takes about 1 minute. You can skip it anytime and reopen it from App Info.',
    icon: <IconWelcome />,
  },
  {
    title: 'Plan Management',
    content: 'Use the Plan menu in the toolbar to create, open, import, and export network plans.',
    bullets: [
      'Create new plans or open existing ones from the database',
      'Import/export plans as .meshplan.json files for sharing',
      'Load multiple plans simultaneously for comparison',
      'Duplicate plans to experiment with different configurations',
    ],
    tip: 'Select multiple plans in the Open dialog to load them all at once on the same map.',
    icon: <IconPlan />,
  },
  {
    title: 'Map & Node Placement',
    content: 'Place and configure nodes on the interactive map to design your mesh network layout.',
    bullets: [
      'Click "Add Node" then click the map to place nodes',
      'Drag markers to reposition nodes precisely',
      'Ctrl+Click nodes to multi-select, then drag to move as a group',
      'Click a node\'s info card at the bottom to load its configuration in the sidebar',
    ],
    tip: 'Each node can be customized with device type, antenna height, TX power, and more in the sidebar config panel.',
    icon: <IconMap />,
  },
  {
    title: 'Network Radio Settings',
    content: 'All nodes in a plan must share the same radio parameters to communicate with each other.',
    bullets: [
      'Choose a Modem Preset (e.g. LongFast, ShortTurbo) to set SF/BW/CR automatically',
      'Select firmware family (Meshtastic, MeshCore, Reticulum)',
      'Pick your regulatory region to set the correct frequency',
      'Changes apply to ALL nodes in the plan simultaneously',
    ],
    tip: 'The "LongFast" preset (SF11, BW250, CR4/5) is the default Meshtastic configuration and a good starting point.',
    icon: <IconRadio />,
  },
  {
    title: 'Analysis Tools',
    content: 'Use the Tools menu to run line-of-sight analysis, terrain-aware coverage modeling, and generate link reports.',
    bullets: [
      'Line of Sight: Calculates signal viability between all node pairs using real elevation data',
      'Coverage Analysis: Generates terrain-aware heat maps showing signal reach — cancel any long-running analysis with the X button in the progress bar',
      'Elevation Heatmap: Terrain overlay with min/max range sliders, direct number entry, mouse-wheel fine-tuning, and a "Remember range" checkbox to persist your settings',
      'Radio Horizon: Each node\'s details show the theoretical radio horizon at its antenna height — the maximum distance Earth\'s curvature allows at that height',
    ],
    tip: 'In flat areas, narrow the elevation range to your local min/max — type values directly, drag sliders, or use the mouse wheel for fine-tuning. Check "Remember range" to keep your settings across sessions.',
    icon: <IconAnalysis />,
  },
  {
    title: 'LoRa Airtime Calculator',
    content: 'Use the built-in airtime calculator (Tools menu) to understand packet timing, duty cycle limits, and compare all modem presets side by side.',
    bullets: [
      'Calculate time-on-air for any combination of SF, Bandwidth, Coding Rate, and payload size',
      'See duty cycle limits: max packets/hour at 100% (US) and 10% (EU) duty cycles',
      'Compare all modem presets in a table to find the best trade-off for your network',
      'Estimate per-packet battery consumption based on your selected device\'s TX current',
    ],
    tip: 'The calculator uses the standard Semtech LoRa formula. Results are theoretical maximums — real-world performance depends on interference, retransmissions, and channel access delays.',
    icon: <IconAirtime />,
  },
  {
    title: 'Data Import & Export',
    content: 'Bulk-manage nodes via CSV, import live community directories, and export plans to field mapping apps.',
    bullets: [
      'Import Nodes (Internet): Pull live node locations from MeshCore Map or Reticulum Network — disabled automatically when you\'re offline',
      'Import nodes from CSV — share a signup form, collect locations, bulk-import to the plan',
      'Export to KML, then use the app guide to import into ATAK, Caltopo, Gaia GPS, Google Earth, QGIS, and more',
      'Export the full plan as .meshplan.json to share or back up; import on any machine',
    ],
    tip: 'CSV import only requires name, latitude, and longitude columns. All other fields auto-fill from the plan\'s current radio settings.',
    icon: <IconDataIO />,
  },
  {
    title: 'Channel Capacity Estimator',
    content: 'Predict network congestion and find the optimal modem preset for your community\'s size and message rate.',
    bullets: [
      'Enter node count and average message rate to see channel utilization',
      'Collision probability based on the Pure ALOHA access model',
      'Compare all presets to find the best throughput for your network size',
      'Get recommendations when your network is approaching capacity limits',
    ],
    tip: 'A mesh with 25+ nodes on LongFast may benefit from switching to MediumFast — the capacity estimator shows exactly where the crossover point is.',
    icon: <IconCapacity />,
  },
  {
    title: 'Bill of Materials & Export',
    content: 'Generate a complete bill of materials with cost estimates, then export as PDF, CSV, or deployment cards.',
    bullets: [
      'Tools > Export Material List opens the BOM with consolidated and per-node views',
      'Export as PDF report, CSV spreadsheet, or individual deployment cards',
      'Multi-plan support: each plan generates its own separate export files',
      'Network Report PDF includes map screenshot, node details, and link analysis',
    ],
    tip: 'The Info tab in the BOM modal explains how costs are estimated and what each category includes.',
    icon: <IconExport />,
  },
];

/* ---------- Component ---------- */

export function WelcomeTour({ onComplete, forceShow = false }: WelcomeTourProps) {
  // Clean up legacy key from previous implementation
  useEffect(() => {
    localStorage.removeItem(LEGACY_KEY);
  }, []);

  // Show tour if: forced from App Info, OR (not permanently dismissed AND not dismissed this session)
  const [isVisible, setIsVisible] = useState(() => {
    if (forceShow) return true;
    if (isPermanentlyDismissed()) return false;
    if (isDismissedThisSession()) return false;
    return true;
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(isPermanentlyDismissed);

  const dismissTour = useCallback(() => {
    // Always mark this session as "tour dismissed"
    localStorage.setItem(SESSION_KEY, getSessionToken());

    if (dontShowAgain) {
      localStorage.setItem(PERMANENT_KEY, __BUILD_ID__);
    } else {
      localStorage.removeItem(PERMANENT_KEY);
    }
    setIsVisible(false);
    onComplete?.();
  }, [dontShowAgain, onComplete]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < TOTAL_STEPS - 1) setCurrentStep((s) => s + 1);
        else dismissTour();
      } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) setCurrentStep((s) => s - 1);
      } else if (e.key === 'Escape') {
        dismissTour();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isVisible, currentStep, dismissTour]);

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL_STEPS - 1;

  return (
    <div className="tour-overlay" onClick={dismissTour}>
      <div className="tour-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tour-header">
          <div className="tour-step-label">
            Step {currentStep + 1} of {TOTAL_STEPS}
          </div>
          <button className="tour-close" type="button" onClick={dismissTour} title="Close tour">
            &times;
          </button>
        </div>

        {/* Progress bar */}
        <div className="tour-progress-bar">
          <div
            className="tour-progress-fill"
            style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="tour-body">
          <div className="tour-illustration">
            {step.icon}
          </div>
          <h2 className="tour-title">{step.title}</h2>
          <p className="tour-content">{step.content}</p>
          {step.bullets && (
            <ul className="tour-bullets">
              {step.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {step.tip && (
            <div className="tour-tip">
              <span className="tour-tip-label">TIP</span>
              <span className="tour-tip-text">{step.tip}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="tour-footer">
          <label className="tour-checkbox-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don&apos;t show this again</span>
          </label>

          <div className="tour-nav">
            <button
              className="tour-btn tour-btn-ghost"
              type="button"
              onClick={dismissTour}
            >
              Skip Tour
            </button>
            {!isFirst && (
              <button
                className="tour-btn tour-btn-secondary"
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                Previous
              </button>
            )}
            {!isLast ? (
              <button
                className="tour-btn tour-btn-primary"
                type="button"
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Next
              </button>
            ) : (
              <button
                className="tour-btn tour-btn-primary tour-btn-finish"
                type="button"
                onClick={dismissTour}
              >
                Get Started
              </button>
            )}
          </div>
        </div>

        {/* Progress dots */}
        <div className="tour-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`tour-dot${i === currentStep ? ' active' : ''}${i < currentStep ? ' visited' : ''}`}
              type="button"
              onClick={() => setCurrentStep(i)}
              title={STEPS[i].title}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default WelcomeTour;
