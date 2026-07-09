import numpy as np
import pandas as pd
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.callbacks import EarlyStopping

SEQ_LEN = 20

df = pd.read_csv("../data/train_FD001.txt", sep=" ", header=None)
df = df.dropna(axis=1)

df.columns = (
    ["engine_id", "cycle"] +
    [f"op_{i}" for i in range(1, 4)] +
    [f"sensor_{i}" for i in range(1, 22)]
)

df["health"] = df.groupby("engine_id")["cycle"].transform(
    lambda x: 1 - x / x.max()
)

sequences = []
targets = []

for _, group in df.groupby("engine_id"):
    h = group["health"].values
    for i in range(len(h) - SEQ_LEN):
        sequences.append(h[i:i+SEQ_LEN])
        targets.append(h[i+SEQ_LEN])

X = np.array(sequences).reshape(-1, SEQ_LEN, 1)
y = np.array(targets)

model = Sequential([
    LSTM(64, input_shape=(SEQ_LEN, 1)),
    Dense(1)
])

model.compile(optimizer="adam", loss="mse")

model.fit(
    X, y,
    epochs=30,
    batch_size=64,
    validation_split=0.2,
    callbacks=[EarlyStopping(patience=5)],
    verbose=1
)

model.save("lstm_model.keras")
print("LSTM trained & saved")
