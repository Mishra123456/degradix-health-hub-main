# 🚀 DEGRADIX – Predictive Machine Health Monitoring System

DEGRADIX is an end-to-end **machine health monitoring and degradation analysis system** built using **FastAPI**, **React**, and a **hybrid Machine Learning model (Random Forest + LSTM)**.  
It is inspired by the **NASA C-MAPSS turbofan engine dataset** and focuses on health estimation, degradation speed, reliability, and clustering of machines.

---

## 🔍 Key Features

- 📤 CSV-based engine data upload
- 🧠 Hybrid ML model (RF + LSTM)
- 📉 Health Index estimation (0–1)
- ⚡ Degradation Speed Index (DSI)
- 🛡 Reliability estimation
- 🧩 Unsupervised engine clustering (KMeans)
- 📊 Interactive React dashboard

---

## 🧠 Machine Learning Architecture

### Hybrid Health Estimation Model

| Component | Purpose |
|---------|--------|
| Random Forest | Learns non-linear sensor → health mapping |
| LSTM | Captures temporal degradation patterns |
| Hybrid Output | `0.6 * RF + 0.4 * LSTM` |

> ⚠️ **Note:**  
> The current implementation performs **health estimation**, not full Remaining Useful Life (RUL) prediction.  
> Health is derived from sensor trends rather than true failure labels.

---

## 📊 System Pipeline

