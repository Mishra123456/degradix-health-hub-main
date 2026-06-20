import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge, getHealthStatus } from "@/components/ui/status-badge";
import { HealthChart } from "@/components/charts/HealthChart";
import { ClusterChart } from "@/components/charts/ClusterChart";
import { ReliabilityGauge } from "@/components/charts/ReliabilityGauge";
import { RulTrendChart } from "@/components/charts/RulTrendChart";
import { MachineSelector } from "@/components/MachineSelector";
import { Link } from "react-router-dom";
import { Activity, TrendingDown, AlertTriangle, Server, Clock, Shield, Upload } from "lucide-react";

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

type RulRow = {
  engine_id: number;
  cycle: number;
  predicted_rul: number;
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
  const [rulData, setRulData] = useState<RulRow[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);

  /* ---------------- Fetch Data ---------------- */

  useEffect(() => {
    if (!file) return;

    api.health(file).then(setHealthData);
    api.dsi(file).then(setDsiData);
    api.reliability(file).then(setReliabilityData);
    api.clusters(file).then(setClusters);
    api.predictRul(file).then(setRulData).catch(err => {
      console.warn("Predict RUL failed, models might not be trained yet:", err);
    });
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

  const machineRul = useMemo(() => {
    if (!selectedMachine) return [];
    return rulData.filter((d) => d.engine_id === selectedMachine);
  }, [rulData, selectedMachine]);

  const latestRul = machineRul[machineRul.length - 1];

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

  /* ---------------- Risk Helper ---------------- */

  const getRiskLevel = (rul: number): "LOW" | "MEDIUM" | "HIGH" => {
    if (rul > 80) return "LOW";
    if (rul >= 30) return "MEDIUM";
    return "HIGH";
  };

  /* ---------------- GUARDS (AFTER HOOKS) ---------------- */

  if (!file) {
    return (
      <MainLayout>
        <PageHeader
          title="Dashboard"
          description="Upload data to view machine analytics"
        />
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-card rounded-2xl border border-border/50 max-w-3xl mx-auto shadow-sm mt-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 animate-pulse">
            <Upload className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">No Active Machine Data</h2>
          <p className="text-muted-foreground text-sm max-w-md mb-8 leading-relaxed">
            Upload your machine time-series sensor data (CSV format) to begin predictive analytics, RUL estimations, and health indexing.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Upload className="mr-2 h-4 w-4" /> Go to Upload Page
          </Link>
        </div>
      </MainLayout>
    );
  }

  if (!selectedMachine) return null;

  /* ---------------- UI ---------------- */

  return (
    <MainLayout>
      <PageHeader
        title="Dashboard"
        description="Real-time machine health and remaining useful life monitoring"
      >
        <MachineSelector
          machines={machineIds}
          value={selectedMachine}
          onChange={setSelectedMachine}
        />
      </PageHeader>

      {/* Fleet Level Metrics */}
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

      {/* Selected Engine Prognostics (RUL & Risk additions) */}
      <div className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Engine {selectedMachine} Prognostics
      </div>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <MetricCard
          title="Remaining Useful Life"
          value={latestRul ? `${latestRul.predicted_rul} Cycles` : "N/A"}
          subtitle="Estimated time before failure"
          icon={Clock}
        />

        <MetricCard
          title="Maintenance Risk Level"
          value={latestRul ? getRiskLevel(latestRul.predicted_rul) : "N/A"}
          subtitle="Categorized based on RUL limits"
          icon={AlertTriangle}
        >
          {latestRul && (
            <div className="mt-3">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                latestRul.predicted_rul > 80 
                  ? "bg-status-healthy-bg text-status-healthy border-status-healthy/20"
                  : latestRul.predicted_rul >= 30
                  ? "bg-status-moderate-bg text-status-moderate border-status-moderate/20"
                  : "bg-status-critical-bg text-status-critical border-status-critical/20"
              }`}>
                {getRiskLevel(latestRul.predicted_rul)} RISK
              </span>
            </div>
          )}
        </MetricCard>

        <MetricCard
          title="Probability of Survival"
          value={latestReliability ? `${(latestReliability.reliability * 100).toFixed(1)}%` : "N/A"}
          subtitle="Reliability index at latest cycle"
          icon={Shield}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health vs Cycle Chart */}
        <div className="lg:col-span-2 dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Health vs Time (Cycle)
            </h2>
            <StatusBadge status={healthStatus} />
          </div>
          <HealthChart
            data={machineHealth.map((d) => ({
              cycle: d.cycle,
              health: d.health * 100,
            }))}
            showThresholds={true}
          />
        </div>

        {/* Reliability Gauge */}
        <div className="dashboard-card flex items-center justify-center">
          <ReliabilityGauge
            value={(latestReliability?.reliability ?? 0) * 100}
            size="lg"
          />
        </div>

        {/* RUL Trend Chart (Plot: Cycle vs Predicted RUL) */}
        <div className="lg:col-span-2 dashboard-card">
          <RulTrendChart
            data={machineRul.map((d) => ({
              cycle: d.cycle,
              rul: d.predicted_rul,
            }))}
          />
        </div>

        {/* RUL Classification Strategy Card */}
        <div className="dashboard-card flex flex-col justify-center p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            RUL Risk Strategy
          </h3>
          <ul className="space-y-3 text-xs text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <span className="h-2 w-2 rounded-full bg-status-healthy mt-1" />
              <div>
                <strong>Low Risk (&gt;80 cycles):</strong>
                <p className="text-[11px] text-muted-foreground mt-0.5">Machine is operating optimally. Perform routine logs.</p>
              </div>
            </li>
            <li className="flex items-start gap-2.5 border-t border-border/50 pt-2.5">
              <span className="h-2 w-2 rounded-full bg-status-moderate mt-1" />
              <div>
                <strong>Medium Risk (30–80 cycles):</strong>
                <p className="text-[11px] text-muted-foreground mt-0.5">Degradation detected. Schedule inspection for next service window.</p>
              </div>
            </li>
            <li className="flex items-start gap-2.5 border-t border-border/50 pt-2.5">
              <span className="h-2 w-2 rounded-full bg-status-critical mt-1" />
              <div>
                <strong>High Risk (&lt;30 cycles):</strong>
                <p className="text-[11px] text-muted-foreground mt-0.5">Immediate failure danger. Dispatch repair crews immediately.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Cluster Chart */}
        <div className="lg:col-span-3 dashboard-card">
          <ClusterChart data={labeledClusters} />
        </div>
      </div>
    </MainLayout>
  );
}
