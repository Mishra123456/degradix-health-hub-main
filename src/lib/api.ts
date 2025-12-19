const BASE_URL = "http://127.0.0.1:8000";

async function postFile(endpoint: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
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
};
