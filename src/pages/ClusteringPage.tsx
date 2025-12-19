import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { ClusterChart } from "@/components/charts/ClusterChart";
import {
  GitBranch,
  Layers,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

type ClusterRow = {
  engine_id: number;
  avg_health: number;
  min_health: number;
  degradation_span: number;
  cycles: number;
  cluster: number;
};

type ClusterLabel = "slow" | "moderate" | "fast";

export default function ClusteringPage() {
  const { file } = useAppData();
  const [clusters, setClusters] = useState<ClusterRow[]>([]);

  // Fetch clustering data
  useEffect(() => {
    if (!file) return;
    api.clusters(file).then(setClusters);
  }, [file]);

  if (!file) {
    return (
      <MainLayout>
        <PageHeader
          title="Degradation Pattern Clustering"
          description="Upload data to view clustering results"
        />
        <p className="text-muted-foreground">Please upload a CSV file first.</p>
      </MainLayout>
    );
  }

  // 🔑 Map numeric clusters → semantic labels
  const labeledClusters = useMemo(() => {
    if (!clusters.length) return [];

    // Sort clusters by degradation severity
    const sorted = [...clusters].sort(
      (a, b) => b.degradation_span - a.degradation_span
    );

    const uniqueClusterIds = Array.from(new Set(sorted.map((c) => c.cluster)));

    const clusterMap = new Map<number, ClusterLabel>();

    uniqueClusterIds.forEach((id, index) => {
      if (index === 0) clusterMap.set(id, "fast");
      else if (index === uniqueClusterIds.length - 1)
        clusterMap.set(id, "slow");
      else clusterMap.set(id, "moderate");
    });

    return sorted.map((c) => ({
      machine_id: c.engine_id,
      operating_cycles: c.cycles,
      degradation_span: c.degradation_span,
      cluster: clusterMap.get(c.cluster)!,
    }));
  }, [clusters]);

  const slowCount = labeledClusters.filter((d) => d.cluster === "slow").length;

  const moderateCount = labeledClusters.filter(
    (d) => d.cluster === "moderate"
  ).length;

  const fastCount = labeledClusters.filter((d) => d.cluster === "fast").length;

  return (
    <MainLayout>
      <PageHeader
        title="Degradation Pattern Clustering"
        description="Unsupervised machine learning to identify degradation behavior patterns"
      />

      {/* Cluster Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Total Machines"
          value={labeledClusters.length}
          subtitle="In cluster analysis"
          icon={Layers}
        />

        <MetricCard
          title="Slow Degraders"
          value={slowCount}
          subtitle="Lower maintenance priority"
          icon={CheckCircle}
        >
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-status-healthy transition-all"
              style={{
                width: `${(slowCount / (labeledClusters.length || 1)) * 100}%`,
              }}
            />
          </div>
        </MetricCard>

        <MetricCard
          title="Moderate Degraders"
          value={moderateCount}
          subtitle="Schedule maintenance"
          icon={GitBranch}
        >
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-status-moderate transition-all"
              style={{
                width: `${
                  (moderateCount / (labeledClusters.length || 1)) * 100
                }%`,
              }}
            />
          </div>
        </MetricCard>

        <MetricCard
          title="Fast Degraders"
          value={fastCount}
          subtitle="Priority attention"
          icon={AlertTriangle}
        >
          <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-status-critical transition-all"
              style={{
                width: `${(fastCount / (labeledClusters.length || 1)) * 100}%`,
              }}
            />
          </div>
        </MetricCard>
      </div>

      {/* Cluster Visualization */}
      <div className="dashboard-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Cluster Visualization
            </h2>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  KMeans clustering groups machines based on operating cycles
                  and degradation span. Points closer together exhibit similar
                  degradation behavior.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <ClusterChart data={labeledClusters} />
      </div>

      {/* Cluster Details */}
      <div className="grid gap-4 md:grid-cols-3">
        {["slow", "moderate", "fast"].map((label) => (
          <div
            key={label}
            className={`dashboard-card border-l-4 ${
              label === "slow"
                ? "border-l-status-healthy"
                : label === "moderate"
                ? "border-l-status-moderate"
                : "border-l-status-critical"
            }`}
          >
            <h3 className="font-semibold text-foreground mb-2 capitalize">
              {label} Degraders
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {label === "slow"
                ? "Machines with slower health decline"
                : label === "moderate"
                ? "Machines with average degradation rate"
                : "Rapid health decline, immediate attention required"}
            </p>

            <div className="space-y-2">
              {labeledClusters
                .filter((d) => d.cluster === label)
                .map((d) => (
                  <div
                    key={d.machine_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium text-foreground">
                      Engine {d.machine_id}
                    </span>
                    <span className="text-muted-foreground">
                      {d.operating_cycles} cycles
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
}
