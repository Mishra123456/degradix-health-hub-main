import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Target,
  Wrench,
  BarChart3,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

type HealthRow = {
  engine_id: number;
  cycle: number;
  health: number;
};

type DsiRow = {
  engine_id: number;
  cycle: number;
  DSI: number;
};

type ClusterRow = {
  engine_id: number;
  degradation_span: number;
  cycles: number;
  cluster: number;
};

type InsightSummary = {
  summary: string;
  worst_engine: number;
  lowest_health: number;
  cluster: number;
};

type ClusterLabel = "slow" | "moderate" | "fast";

export default function InsightsPage() {
  const { file } = useAppData();

  const [healthData, setHealthData] = useState<HealthRow[]>([]);
  const [dsiData, setDsiData] = useState<DsiRow[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [backendInsight, setBackendInsight] = useState<InsightSummary | null>(
    null
  );

  // Fetch all required backend data
  useEffect(() => {
    if (!file) return;

    api.health(file).then(setHealthData);
    api.dsi(file).then(setDsiData);
    api.clusters(file).then(setClusters);
    api.insights(file).then(setBackendInsight);
  }, [file]);

  if (!file) {
    return (
      <MainLayout>
        <PageHeader
          title="Insights & Decision Support"
          description="Upload data to view AI-generated insights"
        />
        <p className="text-muted-foreground">Please upload a CSV file first.</p>
      </MainLayout>
    );
  }

  /* ---------------- FLEET-LEVEL COMPUTATIONS ---------------- */

  // Latest health per engine
  const latestHealthByEngine = useMemo(() => {
    const map = new Map<number, HealthRow>();
    healthData.forEach((row) => {
      map.set(row.engine_id, row);
    });
    return Array.from(map.values());
  }, [healthData]);

  const fleetAvgHealth =
    latestHealthByEngine.reduce((sum, d) => sum + d.health, 0) /
    (latestHealthByEngine.length || 1);

  const machinesCritical = latestHealthByEngine.filter(
    (d) => d.health < 0.5
  ).length;

  const machinesModerate = latestHealthByEngine.filter(
    (d) => d.health >= 0.5 && d.health < 0.75
  ).length;

  const machinesHealthy = latestHealthByEngine.filter(
    (d) => d.health >= 0.75
  ).length;

  // Fastest degrader (highest avg DSI)
  const avgDsiByEngine = useMemo(() => {
    const map = new Map<number, number[]>();
    dsiData.forEach((row) => {
      if (!map.has(row.engine_id)) map.set(row.engine_id, []);
      map.get(row.engine_id)!.push(row.DSI);
    });

    return Array.from(map.entries()).map(([engine, values]) => ({
      engine,
      avgDsi: values.reduce((sum, v) => sum + v, 0) / (values.length || 1),
    }));
  }, [dsiData]);

  const fastestDegrader = avgDsiByEngine.sort((a, b) => b.avgDsi - a.avgDsi)[0];

  /* ---------------- CLUSTER LABELING ---------------- */

  const labeledClusters = useMemo(() => {
    if (!clusters.length) return [];

    const sorted = [...clusters].sort(
      (a, b) => b.degradation_span - a.degradation_span
    );

    const uniqueClusterIds = Array.from(new Set(sorted.map((c) => c.cluster)));

    const map = new Map<number, ClusterLabel>();
    uniqueClusterIds.forEach((id, index) => {
      if (index === 0) map.set(id, "fast");
      else if (index === uniqueClusterIds.length - 1) map.set(id, "slow");
      else map.set(id, "moderate");
    });

    return sorted.map((c) => ({
      engine_id: c.engine_id,
      cluster: map.get(c.cluster)!,
    }));
  }, [clusters]);

  const fastDegraders = labeledClusters.filter((d) => d.cluster === "fast");

  /* ---------------- UI ---------------- */

  return (
    <MainLayout>
      <PageHeader
        title="Insights & Decision Support"
        description="AI-generated insights and maintenance recommendations"
      />

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Fleet Health"
          value={`${(fleetAvgHealth * 100).toFixed(1)}%`}
          subtitle="Average across all machines"
          icon={BarChart3}
        />

        <MetricCard
          title="Worst Machine"
          value={`Engine ${backendInsight?.worst_engine}`}
          subtitle={`Health: ${(
            (backendInsight?.lowest_health || 0) * 100
          ).toFixed(1)}%`}
          icon={AlertTriangle}
        />

        <MetricCard
          title="Fastest Degrader"
          value={`Engine ${fastestDegrader?.engine}`}
          subtitle={`Avg DSI: ${fastestDegrader?.avgDsi.toFixed(3)}`}
          icon={TrendingDown}
        />

        <MetricCard
          title="At-Risk Machines"
          value={machinesCritical + machinesModerate}
          subtitle="Require attention"
          icon={Target}
        />
      </div>

      {/* Priority & Positive Insights */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Priority Actions */}
        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-status-critical" />
            <h2 className="text-lg font-semibold text-foreground">
              Priority Actions
            </h2>
          </div>

          <div className="space-y-3">
            {machinesCritical > 0 && (
              <div className="flex items-start gap-3 rounded-lg bg-status-critical-bg/50 p-3">
                <AlertTriangle className="h-5 w-5 text-status-critical" />
                <div>
                  <p className="font-medium text-foreground">
                    {machinesCritical} machine(s) in critical condition
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Immediate inspection recommended
                  </p>
                </div>
              </div>
            )}

            {fastDegraders.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg bg-status-moderate-bg/50 p-3">
                <TrendingDown className="h-5 w-5 text-status-moderate" />
                <div>
                  <p className="font-medium text-foreground">
                    {fastDegraders.length} fast degrading machine(s)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Engines: {fastDegraders.map((d) => d.engine_id).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {machinesModerate > 0 && (
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    {machinesModerate} machine(s) need preventive maintenance
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Schedule maintenance soon
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Positive Indicators */}
        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-6 w-6 text-status-healthy" />
            <h2 className="text-lg font-semibold text-foreground">
              Positive Indicators
            </h2>
          </div>

          <div className="space-y-3">
            {machinesHealthy > 0 && (
              <div className="flex items-start gap-3 rounded-lg bg-status-healthy-bg/50 p-3">
                <CheckCircle2 className="h-5 w-5 text-status-healthy" />
                <div>
                  <p className="font-medium text-foreground">
                    {machinesHealthy} machine(s) operating optimally
                  </p>
                  <p className="text-sm text-muted-foreground">
                    No immediate maintenance required
                  </p>
                </div>
              </div>
            )}

            {fleetAvgHealth > 0.7 && (
              <div className="flex items-start gap-3 rounded-lg bg-accent/50 p-3">
                <BarChart3 className="h-5 w-5 text-accent-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    Fleet health above threshold
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Strong overall maintenance performance
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fleet Status Table */}
      <div className="dashboard-card">
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Fleet Status Summary
          </h2>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-left text-sm font-semibold text-foreground">
                Engine ID
              </th>
              <th className="pb-3 text-left text-sm font-semibold text-foreground">
                Health
              </th>
              <th className="pb-3 text-left text-sm font-semibold text-foreground">
                Status
              </th>
              <th className="pb-3 text-left text-sm font-semibold text-foreground">
                Cluster
              </th>
              <th className="pb-3 text-left text-sm font-semibold text-foreground">
                Recommendation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {latestHealthByEngine.map((d) => {
              const status =
                d.health >= 0.75
                  ? "healthy"
                  : d.health >= 0.5
                  ? "moderate"
                  : "critical";

              const cluster = labeledClusters.find(
                (c) => c.engine_id === d.engine_id
              );

              return (
                <tr key={d.engine_id}>
                  <td className="py-3 text-sm font-medium text-foreground">
                    Engine {d.engine_id}
                  </td>
                  <td className="py-3 text-sm text-foreground">
                    {(d.health * 100).toFixed(1)}%
                  </td>
                  <td className="py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="py-3 text-sm text-muted-foreground capitalize">
                    {cluster?.cluster || "N/A"} degrader
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">
                    {status === "critical"
                      ? "Immediate inspection required"
                      : status === "moderate"
                      ? "Schedule preventive maintenance"
                      : "Continue monitoring"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MainLayout>
  );
}
