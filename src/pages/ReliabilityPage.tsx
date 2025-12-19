import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { ReliabilityGauge } from "@/components/charts/ReliabilityGauge";
import { MachineSelector } from "@/components/MachineSelector";
import { Shield, Clock, TrendingUp, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

const pct = (v?: number) => (v ?? 0) * 100;

export default function ReliabilityPage() {
  /** 🔑 ALWAYS FIRST */
  const { file, reliabilityData, setReliabilityData, machineIds } =
    useAppData();

  /** 🔑 SAFE INITIAL VALUE */
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);

  /** 🔑 FETCH */
  useEffect(() => {
    if (!file) return;
    api.reliability(file).then(setReliabilityData);
  }, [file, setReliabilityData]);

  /** 🔑 SET DEFAULT MACHINE ONCE */
  useEffect(() => {
    if (machineIds.length && selectedMachine === null) {
      setSelectedMachine(machineIds[0]);
    }
  }, [machineIds, selectedMachine]);

  /** 🔑 DERIVED DATA */
  const machineData = useMemo(() => {
    if (!selectedMachine) return [];
    return reliabilityData.filter((d) => d.engine_id === selectedMachine);
  }, [reliabilityData, selectedMachine]);

  const latest = machineData[machineData.length - 1];

  const avg20 =
    machineData.slice(-20).reduce((s, d) => s + d.reliability, 0) /
    (machineData.slice(-20).length || 1);

  /** 🔑 EMPTY STATE */
  if (!file) {
    return (
      <MainLayout>
        <PageHeader
          title="Reliability Estimation"
          description="Upload data to view reliability"
        />
      </MainLayout>
    );
  }

  if (!selectedMachine) return null;

  return (
    <MainLayout>
      <PageHeader
        title="Reliability Estimation"
        description="Probability of continued safe operation"
      >
        <MachineSelector
          machines={machineIds}
          value={selectedMachine}
          onChange={setSelectedMachine}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <div className="dashboard-card flex flex-col items-center py-8">
          <h2 className="text-lg font-semibold mb-2">
            Engine {selectedMachine}
          </h2>
          <ReliabilityGauge value={pct(latest?.reliability)} size="lg" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
          <MetricCard
            title="Current Reliability"
            value={`${pct(latest?.reliability).toFixed(1)}%`}
            icon={Shield}
          />
          <MetricCard
            title="20-Cycle Average"
            value={`${pct(avg20).toFixed(1)}%`}
            icon={TrendingUp}
          />
          <MetricCard
            title="Operating Cycles"
            value={machineData.length}
            icon={Clock}
          />
          <MetricCard
            title="Fleet Machines"
            value={machineIds.length}
            icon={Activity}
          />
        </div>
      </div>

      <div className="dashboard-card">
        {machineIds.map((id) => {
          const last = reliabilityData
            .filter((d) => d.engine_id === id)
            .slice(-1)[0];

          return (
            <div key={id} className="mb-3">
              <div className="flex justify-between text-sm">
                <span>Engine {id}</span>
                <span>{pct(last?.reliability).toFixed(1)}%</span>
              </div>
              <Progress value={pct(last?.reliability)} className="h-2" />
            </div>
          );
        })}
      </div>
    </MainLayout>
  );
}
