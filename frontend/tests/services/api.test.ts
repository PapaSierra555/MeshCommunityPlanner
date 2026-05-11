import { afterEach, describe, expect, it, vi } from 'vitest';

import { APIClient } from '../../src/services/api';
import type { MountPage, NodePage, RadioProfilePage, SitePage } from '../../src/types';

describe('APIClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the paginated node list response', async () => {
    const nodePage: NodePage = {
      items: [
        {
          id: 'node-1',
          plan_id: 'plan-1',
          name: 'Hilltop',
          latitude: 40.1,
          longitude: -105.2,
          antenna_height_m: 10,
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
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(nodePage), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = new APIClient({ baseURL: '/api', authToken: 'test-token' });
    const result = await api.listNodes('plan-1');

    expect(result).toEqual(nodePage);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plans/plan-1/nodes',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('returns the paginated site list response', async () => {
    const sitePage: SitePage = {
      items: [
        {
          id: 'site-1',
          plan_id: 'plan-1',
          name: 'Hilltop',
          latitude: 40.1,
          longitude: -105.2,
          public_latitude: null,
          public_longitude: null,
          coordinate_precision: 'approximate',
          visibility: 'community',
          owner_user_id: null,
          access_notes_private: '',
          status: 'active',
          notes: '',
          created_at: '2026-04-26T00:00:00Z',
          updated_at: '2026-04-26T00:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sitePage), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = new APIClient({ baseURL: '/api', authToken: 'test-token' });
    const result = await api.listSites('plan-1');

    expect(result).toEqual(sitePage);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plans/plan-1/sites',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns the paginated mount list response', async () => {
    const mountPage: MountPage = {
      items: [
        {
          id: 'mount-1',
          plan_id: 'plan-1',
          site_id: 'site-1',
          mount_type: 'mast',
          height_agl_m: 10,
          height_asl_m: null,
          cable_id: null,
          cable_length_m: 0,
          enclosure: null,
          power_source: 'unknown',
          install_notes: '',
          created_at: '2026-04-26T00:00:00Z',
          updated_at: '2026-04-26T00:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mountPage), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = new APIClient({ baseURL: '/api', authToken: 'test-token' });
    const result = await api.listMounts('plan-1');

    expect(result).toEqual(mountPage);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plans/plan-1/mounts',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns the paginated radio profile list response', async () => {
    const radioProfilePage: RadioProfilePage = {
      items: [
        {
          id: 'radio-1',
          plan_id: 'plan-1',
          name: 'Long Fast',
          protocol: 'meshtastic',
          region: 'us_fcc',
          frequency_mhz: 906.875,
          tx_power_dbm: 22,
          spreading_factor: 11,
          bandwidth_khz: 250,
          coding_rate: '4/5',
          modem_preset: 'long_fast',
          firmware_version: null,
          config_json: {},
          created_at: '2026-04-26T00:00:00Z',
          updated_at: '2026-04-26T00:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(radioProfilePage), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = new APIClient({ baseURL: '/api', authToken: 'test-token' });
    const result = await api.listRadioProfiles('plan-1');

    expect(result).toEqual(radioProfilePage);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plans/plan-1/radio-profiles',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
