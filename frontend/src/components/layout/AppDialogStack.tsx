import { LinkReportModal } from '../analysis/LinkReportModal';
import { TimeOnAirModal } from '../analysis/TimeOnAirModal';
import { RepeaterChainModal } from '../analysis/RepeaterChainModal';
import { MeshCoreAirtimeModal } from '../analysis/MeshCoreAirtimeModal';
import { MeshCoreCapacityModal } from '../analysis/MeshCoreCapacityModal';
import { MeshCoreFreqCoordModal } from '../analysis/MeshCoreFreqCoordModal';
import { ChannelCapacityModal } from '../analysis/ChannelCapacityModal';
import { ReticulumAnnounceModal } from '../analysis/ReticulumAnnounceModal';
import { RNSLinkBudgetModal } from '../analysis/RNSLinkBudgetModal';
import { RNSTransportModal } from '../analysis/RNSTransportModal';
import { RNSThroughputModal } from '../analysis/RNSThroughputModal';
import { FloodingSimModal } from '../analysis/FloodingSimModal';
import { PlacementSuggestModal } from '../analysis/PlacementSuggestModal';
import { PDFReportModal } from '../analysis/PDFReportModal';
import { BOMModal, type BOMPlanData } from '../bom/BOMModal';
import { CatalogModal } from '../catalog';
import { ErrorDialog } from '../common/ErrorDialog';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PromptDialog } from '../common/PromptDialog';
import { WelcomeTour } from '../onboarding/WelcomeTour';
import { InternetMapImportModal } from '../plan/InternetMapImportModal';
import { SignalImportModal } from '../plan/SignalImportModal';
import { FieldObservationsModal } from '../plan/FieldObservationsModal';
import { FieldObservationEntryModal } from '../plan/FieldObservationEntryModal';
import { KMLExportDialog } from '../plan/KMLExportDialog';
import type { LOSOverlay, PlacementSuggestion } from '../../stores/mapStore';
import type { FieldObservation, Node } from '../../types';

type ConfirmDialogState = {
  message: string;
  onConfirm: () => void;
  variant?: 'primary' | 'danger';
  title?: string;
  confirmText?: string;
} | null;

type EnvWarningDialogState = {
  nodeNames: string;
  onSwitch: () => void;
  onRunAnyway: () => void;
} | null;

type PromptDialogState = {
  message: string;
  defaultValue: string;
  onSubmit: (value: string) => void;
  placeholder?: string;
} | null;

type PlacementSuggestParams = {
  existing_nodes: Array<{ latitude: number; longitude: number; name: string }>;
  bounds: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
  coverage_radius_m: number;
  grid_resolution_m: number;
  max_candidates: number;
};

type PDFReportConfig = {
  sections: string[];
  page_size: 'letter' | 'A4';
  include_executive_summary: boolean;
  include_bom_summary: boolean;
  include_recommendations: boolean;
};

