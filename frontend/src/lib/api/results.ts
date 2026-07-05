import { API_BASE_URL } from '../api';
import { 
  DashboardResultsResponse,
  DashboardOverviewResponse,
  AssetSummary,
  AssetProjectionResponse,
  AssetRiskResponse,
  MethodologyResponse
} from '../../types/results';

export const resultsApi = {
  // V1 Compatibility
  getDashboardResults: async (): Promise<DashboardResultsResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/dashboard/results`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch dashboard results`);
    }
    return response.json();
  },

  // V2 Endpoints
  getDashboardOverview: async (): Promise<DashboardOverviewResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/overview`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch dashboard overview`);
    }
    return response.json();
  },

  getAssetsList: async (): Promise<AssetSummary[]> => {
    const response = await fetch(`${API_BASE_URL}/api/assets`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch assets list`);
    }
    return response.json();
  },

  getAssetProjection: async (symbol: string): Promise<AssetProjectionResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/assets/${symbol.toUpperCase()}/projection`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch projection details for ${symbol}`);
    }
    return response.json();
  },

  getAssetRisk: async (symbol: string): Promise<AssetRiskResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/assets/${symbol.toUpperCase()}/risk`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch risk details for ${symbol}`);
    }
    return response.json();
  },

  getMethodology: async (): Promise<MethodologyResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/methodology/simple`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch methodology guidelines`);
    }
    return response.json();
  }
};
