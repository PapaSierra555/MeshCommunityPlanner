/**
 * API Client
 * Type-safe API client for communicating with FastAPI backend
 * Reads auth token from window.__MESH_PLANNER_AUTH__
 */

import type {
  Mount,
  MountPage,
  Node,
  NodePage,
  Plan,
  RadioProfile,
  RadioProfilePage,
  Site,
  SitePage,
  FieldObservation,
  FieldObservationPage,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

interface APIClientConfig {
  baseURL: string;
  authToken: string | null;
  timeout: number;
}

const DEFAULT_CONFIG: APIClientConfig = {
  baseURL: '/api',
  authToken: null,
  timeout: 30000, // 30 seconds
};

// ============================================================================
// Error Class
// ============================================================================

export class APIClientError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'APIClientError';
  }
}

// ============================================================================
// API Client Class
// ============================================================================

export class APIClient {
  private config: APIClientConfig;

  constructor(config?: Partial<APIClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Read auth token from window if not provided
    if (!this.config.authToken && typeof window !== 'undefined') {
      this.config.authToken = (window as any).__MESH_PLANNER_AUTH__ || null;
    }
  }

  /**
   * Base fetch wrapper with auth, error handling, timeout
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;

    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if required and available
    if (requireAuth && this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    // Set up timeout (use per-request override if provided in options)
    const effectiveTimeout = (options as any)._timeout ?? this.config.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new APIClientError(error.detail, response.status);
      }

      // Handle 204 No Content (e.g., DELETE responses)
      if (response.status === 204) {
        return undefined as T;
      }

      // Parse JSON response
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof APIClientError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new APIClientError('Request timeout', 408);
      }

      throw new APIClientError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }

  // Convenience methods
  private get<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, requireAuth);
  }

  private post<T>(
    endpoint: string,
    body?: any,
    requireAuth = true
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'POST', body: JSON.stringify(body) },
      requireAuth
    );
  }

  private put<T>(
    endpoint: string,
    body?: any,
    requireAuth = true
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      { method: 'PUT', body: JSON.stringify(body) },
      requireAuth
    );
  }

  private delete<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, requireAuth);
  }

  // ============================================================================
  // Health Endpoint
  // ============================================================================

  async health(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/health', false);
  }

  // ============================================================================
  // Plan Endpoints
  // ============================================================================

  async listPlans(): Promise<Plan[]> {
    return this.get<Plan[]>('/plans');
  }

  async createPlan(plan: {
    name: string;
    description?: string;
    firmware_family?: string;
    region?: string;
  }): Promise<Plan> {
    return this.post<Plan>('/plans', plan);
  }

  async updatePlan(
    planId: string,
    updates: Partial<Plan>
  ): Promise<Plan> {
    return this.put<Plan>(`/plans/${planId}`, updates);
  }

  async deletePlan(planId: string): Promise<void> {
    return this.delete<void>(`/plans/${planId}`);
  }

  // ============================================================================
  // Node Endpoints
  // ============================================================================

  async listNodes(planId: string): Promise<NodePage> {
    return this.get<NodePage>(`/plans/${planId}/nodes`);
  }

  async createNode(planId: string, node: Partial<Node>): Promise<Node> {
    return this.post<Node>(`/plans/${planId}/nodes`, node);
  }

  async updateNode(
    planId: string,
    nodeId: string,
    updates: Partial<Node>
  ): Promise<Node> {
    return this.put<Node>(`/plans/${planId}/nodes/${nodeId}`, updates);
  }

  async deleteNode(planId: string, nodeId: string): Promise<void> {
    return this.delete<void>(`/plans/${planId}/nodes/${nodeId}`);
  }

  // ============================================================================
  // Site Endpoints
  // ============================================================================

  async listSites(planId: string): Promise<SitePage> {
    return this.get<SitePage>(`/plans/${planId}/sites`);
  }

  async getSite(planId: string, siteId: string): Promise<Site> {
    return this.get<Site>(`/plans/${planId}/sites/${siteId}`);
  }

  async createSite(planId: string, site: Partial<Site>): Promise<Site> {
    return this.post<Site>(`/plans/${planId}/sites`, site);
  }

  async updateSite(
    planId: string,
    siteId: string,
    updates: Partial<Site>
  ): Promise<Site> {
    return this.put<Site>(`/plans/${planId}/sites/${siteId}`, updates);
  }

  async deleteSite(planId: string, siteId: string): Promise<void> {
    return this.delete<void>(`/plans/${planId}/sites/${siteId}`);
  }

  // ============================================================================
  // Mount Endpoints
  // ============================================================================

  async listMounts(planId: string): Promise<MountPage> {
    return this.get<MountPage>(`/plans/${planId}/mounts`);
  }

  async getMount(planId: string, mountId: string): Promise<Mount> {
    return this.get<Mount>(`/plans/${planId}/mounts/${mountId}`);
  }

  async createMount(planId: string, mount: Partial<Mount>): Promise<Mount> {
    return this.post<Mount>(`/plans/${planId}/mounts`, mount);
  }

  async updateMount(
    planId: string,
    mountId: string,
    updates: Partial<Mount>
  ): Promise<Mount> {
    return this.put<Mount>(`/plans/${planId}/mounts/${mountId}`, updates);
  }

  async deleteMount(planId: string, mountId: string): Promise<void> {
    return this.delete<void>(`/plans/${planId}/mounts/${mountId}`);
  }

  // ============================================================================
  // Radio Profile Endpoints
  // ============================================================================

  async listRadioProfiles(planId: string): Promise<RadioProfilePage> {
    return this.get<RadioProfilePage>(`/plans/${planId}/radio-profiles`);
  }

  async getRadioProfile(planId: string, profileId: string): Promise<RadioProfile> {
    return this.get<RadioProfile>(`/plans/${planId}/radio-profiles/${profileId}`);
  }

  async createRadioProfile(
    planId: string,
    radioProfile: Partial<RadioProfile>
  ): Promise<RadioProfile> {
    return this.post<RadioProfile>(`/plans/${planId}/radio-profiles`, radioProfile);
  }

  async updateRadioProfile(
    planId: string,
    profileId: string,
    updates: Partial<RadioProfile>
  ): Promise<RadioProfile> {
    return this.put<RadioProfile>(`/plans/${planId}/radio-profiles/${profileId}`, updates);
  }

  async deleteRadioProfile(planId: string, profileId: string): Promise<void> {
    return this.delete<void>(`/plans/${planId}/radio-profiles/${profileId}`);
  }

  // ============================================================================
  // Field Observation Endpoints
  // ============================================================================

  async listFieldObservations(planId: string): Promise<FieldObservationPage> {
    return this.get<FieldObservationPage>(`/plans/${planId}/field-observations?limit=1000`);
  }

  async createFieldObservation(
    planId: string,
    observation: Partial<FieldObservation>
  ): Promise<FieldObservation> {
    return this.post<FieldObservation>(`/plans/${planId}/field-observations`, observation);
  }

  async updateFieldObservation(
    planId: string,
    observationId: string,
    updates: Partial<FieldObservation>
  ): Promise<FieldObservation> {
    return this.put<FieldObservation>(`/plans/${planId}/field-observations/${observationId}`, updates);
  }

  async deleteFieldObservation(planId: string, observationId: string): Promise<void> {
    return this.delete<void>(`/plans/${planId}/field-observations/${observationId}`);
  }

  // ============================================================================
  // Line of Sight Analysis (W3 Engine)
  // ============================================================================

  async getLOSProfile(nodeA: Node, nodeB: Node): Promise<any> {
    // Use 120s timeout — first-time SRTM terrain tile download can be ~25MB
    const body = {
      node_a: {
        node_id: String(nodeA.id),
        latitude: nodeA.latitude,
        longitude: nodeA.longitude,
        antenna_height_m: nodeA.antenna_height_m,
        frequency_mhz: nodeA.frequency_mhz,
        tx_power_dbm: nodeA.tx_power_dbm,
      },
      node_b: {
        node_id: String(nodeB.id),
        latitude: nodeB.latitude,
        longitude: nodeB.longitude,
        antenna_height_m: nodeB.antenna_height_m,
        frequency_mhz: nodeB.frequency_mhz,
        tx_power_dbm: nodeB.tx_power_dbm,
      },
      frequency_mhz: nodeA.frequency_mhz,
    };
    return this.request('/los/profile', {
      method: 'POST',
      body: JSON.stringify(body),
      _timeout: 120000,
    } as any, true);
  }

  // ============================================================================
  // Viewshed / Visibility Analysis
  // ============================================================================

  async getViewshed(observer: Node, targets: Node[]): Promise<any> {
    // Use 120s timeout — first-time SRTM terrain tile download can be slow
    const body = {
      observer_lat: observer.latitude,
      observer_lon: observer.longitude,
      observer_height_m: observer.antenna_height_m,
      target_nodes: targets.map((t) => ({
        node_id: String(t.id),
        latitude: t.latitude,
        longitude: t.longitude,
        antenna_height_m: t.antenna_height_m,
      })),
    };
    return this.request('/terrain/viewshed', {
      method: 'POST',
      body: JSON.stringify(body),
      _timeout: 120000,
    } as any, true);
  }

  // ============================================================================
  // Network Report PDF Export
  // ============================================================================

  async exportNetworkReportPDF(payload: {
    plan_name: string;
    plan_description: string;
    nodes: any[];
    links: any[];
    map_screenshot_base64: string;
    include_executive_summary?: boolean;
    include_bom_summary?: boolean;
    include_recommendations?: boolean;
    coverage_data?: any;
    bom_summary?: any;
    page_size?: string;
    sections?: string[];
  }): Promise<Blob> {
    return this._fetchBlob('/reports/export/network-pdf', payload, 60000);
  }

  // ============================================================================
  // Placement Suggestion (Auto Node Placement)
  // ============================================================================

  async suggestPlacement(payload: {
    existing_nodes: Array<{ node_id: string; latitude: number; longitude: number; coverage_radius_m: number }>;
    bounds: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
    coverage_radius_m: number;
    grid_resolution_m: number;
    max_candidates: number;
  }): Promise<any> {
    return this.post<any>('/placement/suggest', payload);
  }

  async evaluatePlacement(payload: any): Promise<any> {
    return this.post<any>('/placement/evaluate', payload);
  }


  // ============================================================================
  // Terrain Coverage Grid (W3 Engine)
  // ============================================================================

  async getTerrainCoverageGrid(
    node: Node,
    environment: string,
    maxRadiusM: number = 15000.0,
    paMaxOutputDbm?: number,
    paInputRangeMaxDbm?: number,
    calibrationObservations: FieldObservation[] = [],
    useFieldCalibration = false,
  ): Promise<any> {
    // 120s timeout — first-time SRTM tile download can be slow
    const body: Record<string, unknown> = {
      node_id: String(node.id),
      node_name: node.name,
      latitude: node.latitude,
      longitude: node.longitude,
      antenna_height_m: node.antenna_height_m,
      frequency_mhz: node.frequency_mhz,
      tx_power_dbm: node.tx_power_dbm,
      antenna_gain_dbi: 3.0,
      cable_loss_db: 0.0,
      spreading_factor: node.spreading_factor,
      bandwidth_khz: node.bandwidth_khz,
      coding_rate: node.coding_rate,
      environment,
      max_radius_m: maxRadiusM,
      num_radials: 360,
      sample_interval_m: 30.0,
      use_field_calibration: useFieldCalibration,
      calibration_observations: calibrationObservations.map((obs) => ({
        latitude: obs.latitude,
        longitude: obs.longitude,
        success: obs.success,
        ack_relay: obs.ack_relay,
        ack_db: obs.ack_db,
      })),
    };
    if (paMaxOutputDbm !== undefined && paInputRangeMaxDbm !== undefined) {
      body.pa_max_output_power_dbm = paMaxOutputDbm;
      body.pa_input_range_max_dbm = paInputRangeMaxDbm;
    }
    return this.request('/coverage/terrain-grid', {
      method: 'POST',
      body: JSON.stringify(body),
      _timeout: 120000,
    } as any, true);
  }

  // ============================================================================
  // Hardware Catalog
  // ============================================================================

  async getCatalogDevices(firmware?: string): Promise<any[]> {
    const q = firmware ? `?firmware=${encodeURIComponent(firmware)}` : '';
    return this.get<any[]>(`/catalog/devices${q}`);
  }

  async getCatalogAntennas(band?: string): Promise<any[]> {
    const q = band ? `?band=${encodeURIComponent(band)}` : '';
    return this.get<any[]>(`/catalog/antennas${q}`);
  }

  async getCatalogCables(): Promise<any[]> {
    return this.get<any[]>('/catalog/cables');
  }

  async getCatalogPAModules(): Promise<any[]> {
    return this.get<any[]>('/catalog/pa-modules');
  }

  async getCatalogPower(category?: string): Promise<any[]> {
    const q = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.get<any[]>(`/catalog/power${q}`);
  }

  // Catalog CRUD
  async createCatalogItem(table: string, data: any): Promise<any> {
    return this.post<any>(`/catalog/${table}`, data);
  }

  async updateCatalogItem(table: string, id: string, fields: Record<string, any>): Promise<any> {
    return this.put<any>(`/catalog/${table}/${id}`, { fields });
  }

  async deleteCatalogItem(table: string, id: string): Promise<void> {
    return this.delete<void>(`/catalog/${table}/${id}`);
  }

  async exportCatalogCSV(table: string): Promise<Blob> {
    const url = `${this.config.baseURL}/catalog/${table}/export`;
    const headers: HeadersInit = {};
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) throw new APIClientError(`Export failed`, response.status);
    return response.blob();
  }

  async importCatalogCSV(table: string, file: File, mode: string = 'merge'): Promise<any> {
    const url = `${this.config.baseURL}/catalog/${table}/import?mode=${mode}`;
    const formData = new FormData();
    formData.append('file', file);
    const headers: HeadersInit = {};
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    const response = await fetch(url, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Import failed' }));
      throw new APIClientError(err.detail, response.status);
    }
    return response.json();
  }

  async resetCatalogTable(table: string): Promise<any> {
    return this.post<any>(`/catalog/${table}/reset`);
  }

  // Reference data
  async getRegulatoryPresets(): Promise<any[]> {
    return this.get<any[]>('/catalog/regulatory-presets');
  }

  async getModemPresets(firmware?: string): Promise<any[]> {
    const q = firmware ? `?firmware=${encodeURIComponent(firmware)}` : '';
    return this.get<any[]>(`/catalog/modem-presets${q}`);
  }

  async getFirmwareDefaults(): Promise<any[]> {
    return this.get<any[]>('/catalog/firmware-defaults');
  }

  // ============================================================================
  // Bill of Materials (BOM)
  // ============================================================================

  async getNodeBOM(nodePayload: any): Promise<any> {
    return this.post<any>('/bom/node', nodePayload);
  }

  async getPlanBOM(payload: {
    plan_id: string;
    plan_name: string;
    nodes: any[];
  }): Promise<any> {
    return this.post<any>('/bom/plan', payload);
  }

  /** Export BOM as CSV — returns Blob */
  async exportBOMCSV(payload: {
    plan_id: string;
    plan_name: string;
    nodes: any[];
  }): Promise<Blob> {
    return this._fetchBlob('/bom/export/csv', payload, 30000);
  }

  /** Export BOM as PDF — returns Blob */
  async exportBOMPDF(payload: {
    plan_id: string;
    plan_name: string;
    nodes: any[];
  }): Promise<Blob> {
    return this._fetchBlob('/bom/export/pdf', payload, 30000);
  }

  /** Export deployment cards PDF — returns Blob */
  async exportDeploymentCards(payload: {
    plan_id: string;
    plan_name: string;
    nodes: any[];
  }): Promise<Blob> {
    return this._fetchBlob('/bom/export/deployment', payload, 30000);
  }

  /** Shared helper for POST endpoints that return binary blobs. */
  private async _fetchBlob(
    endpoint: string,
    body: any,
    timeout: number,
  ): Promise<Blob> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new APIClientError(error.detail, response.status);
      }
      return await response.blob();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof APIClientError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new APIClientError('Request timeout', 408);
      }
      throw new APIClientError(
        error instanceof Error ? error.message : 'Network error', 0
      );
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiClientInstance: APIClient | null = null;

export function getAPIClient(): APIClient {
  if (!apiClientInstance) {
    apiClientInstance = new APIClient();
  }
  return apiClientInstance;
}
