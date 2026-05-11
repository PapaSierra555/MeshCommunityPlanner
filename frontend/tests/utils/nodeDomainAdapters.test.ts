import { describe, expect, it } from 'vitest';

import {
  buildNodeWizardCreatePayload,
  buildLegacyNodeCreatePayload,
  buildMeshPlanMountExportRecord,
  buildMeshPlanNodeExportRecord,
  buildMeshPlanRadioProfileExportRecord,
  buildMeshPlanSiteExportRecord,
  composeNodeDomain,
  createNodeWizardDraft,
  decomposeNodeDomain,
  flattenNodeWizardDraft,
  remapMeshPlanNodeRelationshipFields,
  updateNodeWizardDraftField,
} from '../../src/utils/nodeDomainAdapters';
import type { Mount, Node, RadioProfile, Site } from '../../src/types';

const baseNode: Node = {
  id: 'node-1',
  plan_id: 'plan-1',
  site_id: 'site-1',
  mount_id: 'mount-1',
  radio_profile_id: 'radio-1',
  name: 'Hilltop',
  latitude: 40.1,
  longitude: -105.2,
  antenna_height_m: 10,
  elevation: 1650,
  device_id: 'tbeam-supreme',
  firmware: 'meshtastic',
  region: 'us_fcc',
  frequency_mhz: 906.875,
  tx_power_dbm: 22,
  spreading_factor: 11,
  bandwidth_khz: 250,
  coding_rate: '4/5',
  modem_preset: 'long_fast',
  antenna_id: '915-3dbi-omni',
  cable_id: null,
  cable_length_m: 0,
  pa_module_id: null,
  is_solar: false,
  desired_coverage_radius_m: null,
  notes: '',
  environment: 'suburban',
  coverage_environment: null,
  visibility: 'community',
  coordinate_precision: 'approximate',
  node_role: 'repeater',
  node_status: 'active',
  sort_order: 0,
  created_at: '2026-04-26T00:00:00Z',
  updated_at: '2026-04-26T00:00:00Z',
};

