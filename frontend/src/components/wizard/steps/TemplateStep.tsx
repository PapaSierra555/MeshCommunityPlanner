/**
 * TemplateStep component
 * Step 6: Save configuration as template
 */

import React, { useState } from 'react';
import type { LegacyNodeCreatePayload, NodeWizardDraftField } from '../../../utils/nodeDomainAdapters';

export interface TemplateStepProps {
  data: LegacyNodeCreatePayload;
  errors: Record<string, string>;
  onChange: (field: NodeWizardDraftField, value: LegacyNodeCreatePayload[NodeWizardDraftField]) => void;
}

export function TemplateStep({ data, errors, onChange }: TemplateStepProps) {
  const [templateName, setTemplateName] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  return (
    <div className="wizard-step template-step">
      <h3>Save as Template</h3>
      <p>Optionally save this configuration as a reusable template.</p>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
          />
          Save this configuration as a template
        </label>
      </div>

      {saveAsTemplate && (
        <div className="form-group">
          <label htmlFor="template_name">
            Template Name
            <input
              type="text"
              id="template_name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., My Custom Setup"
            />
          </label>
        </div>
      )}
    </div>
  );
}
