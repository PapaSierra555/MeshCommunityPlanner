import type { Mount, Node, RadioProfile, Site } from '../types';

export type LegacyNodeCreatePayload = Partial<Node>;
export type NodeWizardDraftField = keyof LegacyNodeCreatePayload;

export interface NodeWizardDraft {
  node: LegacyNodeCreatePayload;
  site: Partial<Pick<Site, 'name' | 'latitude' | 'longitude' | 'visibility' | 'coordinate_precision' | 'status'>>;
  mount: Partial<Pick<Mount, 'height_agl_m' | 'height_asl_m' | 'cable_id' | 'cable_length_m' | 'power_source'>>;
  radioProfile: Partial<Pick<RadioProfile, 'protocol' | 'region' | 'frequency_mhz' | 'tx_power_dbm' | 'spreading_factor' | 'bandwidth_khz' | 'coding_rate' | 'modem_preset'>>;
}

export interface NodeDomainParts {
  node: Node;
  site: Site;
  mount: Mount;
  radioProfile: RadioProfile;
}

export interface MeshPlanRelationshipIdMaps {
  siteIds?: Map<string, string>;
  mountIds?: Map<string, string>;
  radioProfileIds?: Map<string, string>;
}

export type MeshPlanNodeRelationshipIds = Pick<Node, 'site_id' | 'mount_id' | 'radio_profile_id'>;

const LEGACY_NODE_CREATE_DEFAULTS: LegacyNodeCreatePayload = {
  antenna_height_m: 3,
  visibility: 'private',
  coordinate_precision: 'exact',
  node_role: 'planned',
  node_status: 'planned',
  device_id: 'tbeam-supreme',
  firmware: 'meshtastic',
  region: 'us_fcc',
  frequency_mhz: 906.875,
  tx_power_dbm: 20,
  spreading_factor: 11,
  bandwidth_khz: 250,
  coding_rate: '4/5',
  modem_preset: null,
  antenna_id: '915-3dbi-omni',
  cable_id: null,
  cable_length_m: 0,
  pa_module_id: null,
  is_solar: false,
  desired_coverage_radius_m: null,
  notes: '',
};

function fallbackId(node: Node, suffix: string): string {
  return `${String(node.id)}:${suffix}`;
}

function compactUndefined<T extends object>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as T;
}

export function buildLegacyNodeCreatePayload(
  defaults: LegacyNodeCreatePayload = {},
  overrides: LegacyNodeCreatePayload = {}
): LegacyNodeCreatePayload {
  return {
    ...LEGACY_NODE_CREATE_DEFAULTS,
    ...compactUndefined(defaults),
    ...compactUndefined(overrides),
  };
}

export function createNodeWizardDraft(source: LegacyNodeCreatePayload = {}): NodeWizardDraft {
  return {
    node: compactUndefined({
      site_id: source.site_id,
      mount_id: source.mount_id,
      radio_profile_id: source.radio_profile_id,
      name: source.name,
      status: source.status,
      node_role: source.node_role,
      device_id: source.device_id,
      antenna_id: source.antenna_id,
      pa_module_id: source.pa_module_id,
      desired_coverage_radius_m: source.desired_coverage_radius_m,
      notes: source.notes,
      environment: source.environment,
      coverage_environment: source.coverage_environment,
      sort_order: source.sort_order,
    }),
    site: compactUndefined({
      name: source.name,
      latitude: source.latitude,
      longitude: source.longitude,
      visibility: source.visibility,
      coordinate_precision: source.coordinate_precision,
      status: source.node_status,
    }),
    mount: compactUndefined({
      height_agl_m: source.antenna_height_m,
      height_asl_m: source.elevation ?? undefined,
      cable_id: source.cable_id,
      cable_length_m: source.cable_length_m,
      power_source: source.is_solar === undefined ? undefined : source.is_solar ? 'solar' : 'unknown',
    }),
    radioProfile: compactUndefined({
      protocol: source.firmware,
      region: source.region,
      frequency_mhz: source.frequency_mhz,
      tx_power_dbm: source.tx_power_dbm,
      spreading_factor: source.spreading_factor,
      bandwidth_khz: source.bandwidth_khz,
      coding_rate: source.coding_rate,
      modem_preset: source.modem_preset,
    }),
  };
}

