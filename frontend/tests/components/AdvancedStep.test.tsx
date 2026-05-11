import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { AdvancedStep } from '../../src/components/wizard/steps/AdvancedStep';
import type { LegacyNodeCreatePayload } from '../../src/utils/nodeDomainAdapters';

describe('AdvancedStep', () => {
  it('renders privacy and domain controls with conservative defaults', () => {
    render(<AdvancedStep data={{}} errors={{}} onChange={vi.fn()} />);

    expect((screen.getByLabelText('Visibility') as HTMLSelectElement).value).toBe('private');
    expect((screen.getByLabelText('Coordinate Precision') as HTMLSelectElement).value).toBe('exact');
    expect((screen.getByLabelText('Node Role') as HTMLSelectElement).value).toBe('planned');
    expect((screen.getByLabelText('Node Status') as HTMLSelectElement).value).toBe('planned');
  });

  it('uses existing privacy and domain values', () => {
    const data: LegacyNodeCreatePayload = {
      visibility: 'public',
      coordinate_precision: 'hidden',
      node_role: 'gateway',
      node_status: 'active',
    };

    render(<AdvancedStep data={data} errors={{}} onChange={vi.fn()} />);

    expect((screen.getByLabelText('Visibility') as HTMLSelectElement).value).toBe('public');
    expect((screen.getByLabelText('Coordinate Precision') as HTMLSelectElement).value).toBe('hidden');
    expect((screen.getByLabelText('Node Role') as HTMLSelectElement).value).toBe('gateway');
    expect((screen.getByLabelText('Node Status') as HTMLSelectElement).value).toBe('active');
  });

  it('emits backend field names when controls change', () => {
    const onChange = vi.fn();
    render(<AdvancedStep data={{}} errors={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Visibility'), { target: { value: 'community' } });
    fireEvent.change(screen.getByLabelText('Coordinate Precision'), { target: { value: 'approximate' } });
    fireEvent.change(screen.getByLabelText('Node Role'), { target: { value: 'repeater' } });
    fireEvent.change(screen.getByLabelText('Node Status'), { target: { value: 'candidate' } });

    expect(onChange).toHaveBeenCalledWith('visibility', 'community');
    expect(onChange).toHaveBeenCalledWith('coordinate_precision', 'approximate');
    expect(onChange).toHaveBeenCalledWith('node_role', 'repeater');
    expect(onChange).toHaveBeenCalledWith('node_status', 'candidate');
  });
});
