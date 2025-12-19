export interface MachineData {
  machine_id: string;
  cycle: number;
  health: number;
  dsi: number;
  reliability: number;
  sensors: Record<string, number>;
}

export interface ClusterData {
  machine_id: string;
  operating_cycles: number;
  degradation_span: number;
  cluster: 'slow' | 'moderate' | 'fast';
}

export interface InsightData {
  worst_machine: string;
  worst_health: number;
  fastest_degrader: string;
  fastest_dsi: number;
  fleet_avg_health: number;
  machines_critical: number;
  machines_moderate: number;
  machines_healthy: number;
}

export type HealthStatus = 'healthy' | 'moderate' | 'critical';

export interface UploadResponse {
  success: boolean;
  message: string;
  machines: string[];
  data: MachineData[];
}