export function flattenNodeWizardDraft(draft: NodeWizardDraft): LegacyNodeCreatePayload {
  return compactUndefined({
    ...draft.node,
    name: draft.site.name ?? draft.node.name,
    latitude: draft.site.latitude,
    longitude: draft.site.longitude,
    visibility: draft.site.visibility,
    coordinate_precision: draft.site.coordinate_precision,
    node_status: draft.site.status,
    antenna_height_m: draft.mount.height_agl_m,
    elevation: draft.mount.height_asl_m ?? undefined,
    cable_id: draft.mount.cable_id,
    cable_length_m: draft.mount.cable_length_m,
    is_solar: draft.mount.power_source === undefined ? undefined : draft.mount.power_source === 'solar',
    firmware: draft.radioProfile.protocol,
    region: draft.radioProfile.region as Node['region'] | undefined,
    frequency_mhz: draft.radioProfile.frequency_mhz,
    tx_power_dbm: draft.radioProfile.tx_power_dbm,
    spreading_factor: draft.radioProfile.spreading_factor,
    bandwidth_khz: draft.radioProfile.bandwidth_khz,
    coding_rate: draft.radioProfile.coding_rate as Node['coding_rate'] | undefined,
    modem_preset: draft.radioProfile.modem_preset,
  });
}

export function buildNodeWizardCreatePayload(draft: NodeWizardDraft): LegacyNodeCreatePayload {
  return buildLegacyNodeCreatePayload({}, flattenNodeWizardDraft(draft));
}

export function updateNodeWizardDraftField(
  draft: NodeWizardDraft,
  field: NodeWizardDraftField,
  value: LegacyNodeCreatePayload[NodeWizardDraftField]
): NodeWizardDraft {
  switch (field) {
    case 'name':
      return {
        ...draft,
        node: { ...draft.node, name: value as Node['name'] },
        site: { ...draft.site, name: value as Site['name'] },
      };
    case 'latitude':
      return { ...draft, site: { ...draft.site, latitude: value as Site['latitude'] } };
    case 'longitude':
      return { ...draft, site: { ...draft.site, longitude: value as Site['longitude'] } };
    case 'visibility':
      return { ...draft, site: { ...draft.site, visibility: value as Site['visibility'] } };
    case 'coordinate_precision':
      return { ...draft, site: { ...draft.site, coordinate_precision: value as Site['coordinate_precision'] } };
    case 'node_status':
      return { ...draft, site: { ...draft.site, status: value as Site['status'] } };
    case 'antenna_height_m':
      return { ...draft, mount: { ...draft.mount, height_agl_m: value as Mount['height_agl_m'] } };
    case 'elevation':
      return { ...draft, mount: { ...draft.mount, height_asl_m: value as Mount['height_asl_m'] } };
    case 'cable_id':
      return { ...draft, mount: { ...draft.mount, cable_id: value as Mount['cable_id'] } };
    case 'cable_length_m':
      return { ...draft, mount: { ...draft.mount, cable_length_m: value as Mount['cable_length_m'] } };
    case 'is_solar':
      return {
        ...draft,
        mount: {
          ...draft.mount,
          power_source: value === undefined ? undefined : value ? 'solar' : 'unknown',
        },
      };
    case 'firmware':
      return { ...draft, radioProfile: { ...draft.radioProfile, protocol: value as RadioProfile['protocol'] } };
    case 'region':
      return { ...draft, radioProfile: { ...draft.radioProfile, region: value as RadioProfile['region'] } };
    case 'frequency_mhz':
      return { ...draft, radioProfile: { ...draft.radioProfile, frequency_mhz: value as RadioProfile['frequency_mhz'] } };
    case 'tx_power_dbm':
      return { ...draft, radioProfile: { ...draft.radioProfile, tx_power_dbm: value as RadioProfile['tx_power_dbm'] } };
    case 'spreading_factor':
      return { ...draft, radioProfile: { ...draft.radioProfile, spreading_factor: value as RadioProfile['spreading_factor'] } };
    case 'bandwidth_khz':
      return { ...draft, radioProfile: { ...draft.radioProfile, bandwidth_khz: value as RadioProfile['bandwidth_khz'] } };
    case 'coding_rate':
      return { ...draft, radioProfile: { ...draft.radioProfile, coding_rate: value as RadioProfile['coding_rate'] } };
    case 'modem_preset':
      return { ...draft, radioProfile: { ...draft.radioProfile, modem_preset: value as RadioProfile['modem_preset'] } };
    default:
      return { ...draft, node: { ...draft.node, [field]: value } };
  }
}

