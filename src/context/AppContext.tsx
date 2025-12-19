import { createContext, useContext, useMemo, useState } from "react";

type ReliabilityRow = {
  engine_id: number;
  cycle: number;
  reliability: number;
};

type AppContextType = {
  file: File | null;
  setFile: (file: File | null) => void;

  reliabilityData: ReliabilityRow[];
  setReliabilityData: (d: ReliabilityRow[]) => void;

  machineIds: number[];
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [reliabilityData, setReliabilityData] = useState<ReliabilityRow[]>([]);

  /** 🔑 ALWAYS SAFE */
  const machineIds = useMemo(() => {
    return Array.from(new Set(reliabilityData.map((d) => d.engine_id))).sort(
      (a, b) => a - b
    );
  }, [reliabilityData]);

  return (
    <AppContext.Provider
      value={{
        file,
        setFile,
        reliabilityData,
        setReliabilityData,
        machineIds,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppData must be used inside AppProvider");
  return ctx;
}
