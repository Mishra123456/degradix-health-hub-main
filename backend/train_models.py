import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from pathlib import Path

# ---------------- CONFIG ----------------
DATA_PATH = "data/train.csv"   # <-- your CSV here
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)

SEQ_LEN = 20
EPOCHS = 15

# ---------------- LOAD DATA ----------------
df = pd.read_csv(DATA_PATH)

sensor_cols = [c for c in df.columns if c.startswith("sensor")]
assert len(sensor_cols) > 0, "No sensor columns found!"

X = df[sensor_cols].values

# ---------------- SCALE ----------------
scaler = MinMaxScaler()
X_scaled = scaler.fit_transform(X)

# ---------------- RF TRAIN ----------------
# pseudo degradation target
y_rf = np.linspace(1, 0, len(X_scaled))

rf = RandomForestRegressor(
    n_estimators=200,
    random_state=42
)
rf.fit(X_scaled, y_rf)

# ---------------- LSTM TRAIN ----------------
health_rf = rf.predict(X_scaled)

X_seq, y_seq = [], []
for i in range(len(health_rf) - SEQ_LEN):
    X_seq.append(health_rf[i:i+SEQ_LEN])
    y_seq.append(health_rf[i+SEQ_LEN])

X_seq = np.array(X_seq).reshape(-1, SEQ_LEN, 1)
y_seq = np.array(y_seq)

lstm = Sequential([
    LSTM(64, input_shape=(SEQ_LEN, 1)),
    Dense(1)
])
lstm.compile(optimizer="adam", loss="mse")
lstm.fit(X_seq, y_seq, epochs=EPOCHS, batch_size=32)

# ---------------- SAVE ----------------
joblib.dump(rf, MODEL_DIR / "rf_health.pkl")
joblib.dump(scaler, MODEL_DIR / "scaler.pkl")
lstm.save(MODEL_DIR / "lstm_health.keras")

print("Training complete")
print("Saved models to /models")
print("Sensors used:", len(sensor_cols))