function includeRelationshipId(
  target: Partial<MeshPlanNodeRelationshipIds>,
  source: Partial<MeshPlanNodeRelationshipIds>,
  key: keyof MeshPlanNodeRelationshipIds
) {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    target[key] = source[key];
  }
}

export function meshPlanNodeRelationshipFields(
  node: Partial<MeshPlanNodeRelationshipIds>
): Partial<MeshPlanNodeRelationshipIds> {
  const relationshipIds: Partial<MeshPlanNodeRelationshipIds> = {};

  includeRelationshipId(relationshipIds, node, 'site_id');
  includeRelationshipId(relationshipIds, node, 'mount_id');
  includeRelationshipId(relationshipIds, node, 'radio_profile_id');

  return relationshipIds;
}

export function remapMeshPlanNodeRelationshipFields(
  node: Partial<MeshPlanNodeRelationshipIds>,
  maps: MeshPlanRelationshipIdMaps
): Partial<MeshPlanNodeRelationshipIds> {
  const relationshipIds: Partial<MeshPlanNodeRelationshipIds> = {};
  const source = meshPlanNodeRelationshipFields(node);

  if (source.site_id === null) {
    relationshipIds.site_id = null;
  } else if (source.site_id !== undefined) {
    const mapped = maps.siteIds?.get(source.site_id);
    if (mapped) relationshipIds.site_id = mapped;
  }

  if (source.mount_id === null) {
    relationshipIds.mount_id = null;
  } else if (source.mount_id !== undefined) {
    const mapped = maps.mountIds?.get(source.mount_id);
    if (mapped) relationshipIds.mount_id = mapped;
  }

  if (source.radio_profile_id === null) {
    relationshipIds.radio_profile_id = null;
  } else if (source.radio_profile_id !== undefined) {
    const mapped = maps.radioProfileIds?.get(source.radio_profile_id);
    if (mapped) relationshipIds.radio_profile_id = mapped;
  }

  return relationshipIds;
}

export function buildMeshPlanNodeExportRecord(node: Node): Partial<Node> {
  return {
    name: node.name,
    latitude: node.latitude,
    longitude: node.longitude,
    antenna_height_m: node.antenna_height_m,
    ...meshPlanNodeRelationshipFields(node),
    visibility: node.visibility || 'private',
    coordinate_precision: node.coordinate_precision || 'exact',
    node_role: node.node_role || 'planned',
    node_status: node.node_status || 'planned',
    device_id: node.device_id,
    firmware: node.firmware,
    region: node.region,
    frequency_mhz: node.frequency_mhz,
    tx_power_dbm: node.tx_power_dbm,
    spreading_factor: node.spreading_factor,
    bandwidth_khz: node.bandwidth_khz,
    coding_rate: node.coding_rate,
    modem_preset: node.modem_preset,
    antenna_id: node.antenna_id,
    cable_id: node.cable_id,
    cable_length_m: node.cable_length_m,
    pa_module_id: node.pa_module_id,
    is_solar: node.is_solar,
    desired_coverage_radius_m: node.desired_coverage_radius_m,
    notes: node.notes,
    sort_order: node.sort_order,
  };
}

export function buildMeshPlanSiteExportRecord(site: Site): Partial<Site> {
  return {
    id: site.id,
    name: site.name,
    latitude: site.latitude,
    longitude: site.longitude,
    public_latitude: site.public_latitude,
    public_longitude: site.public_longitude,
    coordinate_precision: site.coordinate_precision,
    visibility: site.visibility,
    owner_user_id: site.owner_user_id,
    access_notes_private: site.access_notes_private,
    status: site.status,
    notes: site.notes,
  };
}

export function buildMeshPlanMountExportRecord(mount: Mount): Partial<Mount> {
  return {
    id: mount.id,
    site_id: mount.site_id,
    mount_type: mount.mount_type,
    height_agl_m: mount.height_agl_m,
    height_asl_m: mount.height_asl_m,
    cable_id: mount.cable_id,
    cable_length_m: mount.cable_length_m,
    enclosure: mount.enclosure,
    power_source: mount.power_source,
    install_notes: mount.install_notes,
  };
}

