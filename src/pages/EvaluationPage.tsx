import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { Cpu, ShieldCheck, TrendingDown, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ModelMetrics = {
  mae: number;
  rmse: number;
  r2: number;
};

type EvaluationMetrics = {
  rf_health: ModelMetrics;
  rf_rul: ModelMetrics;
  lstm_rul: ModelMetrics;
};

export default function EvaluationPage() {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    api.metrics()
      .then((data) => {
        setMetrics(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load metrics:", err);
        setError("Could not retrieve model performance metrics from backend.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <MainLayout>
      <PageHeader
        title="Model Performance & Evaluation"
        description="Comprehensive evaluation metrics for the DEGRADIX predictive maintenance model suite"
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="ml-3 text-muted-foreground font-medium">Loading evaluation metrics...</span>
        </div>
      ) : error || !metrics ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive mb-6">
          <p className="font-semibold">Error Loading Metrics</p>
          <p className="text-sm">{error || "No metrics data available."}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Overview Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* RF Health Model Card */}
            <div className="dashboard-card border border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">RF Health Model</h3>
                  <p className="text-xs text-muted-foreground mt-1">RandomForestRegressor</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Estimates the current health index (0–1) based on instant sensor readings. Used for fleet diagnostics.
              </p>
              
              <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-4">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    MAE
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>Mean Absolute Error: Lower is better.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.rf_health.mae.toFixed(4)}</p>
                </div>
                <div className="text-center border-x border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    RMSE
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>Root Mean Squared Error: Penalizes larger errors. Lower is better.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.rf_health.rmse.toFixed(4)}</p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    R² Score
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>Coefficient of determination: Closer to 1.0 is better.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.rf_health.r2.toFixed(4)}</p>
                </div>
              </div>
            </div>

            {/* RF RUL Model Card */}
            <div className="dashboard-card border border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-status-moderate" />
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">RF RUL Model</h3>
                  <p className="text-xs text-muted-foreground mt-1">RandomForestRegressor</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-moderate/10 text-status-moderate">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Predicts RUL directly from current sensor variables. Serves as a sequence-independent fallback.
              </p>
              
              <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-4">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    MAE
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>Average error in predicted remaining cycles.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.rf_rul.mae.toFixed(1)}</p>
                </div>
                <div className="text-center border-x border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    RMSE
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>Root Mean Squared Error for predicted cycles.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.rf_rul.rmse.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    R² Score
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>R2 regression score. Proportion of variance explained.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.rf_rul.r2.toFixed(3)}</p>
                </div>
              </div>
            </div>

            {/* LSTM RUL Model Card */}
            <div className="dashboard-card border border-border/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-accent-foreground" />
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">LSTM RUL Model</h3>
                  <p className="text-xs text-muted-foreground mt-1">Keras Sequence Network</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                  <Cpu className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Captures temporal degradation dynamics using 20-cycle sensor sequence inputs for advanced forecasting.
              </p>
              
              <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-4">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    MAE
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>Average error in predicted remaining cycles (sequence based).</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.lstm_rul.mae.toFixed(1)}</p>
                </div>
                <div className="text-center border-x border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    RMSE
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>Root Mean Squared Error of sequence forecasting.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.lstm_rul.rmse.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
                    R² Score
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent>R2 score for sequence model. Higher is better.</TooltipContent>
                    </Tooltip>
                  </span>
                  <p className="text-lg font-bold text-foreground mt-1">{metrics.lstm_rul.r2.toFixed(3)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Details Explanation */}
          <div className="dashboard-card">
            <h3 className="text-md font-semibold text-foreground mb-4">Metric Definitions & Evaluation Standard</h3>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-lg bg-muted/40 p-4 border border-border/30">
                <p className="font-semibold text-sm text-foreground mb-1">Mean Absolute Error (MAE)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Measures the average magnitude of errors in a set of predictions, without considering their direction. It is the average absolute difference between the predicted and actual values.
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4 border border-border/30">
                <p className="font-semibold text-sm text-foreground mb-1">Root Mean Squared Error (RMSE)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A quadratic metric that measures the average magnitude of error. It gives a relatively high weight to large errors, meaning RMSE is most useful when large errors are particularly undesirable.
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4 border border-border/30">
                <p className="font-semibold text-sm text-foreground mb-1">R² (Coefficient of Determination)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Represents the proportion of variance in the dependent variable that is predictable from the independent variables. A score of 1.0 indicates perfect prediction.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
