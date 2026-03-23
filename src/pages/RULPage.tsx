import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { MachineSelector } from "@/components/MachineSelector";
import { Timer, AlertTriangle, Activity, TrendingDown, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";

import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

type RULEntry = {
    engine_id: number;
    current_health: number;
    predicted_rul: number;
    decay_rate: number;
    total_cycles: number;
    urgency: "critical" | "high" | "moderate" | "low";
};

const URGENCY_COLORS: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    moderate: "#eab308",
    low: "#22c55e",
};

const URGENCY_BG: Record<string, string> = {
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    moderate: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-green-500/10 text-green-500 border-green-500/20",
};

export default function RULPage() {
    const { file } = useAppData();
    const [rulData, setRulData] = useState<RULEntry[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<number | null>(null);

    useEffect(() => {
        if (!file) return;
        api.rul(file).then(setRulData);
    }, [file]);

    const machineIds = useMemo(() => {
        return rulData.map((d) => d.engine_id).sort((a, b) => a - b);
    }, [rulData]);

    useEffect(() => {
        if (machineIds.length && selectedMachine === null) {
            setSelectedMachine(machineIds[0]);
        }
    }, [machineIds, selectedMachine]);

    const selectedEntry = useMemo(() => {
        if (!selectedMachine) return null;
        return rulData.find((d) => d.engine_id === selectedMachine) || null;
    }, [rulData, selectedMachine]);

    // Fleet stats
    const criticalCount = rulData.filter((d) => d.urgency === "critical").length;
    const highCount = rulData.filter((d) => d.urgency === "high").length;
    const avgRul =
        rulData.reduce((s, d) => s + d.predicted_rul, 0) / (rulData.length || 1);

    // Chart data sorted by RUL ascending (most urgent first)
    const chartData = useMemo(() => {
        return [...rulData]
            .sort((a, b) => a.predicted_rul - b.predicted_rul)
            .map((d) => ({
                name: `E${d.engine_id}`,
                rul: d.predicted_rul,
                urgency: d.urgency,
            }));
    }, [rulData]);

    if (!file) {
        return (
            <MainLayout>
                <PageHeader
                    title="RUL Prediction"
                    description="Upload data to view remaining useful life predictions"
                />
                <p className="text-muted-foreground">Please upload a CSV file first.</p>
            </MainLayout>
        );
    }

    if (!selectedMachine || !selectedEntry) return null;

    return (
        <MainLayout>
            <PageHeader
                title="RUL Prediction"
                description="Remaining Useful Life estimation for each engine"
            >
                <MachineSelector
                    machines={machineIds}
                    value={selectedMachine}
                    onChange={setSelectedMachine}
                />
            </PageHeader>

            {/* Metric Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <MetricCard
                    title="Predicted RUL"
                    value={`${selectedEntry.predicted_rul} cycles`}
                    icon={Timer}
                >
                    <div className="mt-3">
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${URGENCY_BG[selectedEntry.urgency]
                                }`}
                        >
                            {selectedEntry.urgency.toUpperCase()}
                        </span>
                    </div>
                </MetricCard>

                <MetricCard
                    title="Current Health"
                    value={`${(selectedEntry.current_health * 100).toFixed(1)}%`}
                    icon={Activity}
                />

                <MetricCard
                    title="Decay Rate"
                    value={`${(selectedEntry.decay_rate * 1000).toFixed(3)}‰/cycle`}
                    subtitle="Health loss per 1000 cycles"
                    icon={TrendingDown}
                />

                <MetricCard
                    title="Critical Machines"
                    value={criticalCount + highCount}
                    subtitle={`${criticalCount} critical, ${highCount} high`}
                    icon={AlertTriangle}
                />
            </div>

            {/* RUL Bar Chart */}
            <div className="dashboard-card mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                    Fleet RUL Overview
                </h2>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="name"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                label={{
                                    value: "Predicted RUL (cycles)",
                                    angle: -90,
                                    position: "insideLeft",
                                    style: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
                                }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))",
                                }}
                            />
                            <Bar dataKey="rul" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={URGENCY_COLORS[entry.urgency]}
                                        fillOpacity={0.85}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Fleet Table */}
            <div className="dashboard-card">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    Engine RUL Details
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left">
                                <th className="pb-3 font-medium text-muted-foreground">Engine</th>
                                <th className="pb-3 font-medium text-muted-foreground">Health</th>
                                <th className="pb-3 font-medium text-muted-foreground">Predicted RUL</th>
                                <th className="pb-3 font-medium text-muted-foreground">Decay Rate</th>
                                <th className="pb-3 font-medium text-muted-foreground">Cycles</th>
                                <th className="pb-3 font-medium text-muted-foreground">Urgency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...rulData]
                                .sort((a, b) => a.predicted_rul - b.predicted_rul)
                                .map((entry) => (
                                    <tr
                                        key={entry.engine_id}
                                        className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                                    >
                                        <td className="py-3 font-medium">Engine {entry.engine_id}</td>
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <Progress
                                                    value={entry.current_health * 100}
                                                    className="h-2 w-20"
                                                />
                                                <span>{(entry.current_health * 100).toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td className="py-3 font-semibold">{entry.predicted_rul} cycles</td>
                                        <td className="py-3">
                                            {(entry.decay_rate * 1000).toFixed(3)}‰
                                        </td>
                                        <td className="py-3">{entry.total_cycles}</td>
                                        <td className="py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${URGENCY_BG[entry.urgency]
                                                    }`}
                                            >
                                                {entry.urgency.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="dashboard-card mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                    Urgency Level Thresholds
                </h3>
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="flex items-center gap-3 rounded-lg bg-red-500/5 p-3 border border-red-500/20">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <div>
                            <p className="font-medium text-foreground">Critical (&lt;50)</p>
                            <p className="text-xs text-muted-foreground">Immediate action</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-orange-500/5 p-3 border border-orange-500/20">
                        <div className="h-3 w-3 rounded-full bg-orange-500" />
                        <div>
                            <p className="font-medium text-foreground">High (50–150)</p>
                            <p className="text-xs text-muted-foreground">Schedule maintenance</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-yellow-500/5 p-3 border border-yellow-500/20">
                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                        <div>
                            <p className="font-medium text-foreground">Moderate (150–300)</p>
                            <p className="text-xs text-muted-foreground">Monitor closely</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-green-500/5 p-3 border border-green-500/20">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <div>
                            <p className="font-medium text-foreground">Low (&gt;300)</p>
                            <p className="text-xs text-muted-foreground">Normal operation</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
