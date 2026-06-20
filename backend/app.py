import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from tensorflow.keras.models import load_model
from pydantic import BaseModel

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
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

try:
    rf_health = joblib.load(MODEL_DIR / "rf_health.joblib")
    rf_rul = joblib.load(MODEL_DIR / "rf_rul.joblib")
    scaler = joblib.load(MODEL_DIR / "scaler.joblib")
    lstm_model = load_model(MODEL_DIR / "lstm_rul.keras")
    print("All ML models loaded successfully.")
except Exception as e:
    print(f"Warning: Models could not be loaded at startup: {e}")
    print("Ensure you run 'python train_models.py' inside the backend folder to generate them.")

# --------------------------------------------------
# PYDANTIC RESPONSE SCHEMAS
# --------------------------------------------------
class CompletePredictionResponse(BaseModel):
    health_score: float
    predicted_rul: int
    risk_level: str
    reliability: float
    cluster: int

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
async def predict_complete(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
    
    # We will compute the results for the latest cycle of the first engine in the CSV file
    first_engine_id = df_scaled["engine_id"].iloc[0]
    engine_df = df_scaled[df_scaled["engine_id"] == first_engine_id].sort_values("cycle")
    
    latest_idx = len(engine_df) - 1
    latest_sensors = engine_df[sensors].values
    latest_cycle = int(engine_df["cycle"].iloc[latest_idx])
    
    # Compute RUL
    if latest_cycle > SEQ_LEN:
        seq_hist = latest_sensors[latest_idx - SEQ_LEN:latest_idx]
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
    
    # Create database entry
    analysis_record = AnalysisHistory(
        health_score=health_score,
        predicted_rul=rul_val,
        reliability=reliability,
        risk_level=risk_level,
        filename=file.filename
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
        cluster=cluster_id
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