export function buildMeshPlanRadioProfileExportRecord(radioProfile: RadioProfile): Partial<RadioProfile> {
  return {
    id: radioProfile.id,
    name: radioProfile.name,
    protocol: radioProfile.protocol,
    region: radioProfile.region,
    frequency_mhz: radioProfile.frequency_mhz,
    tx_power_dbm: radioProfile.tx_power_dbm,
    spreading_factor: radioProfile.spreading_factor,
    bandwidth_khz: radioProfile.bandwidth_khz,
    coding_rate: radioProfile.coding_rate,
    modem_preset: radioProfile.modem_preset,
    firmware_version: radioProfile.firmware_version,
    config_json: radioProfile.config_json,
  };
}

export function decomposeNodeDomain(node: Node): NodeDomainParts {
  const siteId = node.site_id ?? fallbackId(node, 'site');
  const mountId = node.mount_id ?? fallbackId(node, 'mount');
  const radioProfileId = node.radio_profile_id ?? fallbackId(node, 'radio-profile');

  return {
    node: { ...node },
    site: {
      id: siteId,
      plan_id: node.plan_id,
      name: node.name,
      latitude: node.latitude,
      longitude: node.longitude,
      public_latitude: null,
      public_longitude: null,
      coordinate_precision: node.coordinate_precision ?? 'exact',
      visibility: node.visibility ?? 'private',
      owner_user_id: null,
      access_notes_private: '',
      status: node.node_status ?? 'planned',
      notes: node.notes,
      created_at: node.created_at,
      updated_at: node.updated_at,
    },
    mount: {
      id: mountId,
      plan_id: node.plan_id,
      site_id: siteId,
      mount_type: 'mast',
      height_agl_m: node.antenna_height_m,
      height_asl_m: node.elevation ?? null,
      cable_id: node.cable_id,
      cable_length_m: node.cable_length_m,
      enclosure: null,
      power_source: node.is_solar ? 'solar' : 'unknown',
      install_notes: '',
      created_at: node.created_at,
      updated_at: node.updated_at,
    },
    radioProfile: {
      id: radioProfileId,
      plan_id: node.plan_id,
      name: node.modem_preset ?? `${node.name} radio`,
      protocol: node.firmware,
      region: node.region,
      frequency_mhz: node.frequency_mhz,
      tx_power_dbm: node.tx_power_dbm,
      spreading_factor: node.spreading_factor,
      bandwidth_khz: node.bandwidth_khz,
      coding_rate: node.coding_rate,
      modem_preset: node.modem_preset,
      firmware_version: null,
      config_json: {},
      created_at: node.created_at,
      updated_at: node.updated_at,
    },
  };
}

export function composeNodeDomain(parts: NodeDomainParts): Node {
  const { node, site, mount, radioProfile } = parts;
  const relationshipIds: Pick<Node, 'site_id' | 'mount_id' | 'radio_profile_id'> = {};

  if (node.site_id === null && site.id === fallbackId(node, 'site')) {
    relationshipIds.site_id = null;
  } else if (node.site_id !== undefined || site.id !== fallbackId(node, 'site')) {
    relationshipIds.site_id = site.id;
  }
  if (node.mount_id === null && mount.id === fallbackId(node, 'mount')) {
    relationshipIds.mount_id = null;
  } else if (node.mount_id !== undefined || mount.id !== fallbackId(node, 'mount')) {
    relationshipIds.mount_id = mount.id;
  }
  if (node.radio_profile_id === null && radioProfile.id === fallbackId(node, 'radio-profile')) {
    relationshipIds.radio_profile_id = null;
  } else if (node.radio_profile_id !== undefined || radioProfile.id !== fallbackId(node, 'radio-profile')) {
    relationshipIds.radio_profile_id = radioProfile.id;
  }

  return {
    ...node,
    ...relationshipIds,
    plan_id: node.plan_id,
    latitude: site.latitude,
    longitude: site.longitude,
    visibility: site.visibility,
    coordinate_precision: site.coordinate_precision,
    node_status: site.status,
    antenna_height_m: mount.height_agl_m,
    elevation: mount.height_asl_m ?? undefined,
    cable_id: mount.cable_id,
    cable_length_m: mount.cable_length_m,
    is_solar: mount.power_source === 'solar',
    firmware: radioProfile.protocol,
    region: radioProfile.region as Node['region'],
    frequency_mhz: radioProfile.frequency_mhz,
    tx_power_dbm: radioProfile.tx_power_dbm,
    spreading_factor: radioProfile.spreading_factor,
    bandwidth_khz: radioProfile.bandwidth_khz,
    coding_rate: radioProfile.coding_rate as Node['coding_rate'],
    modem_preset: radioProfile.modem_preset,
  };
}
