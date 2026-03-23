const BASE_URL = "http://127.0.0.1:8000";

// --------------------------------------------------
// FILE UPLOAD HELPERS
// --------------------------------------------------
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

async function postFileAuth(endpoint: string, file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("API request failed");
  }

  return res.json();
}

// --------------------------------------------------
// AUTH API
// --------------------------------------------------
async function login(username: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error);
  if (!res.ok) throw new Error("Login failed");
  return data;
}

async function register(username: string, email: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error);
  if (!res.ok) throw new Error("Registration failed");
  return data;
}

async function getMe(token: string) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error);
  if (!res.ok) throw new Error("Failed to fetch user");
  return data;
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
export const api = {
  // ML endpoints
  analyze: (file: File) => postFile("/analyze", file),
  health: (file: File) => postFile("/health", file),
  dsi: (file: File) => postFile("/dsi", file),
  clusters: (file: File) => postFile("/clusters", file),
  reliability: (file: File) => postFile("/reliability", file),
  insights: (file: File) => postFile("/insights", file),
  rul: (file: File) => postFile("/rul", file),

  // Auth
  login,
  register,
  getMe,

  // History (authenticated)
  saveHistory: (file: File, token: string) =>
    postFileAuth("/history", file, token),
  getHistory: async (token: string) => {
    const res = await fetch(`${BASE_URL}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
  },
};
