import os
import sys
import joblib
import numpy as np
from pathlib import Path
from typing import List, Dict, Any

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR

rf_health = None
rf_rul = None
scaler = None
health_explainer = None
rul_explainer = None
shap_installed = False

# Try importing shap
try:
    import shap
    shap_installed = True
except ImportError:
    print("Warning: 'shap' library is not installed. TreeExplainer fallback mode will be used.")

def init_explainers():
    """
    Lazy initializes the Random Forest models, MinMaxScaler, and SHAP TreeExplainers.
    """
    global rf_health, rf_rul, scaler, health_explainer, rul_explainer
    
    # Check if models are already loaded
    if health_explainer is not None and rul_explainer is not None:
        return
        
    try:
        # Load RF models and scaler
        if rf_health is None:
            rf_health = joblib.load(MODEL_DIR / "rf_health.joblib")
        if rf_rul is None:
            rf_rul = joblib.load(MODEL_DIR / "rf_rul.joblib")
        if scaler is None:
            scaler = joblib.load(MODEL_DIR / "scaler.joblib")
            
        # Initialize SHAP TreeExplainers
        if shap_installed:
            # We initialize TreeExplainer. We can pass feature_perturbation="interventional" or default
            health_explainer = shap.TreeExplainer(rf_health)
            rul_explainer = shap.TreeExplainer(rf_rul)
            print("SHAP TreeExplainers initialized successfully.")
        else:
            print("SHAP is not installed. Explanations will use fallback feature importance estimation.")
    except Exception as e:
        print(f"Error loading models or initializing explainers in shap_engine: {e}")

def get_explanation(explainer, model, sensor_row: np.ndarray) -> List[Dict[str, Any]]:
    """
    Generates explanation for a given sensor row.
    
    Args:
        explainer: The SHAP TreeExplainer object.
        model: The trained RandomForestRegressor model (fallback).
        sensor_row: 2D numpy array of shape (1, 21) containing UNSCALED sensor values.
        
    Returns:
        List[Dict[str, Any]]: Top 5 features sorted by absolute contribution.
    """
    init_explainers()
    
    sensor_names = [f"sensor_{i}" for i in range(1, 22)]
    
    # 1. Ensure 2D shape (1, 21)
    if len(sensor_row.shape) == 1:
        sensor_row = sensor_row.reshape(1, -1)
        
    if sensor_row.shape[1] != 21:
        # Return dummy fallback if feature count is mismatched
        return [{"sensor": name, "impact": 0.0} for name in sensor_names[:5]]
        
    # 2. Scale the row (the models were trained on MinMaxScaler scaled inputs)
    try:
        if scaler is not None:
            X_scaled = scaler.transform(sensor_row)
        else:
            X_scaled = sensor_row
    except Exception as e:
        print(f"Scaling failed in shap_engine: {e}")
        X_scaled = sensor_row
        
    # 3. Generate SHAP values if SHAP is available
    if shap_installed and explainer is not None:
        try:
            # Calculate SHAP values
            shap_values = explainer.shap_values(X_scaled)
            
            # If shap_values is a list (e.g. for multi-output/classification), extract first element
            if isinstance(shap_values, list):
                shap_values = shap_values[0]
                
            # shap_values is of shape (N, 21). Extract first row: (21,)
            row_impacts = shap_values[0]
            
            explanations = []
            for i, val in enumerate(row_impacts):
                explanations.append({
                    "sensor": sensor_names[i],
                    "impact": round(float(val), 4)
                })
                
            # Sort by absolute impact descending
            explanations.sort(key=lambda x: abs(x["impact"]), reverse=True)
            return explanations[:5]
        except Exception as e:
            print(f"SHAP value generation failed: {e}. Falling back to baseline feature importances.")
            
    # 4. Fallback Mode: Estimate feature impact using model's global feature_importances_
    # and local directional deviation from a baseline median/mean.
    # This ensures the app is fully CPU-friendly and works even without the shap C-library compiling.
    try:
        if model is not None and hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            
            # Simple heuristic: impact = feature_importance * (feature_val - 0.5)
            # scaled to fit a reasonable contribution scale
            # Health model predictions range [0, 1] -> total sum of local impacts around 0.1-0.3
            # RUL model predictions range [0, 125] -> total sum of local impacts around 10-30 cycles
            is_health_model = (model == rf_health)
            scale_factor = 0.5 if is_health_model else 35.0
            
            explanations = []
            for i, imp in enumerate(importances):
                # Normalized relative deviation from mid-range (0.5)
                val_dev = X_scaled[0, i] - 0.5
                local_impact = float(imp * val_dev * scale_factor)
                explanations.append({
                    "sensor": sensor_names[i],
                    "impact": round(local_impact, 4)
                })
                
            explanations.sort(key=lambda x: abs(x["impact"]), reverse=True)
            return explanations[:5]
    except Exception as e:
        print(f"Fallback explanation calculation failed: {e}")
        
    # Return dummy/zero values as ultimate fail-safe
    return [{"sensor": name, "impact": 0.0} for name in sensor_names[:5]]

def get_health_explanation(sensor_row: np.ndarray) -> List[Dict[str, Any]]:
    """
    Computes top 5 local feature contributions for the Random Forest Health prediction.
    """
    init_explainers()
    return get_explanation(health_explainer, rf_health, sensor_row)

def get_rul_explanation(sensor_row: np.ndarray) -> List[Dict[str, Any]]:
    """
    Computes top 5 local feature contributions for the Random Forest RUL prediction.
    """
    init_explainers()
    return get_explanation(rul_explainer, rf_rul, sensor_row)
