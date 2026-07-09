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
    throw new Error("API request failed");
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
};

