import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { FileUpload } from "@/components/FileUpload";
import { FileText, Database, CheckCircle2 } from "lucide-react";

import { api } from "@/lib/api";
import { useAppData } from "@/context/AppContext";

export default function UploadPage() {
  const { setFile } = useAppData();

  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleUpload = async (file: File) => {
    setIsLoading(true);

    try {
      // 🔗 REAL BACKEND CALL (FastAPI)
      await api.analyze(file);

      // Store file globally for other pages
      setFile(file);

      // Track upload history
      setUploadedFiles((prev) => [...prev, file.name]);
    } catch (error) {
      console.error(error);
      alert("Failed to upload and analyze CSV file");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Upload Sensor Data"
        description="Upload CSV files containing machine sensor readings for analysis"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Section */}
        <div className="dashboard-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Upload CSV File
          </h2>
          <FileUpload onUpload={handleUpload} isLoading={isLoading} />
        </div>

        {/* Instructions */}
        <div className="dashboard-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Data Requirements
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                <FileText className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">CSV Format</p>
                <p className="text-sm text-muted-foreground">
                  File must be in comma-separated values format with headers
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                <Database className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Required Columns</p>
                <p className="text-sm text-muted-foreground">
                  engine_id, cycle, and at least one sensor column (sensor_1,
                  sensor_2, etc.)
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-muted p-4">
              <p className="text-sm font-medium text-foreground mb-2">
                Example Data:
              </p>
              <pre className="text-xs text-muted-foreground font-mono overflow-x-auto">
                {`engine_id,cycle,sensor_1,sensor_2,sensor_3
1,1,518.67,642.35,1589.70
1,2,518.67,642.35,1591.82
1,3,518.67,642.61,1587.99
...`}
              </pre>
            </div>
          </div>
        </div>

        {/* Upload History */}
        {uploadedFiles.length > 0 && (
          <div className="lg:col-span-2 dashboard-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Uploaded Files
            </h2>
            <div className="space-y-2">
              {uploadedFiles.map((fileName, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                >
                  <CheckCircle2 className="h-5 w-5 text-status-healthy" />
                  <span className="font-medium text-foreground">
                    {fileName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Processed successfully
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