describe('node domain adapters', () => {
  it('round-trips a flattened node without changing UI-facing fields', () => {
    const parts = decomposeNodeDomain(baseNode);

    expect(parts.site).toMatchObject({
      id: 'site-1',
      latitude: baseNode.latitude,
      longitude: baseNode.longitude,
      visibility: baseNode.visibility,
    });
    expect(parts.mount).toMatchObject({
      id: 'mount-1',
      site_id: 'site-1',
      height_agl_m: baseNode.antenna_height_m,
    });
    expect(parts.radioProfile).toMatchObject({
      id: 'radio-1',
      protocol: baseNode.firmware,
      frequency_mhz: baseNode.frequency_mhz,
    });

    expect(composeNodeDomain(parts)).toEqual(baseNode);
  });

  it('keeps missing relationship IDs optional during compatibility round-trip', () => {
    const { site_id, mount_id, radio_profile_id, ...nodeWithoutRelationshipIds } = baseNode;

    expect(composeNodeDomain(decomposeNodeDomain(nodeWithoutRelationshipIds))).toEqual(
      nodeWithoutRelationshipIds
    );
  });

  it('composes domain changes back into the current flattened node shape', () => {
    const parts = decomposeNodeDomain(baseNode);
    const composed = composeNodeDomain({
      ...parts,
      site: {
        ...parts.site,
        latitude: 41,
        longitude: -106,
        visibility: 'public',
      },
      mount: {
        ...parts.mount,
        height_agl_m: 15,
        power_source: 'solar',
      },
      radioProfile: {
        ...parts.radioProfile,
        tx_power_dbm: 27,
      },
    });

    expect(composed).toMatchObject({
      latitude: 41,
      longitude: -106,
      visibility: 'public',
      antenna_height_m: 15,
      is_solar: true,
      tx_power_dbm: 27,
    });
  });

  it('builds flattened legacy create payloads with defaults and explicit overrides', () => {
    expect(buildLegacyNodeCreatePayload({
      firmware: 'meshcore',
      tx_power_dbm: 22,
      visibility: undefined,
    }, {
      name: 'Candidate',
      latitude: 40.2,
      longitude: -105.3,
      node_status: 'candidate',
      tx_power_dbm: undefined,
    })).toMatchObject({
      name: 'Candidate',
      latitude: 40.2,
      longitude: -105.3,
      antenna_height_m: 3,
      firmware: 'meshcore',
      region: 'us_fcc',
      tx_power_dbm: 22,
      visibility: 'private',
      coordinate_precision: 'exact',
      node_role: 'planned',
      node_status: 'candidate',
      antenna_id: '915-3dbi-omni',
      cable_id: null,
      cable_length_m: 0,
      pa_module_id: null,
      is_solar: false,
      desired_coverage_radius_m: null,
      notes: '',
    });
  });

  it('keeps wizard state in domain draft parts and flattens for create', () => {
    let draft = createNodeWizardDraft({
      name: 'Candidate',
      latitude: 40.2,
      longitude: -105.3,
      visibility: 'community',
      node_status: 'candidate',
      antenna_height_m: 6,
      cable_length_m: 1.5,
      is_solar: true,
      firmware: 'meshcore',
      region: 'us_fcc',
      frequency_mhz: 906.5,
      tx_power_dbm: 22,
    });

    expect(draft.site).toMatchObject({
      name: 'Candidate',
      latitude: 40.2,
      longitude: -105.3,
      visibility: 'community',
      status: 'candidate',
    });
    expect(draft.mount).toMatchObject({
      height_agl_m: 6,
      cable_length_m: 1.5,
      power_source: 'solar',
    });
    expect(draft.radioProfile).toMatchObject({
      protocol: 'meshcore',
      frequency_mhz: 906.5,
      tx_power_dbm: 22,
    });

    draft = updateNodeWizardDraftField(draft, 'latitude', 41);
    draft = updateNodeWizardDraftField(draft, 'antenna_height_m', 9);
    draft = updateNodeWizardDraftField(draft, 'tx_power_dbm', 24);

    expect(flattenNodeWizardDraft(draft)).toMatchObject({
      name: 'Candidate',
      latitude: 41,
      longitude: -105.3,
      visibility: 'community',
      node_status: 'candidate',
      antenna_height_m: 9,
      cable_length_m: 1.5,
      is_solar: true,
      firmware: 'meshcore',
      tx_power_dbm: 24,
    });
  });

  it('emits flattened wizard create payloads with legacy defaults', () => {
    const payload = buildNodeWizardCreatePayload(createNodeWizardDraft({
      name: 'Candidate',
      latitude: 40.2,
      longitude: -105.3,
    }));

    expect(payload).toMatchObject({
      name: 'Candidate',
      latitude: 40.2,
      longitude: -105.3,
      antenna_height_m: 3,
      visibility: 'private',
      coordinate_precision: 'exact',
      node_role: 'planned',
      node_status: 'planned',
      firmware: 'meshtastic',
      frequency_mhz: 906.875,
    });
  });

  it('exports .meshplan node records with relationship IDs and privacy defaults', () => {
    const record = buildMeshPlanNodeExportRecord({
      ...baseNode,
      visibility: undefined,
      coordinate_precision: undefined,
      node_role: undefined,
      node_status: undefined,
    });

    expect(record).toMatchObject({
      name: 'Hilltop',
      site_id: 'site-1',
      mount_id: 'mount-1',
      radio_profile_id: 'radio-1',
      visibility: 'private',
      coordinate_precision: 'exact',
      node_role: 'planned',
      node_status: 'planned',
    });
  });

  it('exports .meshplan relationship collections without source plan metadata', () => {
    const parts = decomposeNodeDomain(baseNode);
    const site = buildMeshPlanSiteExportRecord(parts.site as Site);
    const mount = buildMeshPlanMountExportRecord(parts.mount as Mount);
    const radioProfile = buildMeshPlanRadioProfileExportRecord(parts.radioProfile as RadioProfile);

    expect(site).toMatchObject({
      id: 'site-1',
      visibility: 'community',
      coordinate_precision: 'approximate',
    });
    expect(mount).toMatchObject({
      id: 'mount-1',
      site_id: 'site-1',
      height_agl_m: 10,
    });
    expect(radioProfile).toMatchObject({
      id: 'radio-1',
      protocol: 'meshtastic',
      frequency_mhz: 906.875,
    });
    expect(site).not.toHaveProperty('plan_id');
    expect(mount).not.toHaveProperty('created_at');
    expect(radioProfile).not.toHaveProperty('updated_at');
  });

  it('remaps imported .meshplan relationship IDs and drops unmapped stale IDs', () => {
    expect(remapMeshPlanNodeRelationshipFields(baseNode, {
      siteIds: new Map([['site-1', 'new-site']]),
      mountIds: new Map([['mount-1', 'new-mount']]),
      radioProfileIds: new Map([['radio-1', 'new-radio']]),
    })).toEqual({
      site_id: 'new-site',
      mount_id: 'new-mount',
      radio_profile_id: 'new-radio',
    });

    expect(remapMeshPlanNodeRelationshipFields(baseNode, {})).toEqual({});
    expect(remapMeshPlanNodeRelationshipFields({
      site_id: null,
      mount_id: null,
      radio_profile_id: null,
    }, {})).toEqual({
      site_id: null,
      mount_id: null,
      radio_profile_id: null,
    });
  });
});
