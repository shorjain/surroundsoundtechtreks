"""Turn a phone-ranging training run into results.json + audio/*.wav for the Model testing tab.

    python model-testing/build_report.py ../phone-ranging/runs/v2-recolor

The model finds our chirp ("beep") in 0.35 s of microphone audio. It is scored against the
old hand-written rules on the same windows. A pick counts if it is within 2 frames (1/3 ms)
of the true onset, or if it correctly says "no beep".
"""
import base64
import json
import os
import sys

run = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
load = lambda name: json.load(open(os.path.join(run, name), encoding="utf8"))
pct = lambda x: round(100 * x, 1)
ms = lambda frame: None if frame < 0 else round(frame * 8 / 48, 1)  # 8 samples per frame at 48 kHz
right = lambda pick, truth: abs(pick - truth) <= 2 if truth >= 0 else pick < 0

# Headline numbers and breakdowns from the last validation (3,000 fixed windows).
val = json.loads(open(os.path.join(run, "val.jsonl"), encoding="utf8").read().splitlines()[-1])
summary = [
    {"label": "Overall (3,000 windows)", "model": pct(val["acc"]), "rules": pct(val["rules_acc"])},
    {"label": "Beep found", "model": pct(val["recall"]), "rules": pct(val["rules_recall"])},
    {"label": "False beep (lower is better)", "model": pct(val["false_beep"]), "rules": pct(val["rules_false_beep"])},
    {"label": "Real phone recordings, held out (18 windows)", "model": pct(val["real"]), "rules": None},
]
groups = [{"title": f"By {key[3:].replace('_', ' ')}", "rows": [
    {"label": label, "n": row["n"], "model": pct(row["model"]), "rules": pct(row["rules"])} for label, row in val[key].items()]}
    for key in ("by_snr", "by_environment", "by_impostor")]

# Edge-case suites: each varies one hard condition.
static, latest = load("probes_static.json"), load("probes_latest.json")
suites = {}
for tag, ok, rules_ok in zip(static["tags"], latest["ok"], static["rules_ok"]):
    s = suites.setdefault((tag["suite"], tag["case"]), [0, 0, 0])
    s[0], s[1], s[2] = s[0] + 1, s[1] + ok, s[2] + rules_ok
groups.append({"title": "Edge-case suites (beep = must find it, alone = must stay quiet)",
               "notes": [f"{suite}: {text}" for suite, text in static["help"].items()], "rows": [
    {"label": f"{suite}, {case}", "n": n, "model": pct(ok / n), "rules": pct(r / n)}
    for (suite, case), (n, ok, r) in suites.items()]})

# Example windows with their audio.
os.makedirs(os.path.join(here, "audio"), exist_ok=True)
picks = {e["index"]: e for e in load("examples.json")["examples"]}
cases = []
for i, e in enumerate(load("examples_static.json"), 1):
    open(os.path.join(here, "audio", f"case-{i:02}.wav"), "wb").write(base64.b64decode(e["view"]["wav"]))
    model = picks[e["index"]]["pred_frame"]
    m = e["meta"]
    cases.append({"audio": f"case-{i:02}.wav", "snrDb": e["snr_db"], "beep": m["kind"], "environment": m["environment"],
                  "distanceM": m.get("distance_m"), "impostors": m["impostor_kinds"], "faults": m["faults"],
                  "truthMs": ms(e["onset_frame"]), "modelMs": ms(model), "rulesMs": ms(e["rules_frame"]),
                  "modelRight": right(model, e["onset_frame"]), "rulesRight": right(e["rules_frame"], e["onset_frame"])})

config = load("config.json")
report = {"run": config["name"], "step": val["step"], "parameters": config["parameters"],
          "summary": summary, "groups": groups, "cases": cases}
json.dump(report, open(os.path.join(here, "results.json"), "w", encoding="utf8"), indent=1)
print(f"{len(cases)} cases, {len(groups)} tables -> {here}")