interface AppDialogStackProps {
  analysisLoading: boolean;
  analysisStatus: string;
  onCancelAnalysis: () => void;
  envWarningDialog: EnvWarningDialogState;
  showLinkReport: boolean;
  onCloseLinkReport: () => void;
  onExportNetworkPDF: () => void;
  showRepeaterChain: boolean;
  onCloseRepeaterChain: () => void;
  showMeshCoreAirtime: boolean;
  onCloseMeshCoreAirtime: () => void;
  showMeshCoreCapacity: boolean;
  onCloseMeshCoreCapacity: () => void;
  showMeshCoreFreqCoord: boolean;
  onCloseMeshCoreFreqCoord: () => void;
  showTimeOnAir: boolean;
  onCloseTimeOnAir: () => void;
  catalogModemPresets: unknown[];
  currentPresetSF: number;
  currentPresetBW: number;
  currentPresetCR: string;
  catalogDevices: unknown[];
  currentDeviceId?: string;
  showChannelCapacity: boolean;
  onCloseChannelCapacity: () => void;
  currentNodeCount: number;
  showReticulumAnnounce: boolean;
  onCloseReticulumAnnounce: () => void;
  showRNSLinkBudget: boolean;
  onCloseRNSLinkBudget: () => void;
  showRNSTransport: boolean;
  onCloseRNSTransport: () => void;
  showRNSThroughput: boolean;
  onCloseRNSThroughput: () => void;
  showBOM: boolean;
  onCloseBOM: () => void;
  bomData: BOMPlanData[] | null;
  bomLoading: boolean;
  bomError: string | null;
  onExportBOMCSV: () => void;
  onExportBOMPDF: () => void;
  onExportBOMCards: () => void;
  bomExporting: boolean;
  tourForceKey: number;
  internetMapImportOpen: boolean;
  onCloseInternetMapImport: () => void;
  currentPlanId: string | null;
  signalImportOpen: boolean;
  onCloseSignalImport: () => void;
  signalImportPlanNodes: Array<{ id: string; name: string }>;
  fieldObservationsOpen: boolean;
  onCloseFieldObservations: () => void;
  fieldObservations: FieldObservation[];
  onRefreshFieldObservations: () => Promise<void> | void;
  onStartFieldObservationEntryMode: () => void;
  fieldObservationEntryOpen: boolean;
  fieldObservationEntryCoordinates: { latitude: number; longitude: number } | null;
  fieldObservationEditTarget: FieldObservation | null;
  fieldObservationPlanNodes: Node[];
  fieldObservationEntryModeActive: boolean;
  onCloseFieldObservationEntry: () => void;
  onStopFieldObservationEntryMode: () => void;
  onEditFieldObservation: (observation: FieldObservation) => void;
  catalogModalOpen: boolean;
  onCloseCatalog: () => void;
  catalogTourForce: boolean;
  onCatalogTourComplete: () => void;
  kmlExportDialog: { nodeCount: number; linkCount: number } | null;
  onCloseKMLExportDialog: () => void;
  errorMsg: string | null;
  onCloseError: () => void;
  confirmDialog: ConfirmDialogState;
  onConfirmDialogConfirm: () => void;
  onConfirmDialogCancel: () => void;
  exitDialogOpen: boolean;
  onExitConfirm: () => void;
  onExitCancel: () => void;
  promptDialog: PromptDialogState;
  onPromptSubmit: (value: string) => void;
  onPromptCancel: () => void;
  showFloodingSim: boolean;
  onCloseFloodingSim: () => void;
  floodingNodes: Array<{ id: string; uuid: string; name: string }>;
  losOverlays: LOSOverlay[];
  radioSF: number;
  radioBW: number;
  radioCR: string;
  showPlacementSuggest: boolean;
  onClosePlacementSuggest: () => void;
  placementNodes: Array<{ latitude: number; longitude: number; uuid: string; name: string }>;
  nodeRangeM: number;
  nodeRangeDescription: string;
  onSuggestPlacement: (params: PlacementSuggestParams) => Promise<PlacementSuggestion[]>;
  onAcceptPlacementNode: (lat: number, lon: number, name: string) => Promise<void>;
  showPDFReport: boolean;
  onClosePDFReport: () => void;
  hasLOSOverlays: boolean;
  hasCoverageOverlays: boolean;
  onGeneratePDFReport: (config: PDFReportConfig) => Promise<void>;
}

