import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge, getHealthStatus } from "@/components/ui/status-badge";
import { HealthChart } from "@/components/charts/HealthChart";
import { MachineSelector } from "@/components/MachineSelector";
import { Activity, TrendingUp, Clock, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

type HealthRow = {
  engine_id: number;
  cycle: number;
  health: number;
};

type ReliabilityRow = {
  engine_id: number;
  cycle: number;
  reliability: number;
};

export default function HealthPage() {
  const { file } = useAppData();

  const [healthData, setHealthData] = useState<HealthRow[]>([]);
  const [reliabilityData, setReliabilityData] = useState<ReliabilityRow[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);

  // Fetch backend data
  useEffect(() => {
    if (!file) return;

    api.health(file).then(setHealthData);
    api.reliability(file).then(setReliabilityData);
  }, [file]);

  // Get unique machine IDs
  const machineIds = useMemo(() => {
    const ids = Array.from(new Set(healthData.map((d) => d.engine_id)));
    if (ids.length && selectedMachine === null) {
      setSelectedMachine(ids[0]);
    }
    return ids;
  }, [healthData, selectedMachine]);

  if (!file) {
    return (
      <MainLayout>
        <PageHeader
          title="Machine Health Analysis"
          description="Upload data to view machine health"
        />
        <p className="text-muted-foreground">Please upload a CSV file first.</p>
      </MainLayout>
    );
  }

  if (!selectedMachine) return null;

  // Filter data for selected machine
  const machineHealth = healthData.filter(
    (d) => d.engine_id === selectedMachine
  );

  const machineReliability = reliabilityData.filter(
    (d) => d.engine_id === selectedMachine
  );

  const latestHealth = machineHealth[machineHealth.length - 1];
  const firstHealth = machineHealth[0];
  const latestReliability = machineReliability[machineReliability.length - 1];

  const healthStatus = latestHealth
    ? getHealthStatus(latestHealth.health * 100)
    : "healthy";

  const healthChange =
    latestHealth && firstHealth
      ? ((latestHealth.health - firstHealth.health) * 100).toFixed(1)
      : "0";

  return (
    <MainLayout>
      <PageHeader
        title="Machine Health Analysis"
        description="Detailed health monitoring and trends for individual machines"
      >
        <MachineSelector
          machines={machineIds}
          value={selectedMachine}
          onChange={setSelectedMachine}
        />
      </PageHeader>

      {/* Health Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Current Health"
          value={`${(latestHealth?.health * 100 || 0).toFixed(1)}%`}
          icon={Activity}
        >
          <div className="mt-3">
            <StatusBadge status={healthStatus} />
          </div>
        </MetricCard>

        <MetricCard
          title="Health Change"
          value={`${healthChange}%`}
          subtitle="Since first cycle"
          icon={TrendingUp}
          trend={parseFloat(healthChange) >= 0 ? "up" : "down"}
          trendValue="Total change"
        />

        <MetricCard
          title="Operating Cycles"
          value={machineHealth.length}
          subtitle="Total recorded"
          icon={Clock}
        />

        <MetricCard
          title="Reliability"
          value={`${(latestReliability?.reliability * 100 || 0).toFixed(1)}%`}
          subtitle="Current estimate"
          icon={Activity}
        />
      </div>

      {/* Health Chart */}
      <div className="dashboard-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Health vs Time (Cycle)
            </h2>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Machine health is computed from normalized sensor behavior
                  using ML models trained on historical degradation patterns.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <StatusBadge status={healthStatus} />
        </div>

        <HealthChart
          data={machineHealth.map((d) => ({
            cycle: d.cycle,
            health: d.health * 100,
          }))}
          showThresholds
        />
      </div>

      {/* Status Legend */}
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Health Status Thresholds
        </h3>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg bg-status-healthy-bg p-3 border border-status-healthy/20">
            <div className="h-3 w-3 rounded-full bg-status-healthy" />
            <div>
              <p className="font-medium text-foreground">Healthy (75–100%)</p>
              <p className="text-xs text-muted-foreground">
                Normal operation, no action required
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-status-moderate-bg p-3 border border-status-moderate/20">
            <div className="h-3 w-3 rounded-full bg-status-moderate" />
            <div>
              <p className="font-medium text-foreground">Moderate (50–75%)</p>
              <p className="text-xs text-muted-foreground">
                Schedule preventive maintenance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-status-critical-bg p-3 border border-status-critical/20">
            <div className="h-3 w-3 rounded-full bg-status-critical" />
            <div>
              <p className="font-medium text-foreground">Critical (0–50%)</p>
              <p className="text-xs text-muted-foreground">
                Immediate attention required
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
