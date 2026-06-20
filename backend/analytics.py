import numpy as np
from typing import List, Optional, Dict, Any

def calculate_health_score(sensors_scaled: np.ndarray, rf_health_model: Any) -> float:
    """
    Calculates the machine health score using the RandomForest health model.
    
    Args:
        sensors_scaled: 2D numpy array of shape (N, 21) representing scaled sensor values.
        rf_health_model: Pre-trained RandomForestRegressor model for health score.
        
    Returns:
        float: Calculated health score between 0.0 and 1.0.
    """
    # Predict for the last cycle in the input data
    last_row = sensors_scaled[-1].reshape(1, -1)
    health = float(rf_health_model.predict(last_row)[0])
    return max(0.0, min(1.0, health))

def calculate_rul(
    sensors_scaled: np.ndarray,
    rf_rul_model: Any,
    lstm_rul_model: Optional[Any] = None,
    sequence_history: Optional[np.ndarray] = None
) -> int:
    """
    Calculates Remaining Useful Life (RUL) using the LSTM model if sufficient sequence
    history is available, falling back to the RandomForest RUL model otherwise.
    
    Args:
        sensors_scaled: 2D numpy array of shape (N, 21) representing scaled sensor values.
        rf_rul_model: Pre-trained RandomForestRegressor model for RUL.
        lstm_rul_model: Pre-trained LSTM Keras model for RUL.
        sequence_history: 2D numpy array of shape (SEQ_LEN, 21) representing scaled sequence history.
        
    Returns:
        int: Predicted Remaining Useful Life in cycles.
    """
    if lstm_rul_model is not None and sequence_history is not None and len(sequence_history) == 20:
        # Reshape to (1, SEQ_LEN, num_sensors)
        lstm_input = sequence_history.reshape(1, 20, -1)
        pred_rul = float(lstm_rul_model.predict(lstm_input, verbose=0).flatten()[0])
    else:
        # Fall back to RF RUL model using the latest cycle sensor row
        last_row = sensors_scaled[-1].reshape(1, -1)
        pred_rul = float(rf_rul_model.predict(last_row)[0])
        
    return max(0, int(round(pred_rul)))

def calculate_reliability(health_score: float, lam: float = 2.0) -> float:
    """
    Calculates the probabilistic reliability (probability of survival).
    
    Formula:
        reliability = exp(-lam * (1 - health_score)) * 100
        
    Args:
        health_score: Machine health score (0.0 to 1.0).
        lam: Degradation rate constant.
        
    Returns:
        float: Reliability percentage between 0.0 and 100.0.
    """
    reliability = float(np.exp(-lam * (1.0 - health_score)) * 100.0)
    return max(0.0, min(100.0, round(reliability, 1)))

def calculate_risk_level(rul: float) -> str:
    """
    Classifies the maintenance risk level based on the predicted RUL.
    
    Risk logic:
        RUL > 80: LOW
        RUL 30–80: MEDIUM
        RUL < 30: HIGH
        
    Args:
        rul: Predicted Remaining Useful Life in cycles.
        
    Returns:
        str: Risk level ("LOW", "MEDIUM", "HIGH").
    """
    if rul > 80:
        return "LOW"
    elif rul >= 30:
        return "MEDIUM"
    else:
        return "HIGH"

def calculate_degradation_speed(health_history: List[float]) -> float:
    """
    Calculates the degradation speed based on health score changes over cycles.
    
    Args:
        health_history: List of historical health scores.
        
    Returns:
        float: Average health drop rate (DSI). Positive value indicates degradation.
    """
    if len(health_history) < 2:
        return 0.0
    diffs = np.diff(health_history)
    return float(-np.mean(diffs))

def get_complete_analytics(
    sensors_scaled: np.ndarray,
    rf_health_model: Any,
    rf_rul_model: Any,
    lstm_rul_model: Optional[Any] = None,
    sequence_history: Optional[np.ndarray] = None,
    health_history: Optional[List[float]] = None,
    cluster_id: int = 1
) -> Dict[str, Any]:
    """
    Executes the complete predictive analytics suite and returns a structured JSON-like dict.
    
    Args:
        sensors_scaled: 2D numpy array of shape (N, 21) representing scaled sensor values.
        rf_health_model: Pre-trained RandomForestRegressor model for health score.
        rf_rul_model: Pre-trained RandomForestRegressor model for RUL.
        lstm_rul_model: Pre-trained LSTM Keras model for RUL.
        sequence_history: 2D numpy array of shape (SEQ_LEN, 21) representing scaled sequence history.
        health_history: List of historical health scores.
        cluster_id: Assigned machine cluster ID.
        
    Returns:
        Dict[str, Any]: Structured JSON data with all prediction metrics.
    """
    health_score = calculate_health_score(sensors_scaled, rf_health_model)
    predicted_rul = calculate_rul(sensors_scaled, rf_rul_model, lstm_rul_model, sequence_history)
    reliability = calculate_reliability(health_score)
    risk_level = calculate_risk_level(predicted_rul)
    
    return {
        "health_score": round(health_score, 4),
        "predicted_rul": predicted_rul,
        "risk_level": risk_level,
        "reliability": reliability,
        "cluster": cluster_id
    }
