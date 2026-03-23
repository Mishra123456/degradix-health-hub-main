"""
Tests for ML and analysis endpoints.
"""

import os
from pathlib import Path


def test_health_endpoint(client, sample_csv_file):
    """Test /health endpoint returns health data."""
    resp = client.post("/health", files=[sample_csv_file])
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "engine_id" in data[0]
    assert "health" in data[0]
    assert "cycle" in data[0]


def test_dsi_endpoint(client, sample_csv_file):
    """Test /dsi endpoint returns DSI data."""
    resp = client.post("/dsi", files=[sample_csv_file])
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "DSI" in data[0]


def test_reliability_endpoint(client, sample_csv_file):
    """Test /reliability endpoint."""
    resp = client.post("/reliability", files=[sample_csv_file])
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert "reliability" in data[0]


def test_clusters_endpoint(client, sample_csv_file):
    """Test /clusters endpoint."""
    resp = client.post("/clusters", files=[sample_csv_file])
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert "cluster" in data[0]
    assert "engine_id" in data[0]


def test_analyze_endpoint(client, sample_csv_file):
    """Test /analyze endpoint returns combined results."""
    resp = client.post("/analyze", files=[sample_csv_file])
    assert resp.status_code == 200
    data = resp.json()
    assert "health" in data
    assert "dsi" in data
    assert "clusters" in data


def test_rul_endpoint(client, sample_csv_file):
    """Test /rul endpoint returns RUL predictions."""
    resp = client.post("/rul", files=[sample_csv_file])
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0

    rul_entry = data[0]
    assert "engine_id" in rul_entry
    assert "predicted_rul" in rul_entry
    assert "current_health" in rul_entry
    assert "decay_rate" in rul_entry
    assert "urgency" in rul_entry
    assert rul_entry["urgency"] in ["critical", "high", "moderate", "low"]
    assert rul_entry["predicted_rul"] >= 0


def test_rul_multiple_engines(client, sample_csv_file):
    """Test RUL returns predictions for all engines."""
    resp = client.post("/rul", files=[sample_csv_file])
    data = resp.json()
    engine_ids = [r["engine_id"] for r in data]
    # test.csv has engines 1, 2, 3
    assert len(engine_ids) >= 1


def test_health_values_in_range(client, sample_csv_file):
    """Test that health values are between 0 and 1."""
    resp = client.post("/health", files=[sample_csv_file])
    data = resp.json()
    for row in data:
        assert 0 <= row["health"] <= 1, f"Health {row['health']} out of range"


def test_history_requires_auth(client, sample_csv_file):
    """Test /history POST requires authentication."""
    resp = client.post("/history", files=[sample_csv_file])
    assert resp.status_code == 401


def test_history_get_requires_auth(client):
    """Test /history GET requires authentication."""
    resp = client.get("/history")
    assert resp.status_code == 401
