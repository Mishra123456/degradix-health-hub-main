from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import json
import joblib
from pathlib import Path
from datetime import datetime

from sklearn.cluster import KMeans
from tensorflow.keras.models import load_model
from sqlalchemy.orm import Session

from database import get_db, init_db, AnalysisHistory, User
from auth import router as auth_router, get_current_user

# --------------------------------------------------
# PATHS
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "ml"

RF_PATH = MODEL_DIR / "rf_model.joblib"
SCALER_PATH = MODEL_DIR / "scaler.joblib"
LSTM_PATH = MODEL_DIR / "lstm_model.keras"

SEQ_LEN = 20

# --------------------------------------------------
# APP INIT
# --------------------------------------------------
app = FastAPI(
    title="DEGRADIX – Predictive Machine Health API",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth router
app.include_router(auth_router)


@app.on_event("startup")
def on_startup():
    init_db()


# --------------------------------------------------
# LOAD MODELS (ONCE AT STARTUP)
# --------------------------------------------------
rf_model = joblib.load(RF_PATH)
scaler = joblib.load(SCALER_PATH)
lstm_model = load_model(LSTM_PATH)

# --------------------------------------------------
# UTILITIES
# --------------------------------------------------
def load_csv(file: UploadFile) -> pd.DataFrame:
    df = pd.read_csv(file.file)
    if not {"engine_id", "cycle"}.issubset(df.columns):
        raise ValueError("CSV must contain engine_id and cycle columns")
    return df


def sensor_columns(df: pd.DataFrame):
    cols = [c for c in df.columns if c.startswith("sensor")]
    if not cols:
        raise ValueError("sensor_* columns required")
    return cols


# --------------------------------------------------
# HEALTH PREDICTION (RF + LSTM)
# --------------------------------------------------
def compute_health(df: pd.DataFrame) -> pd.DataFrame:
    sensors = sensor_columns(df)
    X = scaler.transform(df[sensors].values)

    # --- RF: instant health ---
    health_rf = rf_model.predict(X)

    # --- LSTM: temporal smoothing ---
    lstm_pred = np.zeros_like(health_rf)

    if len(health_rf) >= SEQ_LEN:
        sequences = [
            health_rf[i:i + SEQ_LEN]
            for i in range(len(health_rf) - SEQ_LEN)
        ]
        sequences = np.array(sequences).reshape(-1, SEQ_LEN, 1)
        preds = lstm_model.predict(sequences, verbose=0).flatten()
        lstm_pred[SEQ_LEN:] = preds
        lstm_pred[:SEQ_LEN] = preds[0]
    else:
        lstm_pred = health_rf

    # --- Hybrid ---
    df["health"] = np.clip(0.6 * health_rf + 0.4 * lstm_pred, 0, 1)
    return df


# --------------------------------------------------
# DSI
# --------------------------------------------------
def compute_dsi(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["engine_id", "cycle"])
    df["DSI"] = -df.groupby("engine_id")["health"].diff().fillna(0)
    return df


# --------------------------------------------------
# RELIABILITY
# --------------------------------------------------
def compute_reliability(df: pd.DataFrame, lam=2.0) -> pd.DataFrame:
    df["reliability"] = np.exp(-lam * (1 - df["health"]))
    return df


# --------------------------------------------------
# CLUSTERING
# --------------------------------------------------
def cluster_engines(df: pd.DataFrame) -> pd.DataFrame:
    features = df.groupby("engine_id").agg(
        avg_health=("health", "mean"),
        min_health=("health", "min"),
        degradation_span=("health", lambda x: x.iloc[0] - x.iloc[-1]),
        cycles=("cycle", "max"),
    )

    kmeans = KMeans(
        n_clusters=min(3, len(features)),
        random_state=42
    )
    features["cluster"] = kmeans.fit_predict(features)
    return features.reset_index()


# --------------------------------------------------
# RUL PREDICTION
# --------------------------------------------------
def compute_rul(df: pd.DataFrame) -> list:
    """
    Estimate Remaining Useful Life (RUL) per engine using LSTM sequence forecasting.
    Falls back to linear decay for machines with < SEQ_LEN (20) cycles.
    """
    df = df.sort_values(["engine_id", "cycle"])
    results = []

    lstm_candidates = []
    engine_groups = {}

    for engine_id, group in df.groupby("engine_id"):
        engine_groups[engine_id] = group
        if len(group["health"].values) >= SEQ_LEN:
            lstm_candidates.append(engine_id)

    predicted_ruls = {}
    
    # 1. Vectorized Autoregressive LSTM Inference
    if lstm_candidates:
        sequences = [engine_groups[eid]["health"].values[-SEQ_LEN:] for eid in lstm_candidates]
        running_seqs = np.array(sequences).reshape(len(lstm_candidates), SEQ_LEN, 1)
        ruls_array = np.full(len(lstm_candidates), 500) # Max limit 500
        active_mask = np.ones(len(lstm_candidates), dtype=bool)

        for step in range(1, 501):
            if not active_mask.any():
                break
            
            # Predict next cycle health for all engines in batch
            preds = lstm_model.predict(running_seqs, verbose=0)
            
            # Check threshold
            reached_zero = (preds[:, 0] <= 0.05) & active_mask
            ruls_array[reached_zero] = step
            active_mask[reached_zero] = False
            
            # Shift sequence and append new prediction
            running_seqs = np.concatenate([running_seqs[:, 1:, :], preds.reshape(-1, 1, 1)], axis=1)

        for idx, eid in enumerate(lstm_candidates):
            predicted_ruls[eid] = ruls_array[idx]

    # 2. Build Results
    for engine_id, group in engine_groups.items():
        health_vals = group["health"].values
        cycles = group["cycle"].values
        total_cycles = int(cycles[-1] - cycles[0]) or 1
        last_health = float(health_vals[-1])
        first_health = float(health_vals[0])
        decay_rate = (first_health - last_health) / total_cycles

        # Linear Fallback or LSTM assignment
        if engine_id in lstm_candidates:
            rul = predicted_ruls[engine_id]
        else:
            if len(health_vals) < 2:
                rul = 999
                decay_rate = 0.0
            elif decay_rate > 0.0001:
                rul = min(last_health / decay_rate, total_cycles * 3)
            else:
                rul = total_cycles * 3
        
        rul = max(0, int(round(rul)))

        if rul < 50: urgency = "critical"
        elif rul < 150: urgency = "high"
        elif rul < 300: urgency = "moderate"
        else: urgency = "low"

        results.append({
            "engine_id": int(engine_id),
            "current_health": round(last_health, 4),
            "predicted_rul": rul,
            "decay_rate": round(decay_rate, 6),
            "total_cycles": int(len(cycles)),
            "urgency": urgency,
        })
        
    return results


# --------------------------------------------------
# API ENDPOINTS
# --------------------------------------------------
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    df = load_csv(file)
    df = compute_health(df)
    df = compute_dsi(df)
    clusters = cluster_engines(df)

    return {
        "health": df[["engine_id", "cycle", "health"]].to_dict("records"),
        "dsi": df[["engine_id", "cycle", "DSI"]].to_dict("records"),
        "clusters": clusters.to_dict("records"),
    }


@app.post("/health")
async def health(file: UploadFile = File(...)):
    df = compute_health(load_csv(file))
    return df[["engine_id", "cycle", "health"]].to_dict("records")


@app.post("/dsi")
async def dsi(file: UploadFile = File(...)):
    df = compute_dsi(compute_health(load_csv(file)))
    return df[["engine_id", "cycle", "DSI"]].to_dict("records")


@app.post("/reliability")
async def reliability(file: UploadFile = File(...)):
    df = compute_reliability(compute_health(load_csv(file)))
    return df[["engine_id", "cycle", "reliability"]].to_dict("records")


@app.post("/clusters")
async def clusters(file: UploadFile = File(...)):
    df = compute_health(load_csv(file))
    return cluster_engines(df).to_dict("records")


@app.post("/rul")
async def rul(file: UploadFile = File(...)):
    df = compute_health(load_csv(file))
    return compute_rul(df)


# --------------------------------------------------
# ANALYSIS HISTORY
# --------------------------------------------------
@app.post("/history")
async def save_history(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = load_csv(file)
    df = compute_health(df)
    rul_results = compute_rul(df)

    summary = json.dumps({
        "engines": len(df["engine_id"].unique()),
        "total_records": len(df),
        "avg_health": round(float(df["health"].mean()), 4),
        "rul_summary": rul_results,
    })

    entry = AnalysisHistory(
        user_id=current_user.id,
        filename=file.filename or "unknown.csv",
        summary=summary,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "id": entry.id,
        "filename": entry.filename,
        "timestamp": entry.timestamp.isoformat(),
        "summary": json.loads(entry.summary),
    }


@app.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.user_id == current_user.id)
        .order_by(AnalysisHistory.timestamp.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": e.id,
            "filename": e.filename,
            "timestamp": e.timestamp.isoformat(),
            "summary": json.loads(e.summary) if e.summary else None,
        }
        for e in entries
    ]
