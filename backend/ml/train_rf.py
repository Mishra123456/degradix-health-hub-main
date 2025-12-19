import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler

# Load NASA data
df = pd.read_csv("../data/train_FD001.txt", sep=" ", header=None)
df = df.dropna(axis=1)

df.columns = (
    ["engine_id", "cycle"] +
    [f"op_{i}" for i in range(1, 4)] +
    [f"sensor_{i}" for i in range(1, 22)]
)

sensor_cols = [c for c in df.columns if c.startswith("sensor")]

# Health proxy (monotonic degradation)
df["health"] = df.groupby("engine_id")["cycle"].transform(
    lambda x: 1 - x / x.max()
)

X = df[sensor_cols].values
y = df["health"].values

scaler = MinMaxScaler()
X_scaled = scaler.fit_transform(X)

rf = RandomForestRegressor(
    n_estimators=300,
    random_state=42,
    n_jobs=-1
)

rf.fit(X_scaled, y)

joblib.dump(rf, "rf_model.joblib")
joblib.dump(scaler, "scaler.joblib")

print("RF trained & saved")
