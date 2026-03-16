/**
 * KMLExportDialog
 *
 * Shown after the user exports a plan as KML. Explains what KML is and
 * lists compatible apps the file can be opened in.
 */

import React from 'react';
import './KMLExportDialog.css';

interface KMLExportDialogProps {
  nodeCount: number;
  linkCount: number;
  onClose: () => void;
}

const MOBILE_APPS = [
  { name: 'ATAK CIV / iTAK / WinTAK', how: 'Import Manager → Local SD → select .kml' },
  { name: 'Caltopo', how: 'Import → KML/KMZ — ideal for SAR and emergency management' },
  { name: 'Gaia GPS', how: 'Tap + → Import file' },
  { name: 'OsmAnd', how: 'Menu → My Places → Import' },
  { name: 'Avenza Maps', how: 'Map Store → Import map' },
  { name: 'OruxMaps', how: 'Routes/Tracks → Import' },
];

const DESKTOP_APPS = [
  { name: 'Google Earth', how: 'Drag and drop the file onto the map' },
  { name: 'QGIS', how: 'Layer → Add Layer → Add Vector Layer' },
  { name: 'ArcGIS', how: 'Add Data → KML/KMZ' },
  { name: 'Google My Maps', how: 'Import → select file' },
];

export function KMLExportDialog({ nodeCount, linkCount, onClose }: KMLExportDialogProps) {
  return (
    <div className="kml-dialog-overlay" role="dialog" aria-modal="true" aria-label="KML export help">
      <div className="kml-dialog">
        <div className="kml-dialog-header">
          <span className="kml-dialog-title">KML Exported</span>
          <button
            className="kml-dialog-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >×</button>
        </div>

        <div className="kml-dialog-body">
          <p className="kml-dialog-summary">
            Exported <strong>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</strong>
            {linkCount > 0 && <> and <strong>{linkCount} LOS link{linkCount !== 1 ? 's' : ''}</strong></>}
            {' '}as a standard KML file. Open it in any app below to view your plan on a map.
          </p>

          <div className="kml-dialog-columns">
            <div className="kml-dialog-col">
              <h4 className="kml-dialog-col-title">Mobile &amp; Field</h4>
              <ul className="kml-dialog-app-list">
                {MOBILE_APPS.map((app) => (
                  <li key={app.name}>
                    <span className="kml-app-name">{app.name}</span>
                    <span className="kml-app-how">{app.how}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="kml-dialog-col">
              <h4 className="kml-dialog-col-title">Desktop &amp; Web GIS</h4>
              <ul className="kml-dialog-app-list">
                {DESKTOP_APPS.map((app) => (
                  <li key={app.name}>
                    <span className="kml-app-name">{app.name}</span>
                    <span className="kml-app-how">{app.how}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="kml-dialog-tip">
            The exported file includes node locations, names, frequencies, and any
            line-of-sight links you have analyzed. KML is an open standard — if your
            preferred mapping app is not listed, it almost certainly supports it too.
          </p>
        </div>

        <div className="kml-dialog-footer">
          <button className="kml-dialog-btn" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
