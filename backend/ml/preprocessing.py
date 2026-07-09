import pandas as pd
import numpy as np
from typing import List, Tuple

def load_cmapss_data(file_path: str) -> pd.DataFrame:
    """
    Loads the NASA C-MAPSS FD001 dataset and assigns appropriate column names.
    
    Args:
        file_path: Path to the dataset file (space-separated text file).
        
    Returns:
        pd.DataFrame: Loaded and structured DataFrame.
    """
    df = pd.read_csv(file_path, sep=" ", header=None)
    df = df.dropna(axis=1)
    
    df.columns = (
        ["engine_id", "cycle"] +
        [f"op_{i}" for i in range(1, 4)] +
        [f"sensor_{i}" for i in range(1, 22)]
    )
    return df

def generate_rul_and_health(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generates Remaining Useful Life (RUL) and Health Score labels.
    
    Formula:
        RUL = max_cycle - current_cycle, clipped to a maximum of 125.
        health = 1 - (cycle / max_cycle).
        
    Args:
        df: Input DataFrame containing engine_id and cycle.
        
    Returns:
        pd.DataFrame: DataFrame with added RUL and health columns.
    """
    # Calculate max cycle for each engine_id
    max_cycles = df.groupby("engine_id")["cycle"].transform("max")
    
    # Create RUL column
    df["RUL"] = max_cycles - df["cycle"]
    df["RUL"] = df["RUL"].clip(upper=125)
    
    # Create health score column
    df["health"] = 1 - (df["cycle"] / max_cycles)
    
    return df

def generate_lstm_sequences(
    df: pd.DataFrame, 
    sensor_cols: List[str], 
    seq_len: int = 20
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generates rolling window sequences for LSTM training.
    
    Args:
        df: Preprocessed DataFrame containing sensor columns and RUL labels.
        sensor_cols: List of sensor columns to use.
        seq_len: The length of the rolling window sequences.
        
    Returns:
        Tuple[np.ndarray, np.ndarray]: X_seq of shape (N, SEQ_LEN, num_sensors) and y_seq of shape (N,).
    """
    sequences = []
    targets = []
    
    for _, group in df.groupby("engine_id"):
        # Sort by cycle to ensure temporal order
        group = group.sort_values("cycle")
        sensors = group[sensor_cols].values
        ruls = group["RUL"].values
        
        for i in range(len(group) - seq_len):
            sequences.append(sensors[i : i + seq_len])
            targets.append(ruls[i + seq_len])
            
    return np.array(sequences), np.array(targets)