export function AppDialogStack({
  analysisLoading,
  analysisStatus,
  onCancelAnalysis,
  envWarningDialog,
  showLinkReport,
  onCloseLinkReport,
  onExportNetworkPDF,
  showRepeaterChain,
  onCloseRepeaterChain,
  showMeshCoreAirtime,
  onCloseMeshCoreAirtime,
  showMeshCoreCapacity,
  onCloseMeshCoreCapacity,
  showMeshCoreFreqCoord,
  onCloseMeshCoreFreqCoord,
  showTimeOnAir,
  onCloseTimeOnAir,
  catalogModemPresets,
  currentPresetSF,
  currentPresetBW,
  currentPresetCR,
  catalogDevices,
  currentDeviceId,
  showChannelCapacity,
  onCloseChannelCapacity,
  currentNodeCount,
  showReticulumAnnounce,
  onCloseReticulumAnnounce,
  showRNSLinkBudget,
  onCloseRNSLinkBudget,
  showRNSTransport,
  onCloseRNSTransport,
  showRNSThroughput,
  onCloseRNSThroughput,
  showBOM,
  onCloseBOM,
  bomData,
  bomLoading,
  bomError,
  onExportBOMCSV,
  onExportBOMPDF,
  onExportBOMCards,
  bomExporting,
  tourForceKey,
  internetMapImportOpen,
  onCloseInternetMapImport,
  currentPlanId,
  signalImportOpen,
  onCloseSignalImport,
  signalImportPlanNodes,
  fieldObservationsOpen,
  onCloseFieldObservations,
  fieldObservations,
  onRefreshFieldObservations,
  onStartFieldObservationEntryMode,
  fieldObservationEntryOpen,
  fieldObservationEntryCoordinates,
  fieldObservationEditTarget,
  fieldObservationPlanNodes,
  fieldObservationEntryModeActive,
  onCloseFieldObservationEntry,
  onStopFieldObservationEntryMode,
  onEditFieldObservation,
  catalogModalOpen,
  onCloseCatalog,
  catalogTourForce,
  onCatalogTourComplete,
  kmlExportDialog,
  onCloseKMLExportDialog,
  errorMsg,
  onCloseError,
  confirmDialog,
  onConfirmDialogConfirm,
  onConfirmDialogCancel,
  exitDialogOpen,
  onExitConfirm,
  onExitCancel,
  promptDialog,
  onPromptSubmit,
  onPromptCancel,
  showFloodingSim,
  onCloseFloodingSim,
  floodingNodes,
  losOverlays,
  radioSF,
  radioBW,
  radioCR,
  showPlacementSuggest,
  onClosePlacementSuggest,
  placementNodes,
  nodeRangeM,
  nodeRangeDescription,
  onSuggestPlacement,
  onAcceptPlacementNode,
  showPDFReport,
  onClosePDFReport,
  hasLOSOverlays,
  hasCoverageOverlays,
  onGeneratePDFReport,
}: AppDialogStackProps) {
  return (
    <>
      {/* Blocking overlay — prevents interaction while terrain analysis runs */}
      {analysisLoading && (
        <div
          className="analysis-loading-overlay"
          role="progressbar"
          aria-label="Analysis in progress"
          aria-busy="true"
        >
          <div className="analysis-loading-box">
            <span className="analysis-loading-spinner" aria-hidden="true" />
            <span className="analysis-loading-text">{analysisStatus}</span>
            <button
              className="analysis-loading-cancel"
              type="button"
              onClick={onCancelAnalysis}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Environment warning — shown before compute starts */}
      <ConfirmDialog
        isOpen={!!envWarningDialog}
        title="Environment Recommendation"
        message={`${envWarningDialog?.nodeNames} — the current environment underestimates coverage for elevated nodes. Switch to Clear LOS (Elevated) for accurate simulation?`}
        confirmText="Switch to Clear LOS & Run"
        cancelText="Run Anyway"
        onConfirm={envWarningDialog?.onSwitch ?? (() => {})}
        onCancel={envWarningDialog?.onRunAnyway ?? (() => {})}
      />
      <LinkReportModal isOpen={showLinkReport} onClose={onCloseLinkReport} onExportPDF={onExportNetworkPDF} />
      <RepeaterChainModal isOpen={showRepeaterChain} onClose={onCloseRepeaterChain} />
      <MeshCoreAirtimeModal isOpen={showMeshCoreAirtime} onClose={onCloseMeshCoreAirtime} />
      <MeshCoreCapacityModal isOpen={showMeshCoreCapacity} onClose={onCloseMeshCoreCapacity} />
      <MeshCoreFreqCoordModal isOpen={showMeshCoreFreqCoord} onClose={onCloseMeshCoreFreqCoord} />
      <TimeOnAirModal
        isOpen={showTimeOnAir}
        onClose={onCloseTimeOnAir}
        catalogModemPresets={catalogModemPresets}
        currentPresetSF={currentPresetSF}
        currentPresetBW={currentPresetBW}
        currentPresetCR={currentPresetCR}
        catalogDevices={catalogDevices}
        currentDeviceId={currentDeviceId}
      />
      <ChannelCapacityModal
        isOpen={showChannelCapacity}
        onClose={onCloseChannelCapacity}
        catalogModemPresets={catalogModemPresets}
        currentPresetSF={currentPresetSF}
        currentPresetBW={currentPresetBW}
        currentPresetCR={currentPresetCR}
        currentNodeCount={currentNodeCount}
      />
      <ReticulumAnnounceModal
        isOpen={showReticulumAnnounce}
        onClose={onCloseReticulumAnnounce}
      />
      <RNSLinkBudgetModal
        isOpen={showRNSLinkBudget}
        onClose={onCloseRNSLinkBudget}
      />
      <RNSTransportModal
        isOpen={showRNSTransport}
        onClose={onCloseRNSTransport}
      />
      <RNSThroughputModal
        isOpen={showRNSThroughput}
        onClose={onCloseRNSThroughput}
      />
      <BOMModal
        isOpen={showBOM}
        onClose={onCloseBOM}
        bomData={bomData}
        loading={bomLoading}
        error={bomError}
        onExportCSV={onExportBOMCSV}
        onExportPDF={onExportBOMPDF}
        onExportCards={onExportBOMCards}
        exporting={bomExporting}
      />
      <WelcomeTour key={tourForceKey} forceShow={tourForceKey > 0} />
      <InternetMapImportModal
        isOpen={internetMapImportOpen}
        onClose={onCloseInternetMapImport}
        planId={currentPlanId}
      />
      <SignalImportModal
        isOpen={signalImportOpen}
        onClose={onCloseSignalImport}
        planNodes={signalImportPlanNodes}
      />
      <FieldObservationsModal
        isOpen={fieldObservationsOpen}
        onClose={onCloseFieldObservations}
        planId={currentPlanId}
        observations={fieldObservations}
        planNodes={fieldObservationPlanNodes}
        onRefresh={onRefreshFieldObservations}
        onStartEntryMode={onStartFieldObservationEntryMode}
        onEditObservation={onEditFieldObservation}
      />
      <FieldObservationEntryModal
        isOpen={fieldObservationEntryOpen}
        onClose={onCloseFieldObservationEntry}
        planId={currentPlanId}
        coordinates={fieldObservationEntryCoordinates}
        observation={fieldObservationEditTarget}
        planNodes={fieldObservationPlanNodes}
        entryModeActive={fieldObservationEntryModeActive}
        onStopEntryMode={onStopFieldObservationEntryMode}
        onRefresh={onRefreshFieldObservations}
      />
      <CatalogModal
        isOpen={catalogModalOpen}
        onClose={onCloseCatalog}
        forceTour={catalogTourForce}
        onTourComplete={onCatalogTourComplete}
      />
      {kmlExportDialog && (
        <KMLExportDialog
          nodeCount={kmlExportDialog.nodeCount}
          linkCount={kmlExportDialog.linkCount}
          onClose={onCloseKMLExportDialog}
        />
      )}
      {errorMsg && <ErrorDialog message={errorMsg} onClose={onCloseError} />}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        message={confirmDialog?.message ?? ''}
        title={confirmDialog?.title}
        variant={confirmDialog?.variant}
        confirmText={confirmDialog?.confirmText}
        onConfirm={onConfirmDialogConfirm}
        onCancel={onConfirmDialogCancel}
      />
      <ConfirmDialog
        isOpen={exitDialogOpen}
        title="Exit Application"
        message="Closing this tab or window will close the Mesh Community Planner app. Are you sure?"
        confirmText="Exit"
        cancelText="Cancel"
        variant="danger"
        showCloseButton
        closeOnBackdrop={false}
        onConfirm={onExitConfirm}
        onCancel={onExitCancel}
      />
      <PromptDialog
        isOpen={promptDialog !== null}
        message={promptDialog?.message ?? ''}
        defaultValue={promptDialog?.defaultValue ?? ''}
        placeholder={promptDialog?.placeholder}
        onSubmit={onPromptSubmit}
        onCancel={onPromptCancel}
      />
      <FloodingSimModal
        isOpen={showFloodingSim}
        onClose={onCloseFloodingSim}
        nodes={floodingNodes}
        losOverlays={losOverlays}
        radioSF={radioSF}
        radioBW={radioBW}
        radioCR={radioCR}
      />
      <PlacementSuggestModal
        isOpen={showPlacementSuggest}
        onClose={onClosePlacementSuggest}
        nodes={placementNodes}
        nodeRangeM={nodeRangeM}
        nodeRangeDescription={nodeRangeDescription}
        onSuggest={onSuggestPlacement}
        onAcceptNode={onAcceptPlacementNode}
      />
      <PDFReportModal
        isOpen={showPDFReport}
        onClose={onClosePDFReport}
        hasLOSOverlays={hasLOSOverlays}
        hasCoverageOverlays={hasCoverageOverlays}
        onGenerate={onGeneratePDFReport}
      />
    </>
  );
}
