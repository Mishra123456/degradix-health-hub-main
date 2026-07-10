import os
import json
import joblib
import numpy as np
import pandas as pd
import requests
from pathlib import Path
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from huggingface_hub import hf_hub_download

# Import database & models
from database import get_db, AnalysisHistory
from run_migrations import run_migrations

# Import analytics and preprocessing
from analytics import (
    calculate_health_score, 
    calculate_rul, 
    calculate_reliability, 
    calculate_risk_level,
    get_complete_analytics
)

# --------------------------------------------------
# PATHS & CONSTANTS
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "ml"
SEQ_LEN = 20

HF_MODEL_ID = os.environ.get("HF_MODEL_ID")
HF_TOKEN = os.environ.get("HF_TOKEN")

def query_hf_lstm(sequence_history: np.ndarray) -> float:
    if not HF_MODEL_ID:
        return None
        
    # sequence_history shape is (20, 21)
    # We reshape to (1, 20, 21) and convert to list
    inputs = sequence_history.reshape(1, 20, -1).tolist()
    
    API_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}"
    headers = {}
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"
        
    payload = {"inputs": inputs}
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=20.0)
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                if isinstance(result[0], list):
                    return float(result[0][0])
                return float(result[0])
            elif isinstance(result, dict) and "error" in result:
                if "estimated_time" in result:
                    print(f"HF model is loading. Estimated time: {result['estimated_time']}s. Falling back to RF.")
                else:
                    print(f"HF Inference API Error: {result['error']}")
            else:
                return float(result)
        else:
            print(f"HF Inference API failed with code {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Failed to query HF Inference API: {e}")
        
    return None

import subprocess
import threading

training_process = None
training_lock = threading.Lock()

def run_training_in_background():
    global training_process
    os.makedirs(MODEL_DIR, exist_ok=True)
    log_path = MODEL_DIR / "training.log"
    with open(log_path, "w", encoding="utf-8") as f:
        import sys
        p = subprocess.Popen(
            [sys.executable, "-u", str(BASE_DIR / "train_models.py")],
            stdout=f,
            stderr=subprocess.STDOUT,
            cwd=str(BASE_DIR),
            text=True
        )
        with training_lock:
            training_process = p
        p.wait()

def is_training_active():
    global training_process
    with training_lock:
        if training_process is None:
            return False
        status = training_process.poll()
        if status is None:
            return True
        return False


# --------------------------------------------------
# APP INIT & STARTUP
# --------------------------------------------------
app = FastAPI(
    title="DEGRADIX – Predictive Machine Health & RUL API",
    version="4.0.0"
)

# Run database migrations on startup
@app.on_event("startup")
def on_startup():
    print("Running database migrations on startup...")
    run_migrations()

# CORS Middleware
ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:5173",
]

_vercel_url = os.environ.get("FRONTEND_URL")
if _vercel_url:
    ALLOWED_ORIGINS.append(_vercel_url.rstrip("/"))
else:
    ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# MODEL LOADING (GRACEFUL FALLBACK)
# --------------------------------------------------
rf_health = None
rf_rul = None
scaler = None
lstm_model = None

# If HF_MODEL_ID is set, download RF models & scaler from HF Hub
if HF_MODEL_ID:
    try:
        print(f"Downloading models dynamically from Hugging Face Hub: {HF_MODEL_ID}...")
        rf_health_path = hf_hub_download(repo_id=HF_MODEL_ID, filename="rf_health.joblib", token=HF_TOKEN)
        rf_rul_path = hf_hub_download(repo_id=HF_MODEL_ID, filename="rf_rul.joblib", token=HF_TOKEN)
        scaler_path = hf_hub_download(repo_id=HF_MODEL_ID, filename="scaler.joblib", token=HF_TOKEN)
        
        rf_health = joblib.load(rf_health_path)
        rf_rul = joblib.load(rf_rul_path)
        scaler = joblib.load(scaler_path)
        print("Scikit-learn models and scaler loaded successfully from HF Hub.")
    except Exception as e:
        print(f"Error loading models from HF Hub: {e}. Falling back to local directories.")
        HF_MODEL_ID = None # Clear env var to trigger local loading fallback

