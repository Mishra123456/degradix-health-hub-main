import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { DSIChart } from "@/components/charts/DSIChart";
import { MachineSelector } from "@/components/MachineSelector";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendingDown, Zap, BarChart3, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

type DsiRow = {
  engine_id: number;
  cycle: number;
  DSI: number;
};

export default function DegradationPage() {
  const { file } = useAppData();

  const [dsiData, setDsiData] = useState<DsiRow[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);
  const [showAverage, setShowAverage] = useState(false);

  /* ---------------- FETCH DATA ---------------- */

  useEffect(() => {
    if (!file) return;
    api.dsi(file).then(setDsiData);
  }, [file]);

  /* ---------------- MEMOS (ALL BEFORE RETURNS) ---------------- */

  const machineIds = useMemo(() => {
    const ids = Array.from(new Set(dsiData.map((d) => d.engine_id)));
    if (ids.length && selectedMachine === null) {
      setSelectedMachine(ids[0]);
    }
    return ids;
  }, [dsiData, selectedMachine]);

  const machineData = useMemo(() => {
    if (!selectedMachine) return [];
    return dsiData.filter((d) => d.engine_id === selectedMachine);
  }, [dsiData, selectedMachine]);

  const latestData = machineData[machineData.length - 1];

  const averageData = useMemo(() => {
    const grouped: Record<number, number[]> = {};

    dsiData.forEach((row) => {
      if (!grouped[row.cycle]) grouped[row.cycle] = [];
      grouped[row.cycle].push(row.DSI);
    });

    return Object.entries(grouped).map(([cycle, values]) => ({
      cycle: Number(cycle),
      avgDsi: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));
  }, [dsiData]);

  const avgMachineDsi =
    machineData.reduce((sum, d) => sum + d.DSI, 0) / (machineData.length || 1);

  const maxDsi =
    machineData.length > 0 ? Math.max(...machineData.map((d) => d.DSI)) : 0;

  const minDsi =
    machineData.length > 0 ? Math.min(...machineData.map((d) => d.DSI)) : 0;

  /* ---------------- GUARDS (SAFE NOW) ---------------- */

  if (!file) {
    return (
      <MainLayout>
        <PageHeader
          title="Degradation Speed Index (DSI)"
          description="Upload data to view degradation speed"
        />
        <p className="text-muted-foreground">Please upload a CSV file first.</p>
      </MainLayout>
    );
  }

  if (!selectedMachine) return null;

  /* ---------------- UI ---------------- */

  return (
    <MainLayout>
      <PageHeader
        title="Degradation Speed Index (DSI)"
        description="Monitor degradation velocity and maintenance urgency"
      >
        <MachineSelector
          machines={machineIds}
          value={selectedMachine}
          onChange={setSelectedMachine}
        />
      </PageHeader>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Current DSI"
          value={latestData?.DSI.toFixed(3) || "0.000"}
          subtitle="Latest measurement"
          icon={TrendingDown}
        />

        <MetricCard
          title="Average DSI"
          value={avgMachineDsi.toFixed(3)}
          subtitle="Machine average"
          icon={BarChart3}
        />

        <MetricCard
          title="Peak DSI"
          value={maxDsi.toFixed(3)}
          subtitle="Maximum recorded"
          icon={Zap}
        />

        <MetricCard
          title="DSI Range"
          value={`${minDsi.toFixed(3)} - ${maxDsi.toFixed(3)}`}
          subtitle="Min to max"
          icon={BarChart3}
        />
      </div>

      {/* Chart */}
      <div className="dashboard-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              DSI vs Time for Engine {selectedMachine}
            </h2>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Higher DSI indicates faster degradation and higher maintenance
                  urgency.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-average"
              checked={showAverage}
              onCheckedChange={setShowAverage}
            />
            <Label
              htmlFor="show-average"
              className="text-sm text-muted-foreground"
            >
              Show Fleet Average
            </Label>
          </div>
        </div>

        <DSIChart
          data={machineData.map((d) => ({
            cycle: d.cycle,
            dsi: d.DSI,
          }))}
          averageData={averageData}
          showAverage={showAverage}
        />
      </div>
    </MainLayout>
  );
}
