const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function postFile(endpoint: string, file: File, engineId?: number) {
  const formData = new FormData();
  formData.append("file", file);

  let url = `${BASE_URL}${endpoint}`;
  if (engineId !== undefined && engineId !== null) {
    url += `?engine_id=${engineId}`;
  }

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = "API request failed";
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        if (typeof errJson.detail === "string") {
          errorDetail = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errorDetail = errJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
        } else {
          errorDetail = JSON.stringify(errJson.detail);
        }
      }
    } catch (_) {
      // Ignore if JSON parsing fails
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  analyze: (file: File) => postFile("/analyze", file),
  health: (file: File) => postFile("/health", file),
  dsi: (file: File) => postFile("/dsi", file),
  clusters: (file: File) => postFile("/clusters", file),
  reliability: (file: File) => postFile("/reliability", file),
  insights: (file: File) => postFile("/insights", file),
  predictRul: (file: File) => postFile("/predict-rul", file),
  predictHealth: (file: File) => postFile("/predict-health", file),
  predictComplete: (file: File, engineId?: number) => postFile("/predict-complete", file, engineId),
  explain: (file: File, engineId?: number) => postFile("/explain", file, engineId),
  metrics: async () => {
    const res = await fetch(`${BASE_URL}/metrics`);
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  },
  startTraining: async () => {
    const res = await fetch(`${BASE_URL}/train`, { method: "POST" });
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  },
  getTrainingStatus: async () => {
    const res = await fetch(`${BASE_URL}/train/status`);
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  },
  getTrainingLogs: async (q?: string, tail?: number) => {
    let url = `${BASE_URL}/train/logs`;
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (tail) params.append("tail", tail.toString());
    const queryStr = params.toString();
    if (queryStr) url += `?${queryStr}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  },
};

