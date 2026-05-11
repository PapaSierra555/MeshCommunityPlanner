/**
 * NodeWizard component
 * Multi-step wizard for configuring mesh nodes
 * 7 steps: Location, Device, Radio, Antenna, Advanced, Template, Review
 */

import React, { useState } from 'react';
import { LocationStep } from './steps/LocationStep';
import { DeviceStep } from './steps/DeviceStep';
import { RadioStep } from './steps/RadioStep';
import { AntennaStep } from './steps/AntennaStep';
import { AdvancedStep } from './steps/AdvancedStep';
import { TemplateStep } from './steps/TemplateStep';
import { ReviewStep } from './steps/ReviewStep';
import type { Node } from '../../types';
import {
  buildNodeWizardCreatePayload,
  createNodeWizardDraft,
  flattenNodeWizardDraft,
  updateNodeWizardDraftField,
  type LegacyNodeCreatePayload,
  type NodeWizardDraftField,
} from '../../utils/nodeDomainAdapters';

export interface NodeWizardProps {
  onComplete: (node: Partial<Node>) => void;
  onCancel: () => void;
  initialData?: Partial<Node>;
}

interface WizardStep {
  label: string;
  component: React.ComponentType<any>;
}

const WIZARD_STEPS: WizardStep[] = [
  { label: 'Location', component: LocationStep },
  { label: 'Device', component: DeviceStep },
  { label: 'Radio', component: RadioStep },
  { label: 'Antenna', component: AntennaStep },
  { label: 'Advanced', component: AdvancedStep },
  { label: 'Template', component: TemplateStep },
  { label: 'Review', component: ReviewStep },
];

export function NodeWizard({
  onComplete,
  onCancel,
  initialData = {},
}: NodeWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formDraft, setFormDraft] = useState(() => createNodeWizardDraft(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const CurrentStepComponent = WIZARD_STEPS[currentStep].component;
  const formData = flattenNodeWizardDraft(formDraft);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Step 1: Location validation
    if (currentStep === 0) {
      if (!formData.latitude) {
        newErrors.latitude = 'Latitude is required';
      }
      if (!formData.longitude) {
        newErrors.longitude = 'Longitude is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
      setErrors({});
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setErrors({});
  };

  const handleFinish = () => {
    if (validateCurrentStep()) {
      onComplete(buildNodeWizardCreatePayload(formDraft));
    }
  };

  const handleFieldChange = (
    field: NodeWizardDraftField,
    value: LegacyNodeCreatePayload[NodeWizardDraftField]
  ) => {
    setFormDraft((prev) => updateNodeWizardDraftField(prev, field, value));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);

    // Load template data (mock for now)
    if (templateId === 'meshtastic-default') {
      setFormDraft(createNodeWizardDraft({
        ...formData,
        latitude: 40.7128,
        longitude: -74.0060,
        device_id: 'meshtastic-default',
        region: 'us_fcc',
        firmware: 'meshtastic',
        frequency_mhz: 906.875,
        tx_power_dbm: 20,
        spreading_factor: 11,
        bandwidth_khz: 250,
        coding_rate: '4/5',
        modem_preset: null,
        antenna_id: '915-3dbi-omni',
        antenna_height_m: 2,
        cable_id: null,
        cable_length_m: 0,
      }));
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="wizard-title"
      aria-describedby="wizard-description"
      className="node-wizard"
    >
      <div id="wizard-title" className="wizard-header">
        <h2>Add Node - Step {currentStep + 1} of {WIZARD_STEPS.length}</h2>
        <p id="wizard-description">{WIZARD_STEPS[currentStep].label}</p>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Wizard progress: step ${currentStep + 1} of ${WIZARD_STEPS.length}`}
        className="wizard-progress"
      >
        <div className="wizard-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Step labels */}
      <div className="wizard-steps">
        {WIZARD_STEPS.map((step, index) => (
          <div
            key={step.label}
            className={`wizard-step-label ${index === currentStep ? 'active' : ''} ${
              index < currentStep ? 'completed' : ''
            }`}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            {step.label}
          </div>
        ))}
      </div>

      {/* Template selector (shown on all steps) */}
      <div className="wizard-template-selector">
        <label htmlFor="template-select">
          Load Template:
          <select
            id="template-select"
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
          >
            <option value="">-- Select Template --</option>
            <option value="meshtastic-default">Meshtastic Default</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>

      {/* Current step content */}
      <div className="wizard-step-content">
        <CurrentStepComponent
          data={formData}
          errors={errors}
          onChange={handleFieldChange}
        />
      </div>

      {/* Navigation buttons */}
      <div className="wizard-actions">
        <button type="button" onClick={onCancel} className="wizard-btn-cancel">
          Cancel
        </button>

        {!isFirstStep && (
          <button type="button" onClick={handleBack} className="wizard-btn-back">
            Back
          </button>
        )}

        {!isLastStep && (
          <button type="button" onClick={handleNext} className="wizard-btn-next">
            Next
          </button>
        )}

        {isLastStep && (
          <button type="button" onClick={handleFinish} className="wizard-btn-finish">
            Finish
          </button>
        )}

        {/* Help button */}
        <button
          type="button"
          className="wizard-btn-help"
          aria-label="Help"
          title="Show help for this step"
        >
          ?
        </button>

        {/* Save as template button */}
        <button
          type="button"
          className="wizard-btn-save-template"
          aria-label="Save as Template"
          title="Save current configuration as a template"
        >
          Save as Template
        </button>
      </div>
    </div>
  );
}