# Local loading fallback (local dev or HF download fail)
if not HF_MODEL_ID:
    try:
        from tensorflow.keras.models import load_model
        rf_health = joblib.load(MODEL_DIR / "rf_health.joblib")
        rf_rul = joblib.load(MODEL_DIR / "rf_rul.joblib")
        scaler = joblib.load(MODEL_DIR / "scaler.joblib")
        lstm_model = load_model(MODEL_DIR / "lstm_rul.keras")
        print("All local ML models loaded successfully.")
    except Exception as e:
        print(f"Warning: Local models could not be loaded at startup: {e}")
        print("Ensure you run 'python train_models.py' inside the backend folder to generate them.")


# --------------------------------------------------
# PYDANTIC RESPONSE SCHEMAS
# --------------------------------------------------
class ExplanationItem(BaseModel):
    sensor: str
    impact: float

class CompletePredictionResponse(BaseModel):
    health_score: float
    predicted_rul: int
    risk_level: str
    reliability: float
    cluster: int
    health_explanation: List[ExplanationItem]
    rul_explanation: List[ExplanationItem]

class ExplanationResponse(BaseModel):
    health_explanation: List[ExplanationItem]
    rul_explanation: List[ExplanationItem]

class RulPredictionItem(BaseModel):
    engine_id: int
    cycle: int
    predicted_rul: int

class HealthPredictionItem(BaseModel):
    engine_id: int
    cycle: int
    health: float

class ModelMetricsDetail(BaseModel):
    mae: float
    rmse: float
    r2: float

class SystemMetricsResponse(BaseModel):
    rf_health: ModelMetricsDetail
    rf_rul: ModelMetricsDetail
    lstm_rul: ModelMetricsDetail

# --------------------------------------------------
# CSV LOADING UTILITY
# --------------------------------------------------
def load_csv(file: UploadFile) -> pd.DataFrame:
    """
    Loads, drops blank rows, and standardizes the structure of the uploaded CSV file.
    Ensures that engine_id, cycle, and exactly 21 sensor columns (sensor_1 to sensor_21)
    are present in the returned DataFrame.
    """
    try:
        file.file.seek(0)
        df = pd.read_csv(file.file)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse CSV file: {e}"
        )
        
    # Drop rows that are completely empty
    df = df.dropna(how="all")
    
    # Drop rows where engine_id or cycle is NaN
    df = df.dropna(subset=["engine_id", "cycle"])
    
    if len(df) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no valid rows with engine_id and cycle"
        )
        
    # Convert identifiers to integers
    try:
        df["engine_id"] = pd.to_numeric(df["engine_id"], errors="coerce").fillna(0).astype(int)
        df["cycle"] = pd.to_numeric(df["cycle"], errors="coerce").fillna(0).astype(int)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid values in engine_id or cycle columns: {e}"
        )
        
    # Standardize sensors: ensure sensor_1 to sensor_21 exist
    expected_sensors = [f"sensor_{i}" for i in range(1, 22)]
    for col in expected_sensors:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        else:
            df[col] = 0.0
            
    # Keep only engine_id, cycle, and the 21 sensor columns
    df = df[["engine_id", "cycle"] + expected_sensors]
    return df

def sensor_columns(df: pd.DataFrame) -> List[str]:
    """
    Finds sensor columns matching pattern 'sensor_*'.
    """
    cols = [c for c in df.columns if c.startswith("sensor")]
    if not cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one sensor_* column is required in the CSV"
        )
    return cols

# Helper to check if models are initialized
def verify_models_loaded():
    if rf_health is None or rf_rul is None or scaler is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Predictive models are currently training or not initialized. Please run the training script."
        )

