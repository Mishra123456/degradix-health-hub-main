import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import {
  Cpu,
  Brain,
  Database,
  GitBranch,
  Layers,
  Target,
  BookOpen,
  Github,
} from 'lucide-react';

export default function AboutPage() {
  return (
    <MainLayout>
      <PageHeader
        title="About DEGRADIX"
        description="Intelligent Machine Health & Degradation Analytics Platform"
      />

      {/* Hero Section */}
      <div className="dashboard-card mb-8 bg-gradient-to-br from-primary/5 to-accent/30">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Cpu className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              DEGRADIX
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              A generic ML + DL powered predictive maintenance platform that
              analyzes machine health, degradation speed, degradation patterns,
              and reliability using time-series sensor data.
            </p>
            <p className="text-sm text-muted-foreground">
              Designed to work with ANY industrial machine (engines, motors,
              pumps, turbines, compressors, gearboxes, etc.) provided sensor
              data is available.
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Brain className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Machine Learning</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Random Forest models for health index prediction and degradation
            pattern recognition based on sensor feature extraction.
          </p>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Layers className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Deep Learning</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            LSTM neural networks for temporal pattern analysis and remaining
            useful life estimation from sequential sensor data.
          </p>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <GitBranch className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">
              Unsupervised Learning
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            KMeans clustering for identifying degradation behavior groups and
            fleet-wide pattern analysis without labeled data.
          </p>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Database className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Data Pipeline</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Robust CSV processing pipeline with sensor normalization, feature
            engineering, and real-time analytics computation.
          </p>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Target className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">
              Predictive Analytics
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Degradation Speed Index (DSI) and reliability estimation for
            proactive maintenance scheduling and failure prevention.
          </p>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <BookOpen className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Reference Dataset</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            NASA C-MAPSS (Commercial Modular Aero-Propulsion System Simulation)
            dataset used for demonstration and model validation.
          </p>
        </div>
      </div>

      {/* Technical Details */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Target Users
          </h3>
          <ul className="space-y-3">
            {[
              'Maintenance Engineers',
              'Reliability Engineers',
              'Industrial Analysts',
              'Academic Evaluators',
            ].map((user) => (
              <li
                key={user}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <div className="h-2 w-2 rounded-full bg-primary" />
                {user}
              </li>
            ))}
          </ul>
        </div>

        <div className="dashboard-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Technical Stack
          </h3>
          <ul className="space-y-3">
            {[
              'Frontend: React + TypeScript',
              'Backend: FastAPI (Python)',
              'Charts: Recharts',
              'ML: Scikit-learn, TensorFlow/Keras',
              'Deployment: CPU-based implementation',
            ].map((tech) => (
              <li
                key={tech}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <div className="h-2 w-2 rounded-full bg-primary" />
                {tech}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Academic Note */}
      <div className="dashboard-card bg-accent/30">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Github className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">
              Academic Final-Year Project
            </h3>
            <p className="text-sm text-muted-foreground">
              DEGRADIX was developed as a comprehensive predictive maintenance
              solution demonstrating the application of machine learning and deep
              learning techniques to industrial health monitoring. The platform
              showcases practical implementation of data science methodologies
              for real-world engineering challenges.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
