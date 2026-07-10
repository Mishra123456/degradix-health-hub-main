import { useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { 
  Terminal, 
  Play, 
  RefreshCw, 
  Search, 
  Eye, 
  EyeOff, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";

type LogLine = {
  index: number;
  text: string;
};

type TrainingStatus = {
  status: "idle" | "training";
  log_exists: boolean;
  last_updated: number | null;
};

type ModelMetrics = {
  mae: number;
  rmse: number;
  r2: number;
};

type SystemMetrics = {
  rf_health: ModelMetrics;
  rf_rul: ModelMetrics;
  lstm_rul: ModelMetrics;
};

export default function LogsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<TrainingStatus>({ status: "idle", log_exists: false, last_updated: null });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveTail, setLiveTail] = useState(true);
  const [totalLines, setTotalLines] = useState(0);
  const [isTriggering, setIsTriggering] = useState(false);
  
  const consoleRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch training status and metrics on mount
  useEffect(() => {
    fetchStatus();
    fetchMetrics();
    fetchLogs("", 150); // initial load last 150 lines
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // 2. Set up dynamic polling based on status
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const intervalTime = status.status === "training" ? 1000 : 5000;
    
    pollingRef.current = setInterval(() => {
      fetchStatus();
      // Only fetch logs with search filter if user is actively searching
      fetchLogs(searchQuery, searchQuery ? undefined : 250);
    }, intervalTime);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status.status, searchQuery]);

  // 3. Handle Auto-scroll / Live Tail
  useEffect(() => {
    if (liveTail && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, liveTail]);

  const fetchStatus = () => {
    api.getTrainingStatus()
      .then((data) => {
        setStatus(data);
      })
      .catch((err) => console.error("Failed to fetch status:", err));
  };

  const fetchMetrics = () => {
    api.metrics()
      .then((data) => setMetrics(data))
      .catch((err) => console.error("Failed to fetch metrics:", err));
  };

  const fetchLogs = (query?: string, tail?: number) => {
    api.getTrainingLogs(query, tail)
      .then((data) => {
        setLogs(data.lines || []);
        setTotalLines(data.total_lines || 0);
        if (data.status && data.status !== status.status) {
          setStatus(prev => ({ ...prev, status: data.status }));
        }
      })
      .catch((err) => console.error("Failed to fetch logs:", err));
  };

  const handleStartTraining = () => {
    setIsTriggering(true);
    api.startTraining()
      .then(() => {
        setStatus(prev => ({ ...prev, status: "training" }));
        toast({
          title: "Training Pipeline Started",
          description: "The Random Forest and LSTM models are now retraining on the NASA C-MAPSS dataset.",
        });
        fetchLogs("", 150);
      })
      .catch((err) => {
        console.error("Training trigger failed:", err);
        toast({
          title: "Failed to Start Training",
          description: "Ensure the backend environment is active and not already running another task.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsTriggering(false);
      });
  };

  // 4. Colorize terminal log lines for syntax highlighting
  const renderLogText = (text: string) => {
    // Highlight Epochs
    if (text.includes("Epoch")) {
      const epochRegex = /(Epoch \d+\/\d+)/g;
      return text.split(epochRegex).map((part, i) => 
        epochRegex.test(part) ? <span key={i} className="text-cyan-400 font-bold">{part}</span> : part
      );
    }
    
    // Highlight completed logs
    if (text.includes("TRAINING & EVALUATION COMPLETE") || text.includes("complete successfully")) {
      return <span className="text-emerald-400 font-bold">{text}</span>;
    }

    // Highlight metrics details (Loss, MAE, R2)
    if (text.includes("loss:") || text.includes("mae:") || text.includes("rmse:") || text.includes("r2:")) {
      // Split by space and highlight metrics keys
      const tokens = text.split(" ");
      return tokens.map((token, i) => {
        if (token.startsWith("loss:") || token.startsWith("mae:") || token.startsWith("val_loss:") || token.startsWith("val_mae:") || token.startsWith("r2:") || token.startsWith("rmse:")) {
          return <span key={i} className="text-amber-400 font-medium">{token} </span>;
        }
        if (token.includes("━━━━━")) {
          return <span key={i} className="text-zinc-600">{token} </span>;
        }
        return token + " ";
      });
    }

    // Error highlighting
    if (text.toLowerCase().includes("error") || text.toLowerCase().includes("exception") || text.toLowerCase().includes("failed")) {
      return <span className="text-red-400">{text}</span>;
    }

    // Warning highlighting
    if (text.toLowerCase().includes("warning")) {
      return <span className="text-yellow-500">{text}</span>;
    }

    return text;
  };

  return (
    <MainLayout>
      <PageHeader
        title="Model Training & System Logs"
        description="Retrain the Random Forest + LSTM model suite and track training telemetry in real-time."
      />

      <div className="space-y-6">
        {/* Telemetry & Trigger Bar */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Status Card */}
          <div className="dashboard-card relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${status.status === "training" ? "bg-primary animate-pulse" : "bg-emerald-500"}`} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Status</span>
              {status.status === "training" ? (
                <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  Running
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Idle
                </div>
              )}
            </div>
            
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-2xl font-bold text-foreground">
                {status.status === "training" ? "Retraining Models..." : "Models Ready"}
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              {status.last_updated 
                ? `Logs last modified: ${new Date(status.last_updated * 1000).toLocaleTimeString()}`
                : "No training session recorded yet."}
            </p>

            <button
              onClick={handleStartTraining}
              disabled={status.status === "training" || isTriggering}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.status === "training" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Training Active
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Start Training Pipeline
                </>
              )}
            </button>
          </div>

          {/* Model Accuracy Metrics Quick View */}
          {metrics && (
            <div className="dashboard-card md:col-span-2 grid grid-cols-3 gap-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
              <div className="col-span-3 flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Model Performance Metrics</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                  <Cpu className="h-3.5 w-3.5" /> NASA C-MAPSS
                </span>
              </div>

              <div className="bg-secondary/40 p-3 rounded-lg flex flex-col justify-center">
                <p className="text-xs text-muted-foreground font-medium">RF Health MAE</p>
                <p className="text-xl font-bold mt-1 text-foreground">{metrics.rf_health.mae.toFixed(4)}</p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-500 mt-1">
                  <CheckCircle2 className="h-3 w-3" /> Target Met
                </div>
              </div>

              <div className="bg-secondary/40 p-3 rounded-lg flex flex-col justify-center">
                <p className="text-xs text-muted-foreground font-medium">RF RUL MAE</p>
                <p className="text-xl font-bold mt-1 text-foreground">{metrics.rf_rul.mae.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">cycles</p>
              </div>

              <div className="bg-secondary/40 p-3 rounded-lg flex flex-col justify-center">
                <p className="text-xs text-muted-foreground font-medium">LSTM RUL MAE</p>
                <p className="text-xl font-bold mt-1 text-foreground">{metrics.lstm_rul.mae.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">cycles (20w)</p>
              </div>
            </div>
          )}
        </div>

        {/* Terminal Window Container */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-elevated flex flex-col min-h-[500px]">
          {/* Terminal Title Bar */}
          <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-zinc-400" />
              <span className="font-mono text-xs font-semibold text-zinc-300">degradix-model-training.log</span>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                {totalLines} lines
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search log query..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    fetchLogs(e.target.value, e.target.value ? undefined : 200);
                  }}
                  className="bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono w-48 sm:w-64 focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Live Tail Toggle */}
              <button
                onClick={() => setLiveTail(!liveTail)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  liveTail 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "bg-zinc-850 text-zinc-400 border border-zinc-800"
                }`}
              >
                {liveTail ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                Live Tail
              </button>
            </div>
          </div>

          {/* Console Output Area */}
          <div 
            ref={consoleRef}
            className="flex-grow p-4 overflow-y-auto font-mono text-[11px] sm:text-xs leading-relaxed text-zinc-300 select-text selection:bg-zinc-800 max-h-[550px] bg-zinc-950"
          >
            {logs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-500">
                <Terminal className="h-8 w-8 mb-2 opacity-50" />
                <p>No log records matching your query found.</p>
                <p className="text-[10px] opacity-75 mt-1">Start training or clear the search criteria.</p>
              </div>
            ) : (
              logs.map((line) => (
                <div key={line.index} className="flex hover:bg-zinc-900/40 py-0.5 rounded px-1 group">
                  {/* Line Number */}
                  <span className="w-10 text-right text-zinc-700 select-none pr-3 border-r border-zinc-900 font-mono">
                    {line.index}
                  </span>
                  {/* Text */}
                  <span className="pl-4 flex-grow break-all whitespace-pre-wrap font-mono">
                    {renderLogText(line.text)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Terminal Status Footer */}
          <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span>Encoding: UTF-8</span>
            <span>
              {status.status === "training" ? "Tailing (1s poll rate)" : "Idle (5s poll rate)"}
            </span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
