# Calibration research
This workspace is reserved for future PyTorch experiments. It is not required to run the web app.

Use a separate environment from the backend:
```sh
cd ml
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Keep experiment code in src/, exploration in notebooks/, recordings in data/, and model weights in checkpoints/.
Data and weights are ignored by Git. Agree on shared storage and recording consent before collecting data.

First prove multi-device playback synchronization. Then evaluate chirp detection, hardware latency,
pairwise distance estimates, and 2D reconstruction. No trained model or calibration implementation is included.
