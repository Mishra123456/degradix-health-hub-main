import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge, getHealthStatus } from "@/components/ui/status-badge";
import { HealthChart } from "@/components/charts/HealthChart";
import { ClusterChart } from "@/components/charts/ClusterChart";
import { ReliabilityGauge } from "@/components/charts/ReliabilityGauge";
import { MachineSelector } from "@/components/MachineSelector";
import { Activity, TrendingDown, AlertTriangle, Server } from "lucide-react";

import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

/* ---------------- Types ---------------- */

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

type ReliabilityRow = {
  engine_id: number;
  cycle: number;
  reliability: number;
};

type ClusterRow = {
  engine_id: number;
  degradation_span: number;
  cycles: number;
  cluster: number;
};

type ClusterLabel = "slow" | "moderate" | "fast";

/* ---------------- Component ---------------- */

export default function Dashboard() {
  /** 🔑 ALWAYS FIRST */
  const { file } = useAppData();

  const [healthData, setHealthData] = useState<HealthRow[]>([]);
  const [dsiData, setDsiData] = useState<DsiRow[]>([]);
  const [reliabilityData, setReliabilityData] = useState<ReliabilityRow[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);

  /* ---------------- Fetch Data ---------------- */

  useEffect(() => {
    if (!file) return;

    api.health(file).then(setHealthData);
    api.dsi(file).then(setDsiData);
    api.reliability(file).then(setReliabilityData);
    api.clusters(file).then(setClusters);
  }, [file]);

  /* ---------------- Machine IDs ---------------- */

  const machineIds = useMemo(() => {
    return Array.from(new Set(healthData.map((d) => d.engine_id))).sort(
      (a, b) => a - b
    );
  }, [healthData]);

  /** 🔑 DEFAULT MACHINE (SIDE EFFECT) */
  useEffect(() => {
    if (machineIds.length && selectedMachine === null) {
      setSelectedMachine(machineIds[0]);
    }
  }, [machineIds, selectedMachine]);

  /* ---------------- Selected Machine Data ---------------- */

  const machineHealth = useMemo(() => {
    if (!selectedMachine) return [];
    return healthData.filter((d) => d.engine_id === selectedMachine);
  }, [healthData, selectedMachine]);

  const latestHealth = machineHealth[machineHealth.length - 1];

  const machineReliability = useMemo(() => {
    if (!selectedMachine) return [];
    return reliabilityData.filter((d) => d.engine_id === selectedMachine);
  }, [reliabilityData, selectedMachine]);

  const latestReliability = machineReliability[machineReliability.length - 1];

  const healthStatus = latestHealth
    ? getHealthStatus(latestHealth.health * 100)
    : "healthy";

  /* ---------------- Fleet Stats ---------------- */

  const latestHealthByEngine = useMemo(() => {
    const map = new Map<number, HealthRow>();
    healthData.forEach((row) => map.set(row.engine_id, row));
    return Array.from(map.values());
  }, [healthData]);

  const fleetAvgHealth =
    latestHealthByEngine.reduce((s, d) => s + d.health, 0) /
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

  /* ---------------- Fastest Degrader ---------------- */

  const avgDsiByEngine = useMemo(() => {
    const map = new Map<number, number[]>();
    dsiData.forEach((row) => {
      if (!map.has(row.engine_id)) map.set(row.engine_id, []);
      map.get(row.engine_id)!.push(row.DSI);
    });

    return Array.from(map.entries()).map(([engine, values]) => ({
      engine,
      avgDsi: values.reduce((s, v) => s + v, 0) / (values.length || 1),
    }));
  }, [dsiData]);

  const fastestDegrader = avgDsiByEngine.sort((a, b) => b.avgDsi - a.avgDsi)[0];

  /* ---------------- Cluster Labeling ---------------- */

  const labeledClusters = useMemo(() => {
    if (!clusters.length) return [];

    const sorted = [...clusters].sort(
      (a, b) => b.degradation_span - a.degradation_span
    );

    const uniqueIds = Array.from(new Set(sorted.map((c) => c.cluster)));
    const map = new Map<number, ClusterLabel>();

    uniqueIds.forEach((id, idx) => {
      if (idx === 0) map.set(id, "fast");
      else if (idx === uniqueIds.length - 1) map.set(id, "slow");
      else map.set(id, "moderate");
    });

    return sorted.map((c) => ({
      machine_id: c.engine_id,
      operating_cycles: c.cycles,
      degradation_span: c.degradation_span,
      cluster: map.get(c.cluster)!,
    }));
  }, [clusters]);

  /* ---------------- GUARDS (AFTER HOOKS) ---------------- */

  if (!file) {
    return (
      <MainLayout>
        <PageHeader
          title="Dashboard"
          description="Upload data to view machine analytics"
        />
      </MainLayout>
    );
  }

  if (!selectedMachine) return null;

  /* ---------------- UI ---------------- */

  return (
    <MainLayout>
      <PageHeader
        title="Dashboard"
        description="Real-time machine health monitoring"
      >
        <MachineSelector
          machines={machineIds}
          value={selectedMachine}
          onChange={setSelectedMachine}
        />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Fleet Machines"
          value={machineIds.length}
          icon={Server}
        />

        <MetricCard
          title="Average Health"
          value={`${(fleetAvgHealth * 100).toFixed(1)}%`}
          icon={Activity}
        />

        <MetricCard
          title="Critical Machines"
          value={machinesCritical}
          icon={AlertTriangle}
        />

        <MetricCard
          title="Fastest Degrader"
          value={`Engine ${fastestDegrader?.engine}`}
          subtitle={`Avg DSI ${fastestDegrader?.avgDsi.toFixed(3)}`}
          icon={TrendingDown}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 dashboard-card">
          <HealthChart
            data={machineHealth.map((d) => ({
              cycle: d.cycle,
              health: d.health * 100,
            }))}
          />
        </div>

        <div className="dashboard-card flex items-center justify-center">
          <ReliabilityGauge
            value={(latestReliability?.reliability ?? 0) * 100}
            size="lg"
          />
        </div>

        <div className="lg:col-span-3 dashboard-card">
          <ClusterChart data={labeledClusters} />
        </div>
      </div>
    </MainLayout>
  );
}