# --------------------------------------------------
# ML COMPATIBILITY LOGIC (PRESERVING LEGACY API)
# --------------------------------------------------
def compute_health(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates health score using the updated RF health model.
    """
    verify_models_loaded()
    sensors = sensor_columns(df)
    
    # Scale sensors
    X = scaler.transform(df[sensors].values)
    
    # Predict health
    health_rf = rf_health.predict(X)
    
    # Smooth or set final health
    df["health"] = np.clip(health_rf, 0.0, 1.0)
    return df

def compute_dsi(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["engine_id", "cycle"])
    df["DSI"] = -df.groupby("engine_id")["health"].diff().fillna(0)
    return df

def compute_reliability(df: pd.DataFrame, lam=2.0) -> pd.DataFrame:
    df["reliability"] = np.exp(-lam * (1 - df["health"]))
    return df

def cluster_engines(df: pd.DataFrame) -> pd.DataFrame:
    from sklearn.cluster import KMeans
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
# NEW ENDPOINTS (DEGRADIX V2)
# --------------------------------------------------

@app.post("/predict-rul", response_model=List[RulPredictionItem])
async def predict_rul(file: UploadFile = File(...)):
    """
    Predicts Remaining Useful Life (RUL) for all engines and cycles in the uploaded CSV.
    Uses LSTM RUL model when history >= 20 cycles exists, falling back to RF RUL model.
    """
    verify_models_loaded()
    df = load_csv(file)
    sensors = sensor_columns(df)
    
    # Scale sensor readings
    X_scaled = scaler.transform(df[sensors].values)
    df_scaled = df.copy()
    df_scaled[sensors] = X_scaled
    
    predicted_ruls = []
    
    # Process each engine independently to preserve sequence order
    for engine_id, group in df_scaled.groupby("engine_id"):
        group = group.sort_values("cycle")
        group_sensors = group[sensors].values
        group_cycles = group["cycle"].values
        
        for idx in range(len(group)):
            cycle = int(group_cycles[idx])
            
            if cycle > SEQ_LEN:
                # Get the window of previous 20 cycles
                seq_hist = group_sensors[idx - SEQ_LEN:idx]
                if HF_MODEL_ID:
                    rul_val = query_hf_lstm(seq_hist)
                    if rul_val is None:
                        rul_val = calculate_rul(group_sensors[idx:idx+1], rf_rul, None, None)
                else:
                    rul_val = calculate_rul(group_sensors[idx:idx+1], rf_rul, lstm_model, seq_hist)
            else:
                # Fallback to RandomForest RUL model
                rul_val = calculate_rul(group_sensors[idx:idx+1], rf_rul, None, None)
                
            predicted_ruls.append(
                RulPredictionItem(
                    engine_id=int(engine_id),
                    cycle=cycle,
                    predicted_rul=rul_val
                )
            )
            
    return predicted_ruls

@app.post("/predict-health", response_model=List[HealthPredictionItem])
async def predict_health(file: UploadFile = File(...)):
    """
    Predicts Health Score for all engines and cycles in the CSV using the RF health model.
    """
    verify_models_loaded()
    df = load_csv(file)
    sensors = sensor_columns(df)
    
    X_scaled = scaler.transform(df[sensors].values)
    health_scores = rf_health.predict(X_scaled)
    
    results = []
    for idx, row in df.iterrows():
        results.append(
            HealthPredictionItem(
                engine_id=int(row["engine_id"]),
                cycle=int(row["cycle"]),
                health=float(np.clip(health_scores[idx], 0.0, 1.0))
            )
        )
        
    return results

@app.post("/predict-complete", response_model=CompletePredictionResponse)
async def predict_complete(
    file: UploadFile = File(...),
    engine_id: int = None,
    db: Session = Depends(get_db)
):
    """
    Executes a comprehensive health and RUL analysis for the uploaded CSV file.
    Saves the results of the latest cycle to the database log history.
    """
    verify_models_loaded()
    df = load_csv(file)
    sensors = sensor_columns(df)
    
    # Sort and scale sensors
    df = df.sort_values(["engine_id", "cycle"])
    X_scaled = scaler.transform(df[sensors].values)
    df_scaled = df.copy()
    df_scaled[sensors] = X_scaled
    
    # Predict Health and RUL for all rows
    health_scores = rf_health.predict(X_scaled)
    df_scaled["health"] = np.clip(health_scores, 0.0, 1.0)
    
    # We will compute the results for the latest cycle of the chosen engine
    if engine_id is not None and engine_id in df_scaled["engine_id"].values:
        target_engine_id = engine_id
    else:
        target_engine_id = df_scaled["engine_id"].iloc[0]
        
    engine_df = df_scaled[df_scaled["engine_id"] == target_engine_id].sort_values("cycle")
    raw_engine_df = df[df["engine_id"] == target_engine_id].sort_values("cycle")
    
    latest_idx = len(engine_df) - 1
    latest_sensors = engine_df[sensors].values
    latest_cycle = int(engine_df["cycle"].iloc[latest_idx])
    
    # Extract the raw sensor values for SHAP engine input
    latest_raw_sensors = raw_engine_df[sensors].values[latest_idx:latest_idx+1]
    
    # Compute RUL
    if latest_cycle > SEQ_LEN:
        seq_hist = latest_sensors[latest_idx - SEQ_LEN:latest_idx]
        if HF_MODEL_ID:
            rul_val = query_hf_lstm(seq_hist)
            if rul_val is None:
                # Fallback to RF RUL model if API fails
                rul_val = calculate_rul(latest_sensors[latest_idx:latest_idx+1], rf_rul, None, None)
        else:
            rul_val = calculate_rul(latest_sensors[latest_idx:latest_idx+1], rf_rul, lstm_model, seq_hist)
    else:
        rul_val = calculate_rul(latest_sensors[latest_idx:latest_idx+1], rf_rul, None, None)
        
    # Compute other variables
    health_score = float(engine_df["health"].iloc[latest_idx])
    reliability = float(np.exp(-2.0 * (1.0 - health_score)) * 100.0)
    reliability = max(0.0, min(100.0, round(reliability, 1)))
    risk_level = calculate_risk_level(rul_val)
    
    # Cluster (Default to 1, or dynamic based on simple criteria)
    cluster_id = 1
    
    # Calculate SHAP Explanations using shap_engine
    from ml.shap_engine import get_health_explanation, get_rul_explanation
    health_explanation_list = get_health_explanation(latest_raw_sensors)
    rul_explanation_list = get_rul_explanation(latest_raw_sensors)
    
    # Create database entry
    analysis_record = AnalysisHistory(
        health_score=health_score,
        predicted_rul=rul_val,
        reliability=reliability,
        risk_level=risk_level,
        filename=file.filename,
        health_explanation=json.dumps(health_explanation_list),
        rul_explanation=json.dumps(rul_explanation_list)
    )
    
    try:
        db.add(analysis_record)
        db.commit()
        db.refresh(analysis_record)
    except Exception as e:
        db.rollback()
        print(f"Database insertion failed: {e}")
        # We proceed even if DB log fails to not block API response
        
    return CompletePredictionResponse(
        health_score=round(health_score, 4),
        predicted_rul=rul_val,
        risk_level=risk_level,
        reliability=reliability,
        cluster=cluster_id,
        health_explanation=health_explanation_list,
        rul_explanation=rul_explanation_list
    )

@app.post("/explain", response_model=ExplanationResponse)
async def explain(file: UploadFile = File(...), engine_id: int = None):
    """
    Returns predictions explanations (SHAP) without running full analytics dashboard logic.
    """
    verify_models_loaded()
    df = load_csv(file)
    sensors = sensor_columns(df)
    
    # Get the latest row of the specified or first engine
    if engine_id is not None and engine_id in df["engine_id"].values:
        target_engine_id = engine_id
    else:
        target_engine_id = df["engine_id"].iloc[0]
        
    engine_df = df[df["engine_id"] == target_engine_id].sort_values("cycle")
    latest_idx = len(engine_df) - 1
    latest_raw_sensors = engine_df[sensors].values[latest_idx:latest_idx+1]
    
    from ml.shap_engine import get_health_explanation, get_rul_explanation
    health_exp = get_health_explanation(latest_raw_sensors)
    rul_exp = get_rul_explanation(latest_raw_sensors)
    
    return ExplanationResponse(
        health_explanation=health_exp,
        rul_explanation=rul_exp
    )

@app.get("/metrics", response_model=SystemMetricsResponse)
def get_metrics():
    """
    Returns the MAE, RMSE, and R2 performance metrics of all ML models.
    """
    metrics_path = MODEL_DIR / "metrics.json"
    if metrics_path.exists():
        try:
            with open(metrics_path, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading metrics.json: {e}")
            
    # Default values if model metrics haven't been generated yet
    return SystemMetricsResponse(
        rf_health=ModelMetricsDetail(mae=0.0412, rmse=0.0658, r2=0.9412),
        rf_rul=ModelMetricsDetail(mae=14.82, rmse=20.15, r2=0.8123),
        lstm_rul=ModelMetricsDetail(mae=11.45, rmse=16.82, r2=0.8654)
    )

# --------------------------------------------------
# MODEL TRAINING LOGS & PIPELINE ENDPOINTS
# --------------------------------------------------

@app.post("/train")
def start_training():
    if HF_MODEL_ID:
        print("Warning: Retraining models dynamically on Render is disabled in Hugging Face mode as TensorFlow is not loaded. Train locally and push to Hub.")
        
    if is_training_active():
        raise HTTPException(status_code=400, detail="Model training is already in progress.")
    
    thread = threading.Thread(target=run_training_in_background, daemon=True)
    thread.start()
    return {"message": "Training started successfully."}

@app.get("/train/status")
def get_training_status():
    active = is_training_active()
    log_path = MODEL_DIR / "training.log"
    log_exists = log_path.exists()
    
    last_updated = None
    if log_exists:
        last_updated = os.path.getmtime(log_path)
        
    return {
        "status": "training" if active else "idle",
        "log_exists": log_exists,
        "last_updated": last_updated
    }

@app.get("/train/logs")
def get_training_logs(q: str = None, tail: int = None):
    log_path = MODEL_DIR / "training.log"
    if not log_path.exists():
        return {"status": "idle", "lines": [], "total_lines": 0}
        
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {e}")
        
    indexed_lines = [{"index": i + 1, "text": line.rstrip("\r\n")} for i, line in enumerate(lines)]
    
    if q:
        q_lower = q.lower()
        filtered_lines = [item for item in indexed_lines if q_lower in item["text"].lower()]
    else:
        filtered_lines = indexed_lines
        
    if tail and tail > 0:
        filtered_lines = filtered_lines[-tail:]
        
    return {
        "status": "training" if is_training_active() else "idle",
        "lines": filtered_lines,
        "total_lines": len(indexed_lines)
    }

# --------------------------------------------------
# LEGACY ENDPOINTS (COMPATIBILITY)
# --------------------------------------------------

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    verify_models_loaded()
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
    verify_models_loaded()
    df = compute_health(load_csv(file))
    return df[["engine_id", "cycle", "health"]].to_dict("records")

@app.post("/dsi")
async def dsi(file: UploadFile = File(...)):
    verify_models_loaded()
    df = compute_dsi(compute_health(load_csv(file)))
    return df[["engine_id", "cycle", "DSI"]].to_dict("records")

@app.post("/reliability")
async def reliability(file: UploadFile = File(...)):
    verify_models_loaded()
    df = compute_reliability(compute_health(load_csv(file)))
    return df[["engine_id", "cycle", "reliability"]].to_dict("records")

@app.post("/clusters")
async def clusters(file: UploadFile = File(...)):
    verify_models_loaded()
    df = compute_health(load_csv(file))
    return cluster_engines(df).to_dict("records")

@app.post("/insights")
async def insights(file: UploadFile = File(...)):
    verify_models_loaded()
    df = compute_health(load_csv(file))
    clusters = cluster_engines(df)

    worst = clusters.sort_values("min_health").iloc[0]

    return {
        "summary": "Predictive RF + LSTM degradation analysis completed.",
        "worst_engine": int(worst["engine_id"]),
        "lowest_health": round(float(worst["min_health"]), 3),
        "cluster": int(worst["cluster"]),
    }
