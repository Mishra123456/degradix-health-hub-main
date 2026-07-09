import { MachineData, ClusterData, InsightData } from '@/types/machine';

// Generate mock health data for demonstration
export const generateMockHealthData = (machineId: string): MachineData[] => {
  const cycles = 200;
  const data: MachineData[] = [];
  
  // Different degradation patterns per machine
  const degradationRate = Math.random() * 0.003 + 0.001;
  const baseHealth = 95 + Math.random() * 5;
  
  for (let i = 1; i <= cycles; i++) {
    const noise = (Math.random() - 0.5) * 2;
    const health = Math.max(0, baseHealth - (degradationRate * i * i / 10) + noise);
    const dsi = degradationRate * 100 + (Math.random() - 0.5) * 0.5;
    
    data.push({
      machine_id: machineId,
      cycle: i,
      health: Math.round(health * 100) / 100,
      dsi: Math.round(dsi * 100) / 100,
      reliability: Math.round((health / 100) * 95 * 100) / 100,
      sensors: {
        sensor_1: 500 + Math.random() * 100,
        sensor_2: 600 + Math.random() * 50,
        sensor_3: 1500 + Math.random() * 200,
      }
    });
  }
  
  return data;
};

export const mockMachineIds = [
  'ENG-001', 'ENG-002', 'ENG-003', 'ENG-004', 'ENG-005',
  'PMP-001', 'PMP-002', 'PMP-003',
  'TRB-001', 'TRB-002'
];

export const generateAllMachineData = (): Map<string, MachineData[]> => {
  const allData = new Map<string, MachineData[]>();
  
  mockMachineIds.forEach(id => {
    allData.set(id, generateMockHealthData(id));
  });
  
  return allData;
};

export const generateClusterData = (): ClusterData[] => {
  return [
    { machine_id: 'ENG-001', operating_cycles: 180, degradation_span: 15, cluster: 'slow' },
    { machine_id: 'ENG-002', operating_cycles: 150, degradation_span: 35, cluster: 'moderate' },
    { machine_id: 'ENG-003', operating_cycles: 120, degradation_span: 55, cluster: 'fast' },
    { machine_id: 'ENG-004', operating_cycles: 190, degradation_span: 12, cluster: 'slow' },
    { machine_id: 'ENG-005', operating_cycles: 140, degradation_span: 42, cluster: 'moderate' },
    { machine_id: 'PMP-001', operating_cycles: 160, degradation_span: 28, cluster: 'moderate' },
    { machine_id: 'PMP-002', operating_cycles: 100, degradation_span: 60, cluster: 'fast' },
    { machine_id: 'PMP-003', operating_cycles: 175, degradation_span: 18, cluster: 'slow' },
    { machine_id: 'TRB-001', operating_cycles: 110, degradation_span: 52, cluster: 'fast' },
    { machine_id: 'TRB-002', operating_cycles: 165, degradation_span: 25, cluster: 'moderate' },
  ];
};

export const generateInsights = (allData: Map<string, MachineData[]>): InsightData => {
  let worstMachine = '';
  let worstHealth = 100;
  let fastestDegrader = '';
  let fastestDsi = 0;
  let totalHealth = 0;
  let machineCount = 0;
  let critical = 0;
  let moderate = 0;
  let healthy = 0;
  
  allData.forEach((data, machineId) => {
    const latestData = data[data.length - 1];
    totalHealth += latestData.health;
    machineCount++;
    
    if (latestData.health < worstHealth) {
      worstHealth = latestData.health;
      worstMachine = machineId;
    }
    
    const avgDsi = data.reduce((sum, d) => sum + d.dsi, 0) / data.length;
    if (avgDsi > fastestDsi) {
      fastestDsi = avgDsi;
      fastestDegrader = machineId;
    }
    
    if (latestData.health < 50) critical++;
    else if (latestData.health < 75) moderate++;
    else healthy++;
  });
  
  return {
    worst_machine: worstMachine,
    worst_health: Math.round(worstHealth * 10) / 10,
    fastest_degrader: fastestDegrader,
    fastest_dsi: Math.round(fastestDsi * 100) / 100,
    fleet_avg_health: Math.round((totalHealth / machineCount) * 10) / 10,
    machines_critical: critical,
    machines_moderate: moderate,
    machines_healthy: healthy,
  };
};
