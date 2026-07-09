import { API_BASE_URL } from '../api';
import { 
  DashboardResultsResponse,
  AssetRiskResponse,
  MethodologyResponse,
  DashboardOverviewResult,
  AssetProjectionResult,
  ValidationSummary
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

  // V2 Endpoints - Now using the Clean Result Contract
  getDashboardOverview: async (): Promise<DashboardOverviewResult> => {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/overview`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch dashboard overview`);
    }
    return response.json();
  },

  getAssetsList: async (): Promise<AssetProjectionResult[]> => {
    const response = await fetch(`${API_BASE_URL}/api/assets`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch assets list`);
    }
    return response.json();
  },

  getAssetProjection: async (symbol: string): Promise<AssetProjectionResult> => {
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
  },

  getValidationSummary: async (): Promise<ValidationSummary> => {
    const response = await fetch(`${API_BASE_URL}/api/validation/summary`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`[${response.status}] Failed to fetch validation summary`);
    }
    return response.json();
  }
};
