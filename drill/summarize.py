"""Build the repro table from runs/<prefix>*.clockstep.log. Usage: python3 summarize.py b3 [out.json]"""
import glob, json, re, sys

prefix = sys.argv[1]
rows = []
for path in sorted(glob.glob(f"runs/{prefix}*.clockstep.log")):
    text = open(path).read()
    name = path.split("/")[-1].split(".")[0]
    step = int(re.search(r"clock step (-?\d+)s", text).group(1))
    events = re.findall(r"^(\d\d:\d\d:\d\d) job=(\S+) pod=(\S+)", text, re.M)
    final = re.search(r"^\s*\d+\s+-\s+" + re.escape(name) + r"\s.*?\s(\d+)\s+([A-Z_]+)\s", text, re.M)
    stepped = re.search(r"^(\d\d:\d\d:\d\d) stepped VM clock by \S+; btime after: btime (\d+)", text, re.M)
    before = re.search(r"^(\d\d:\d\d:\d\d) RUNNING at checkpoint step (\d+); btime before: btime (\d+)", text, re.M)
    end_bt = re.search(r"end btime: btime (\d+)", text)
    rows.append({
        "run": name, "step_s": step,
        "running_at": before.group(1) if before else None,
        "btime_before": int(before.group(3)) if before else None,
        "stepped_at": stepped.group(1) if stepped else None,
        "btime_after_step": int(stepped.group(2)) if stepped else None,
        "btime_end": int(end_bt.group(1)) if end_bt else None,
        "events": [{"t": t, "job": j, "pod": p} for t, j, p in events],
        "recoveries": int(final.group(1)) if final else None,
        "final": final.group(2) if final else None,
        "log": path,
    })
summary = {}
for r in rows:
    k = "step" if r["step_s"] else "control"
    s = summary.setdefault(k, {"runs": 0, "FAILED_CONTROLLER": 0, "SUCCEEDED": 0})
    s["runs"] += 1
    if r["final"] in s:
        s[r["final"]] += 1
out = {"prefix": prefix, "summary": summary, "runs": rows}
print(json.dumps(summary, indent=1))
for r in rows:
    print(r["run"], r["step_s"], r["final"], r["recoveries"], r["stepped_at"], [e["t"] + " " + e["job"] for e in r["events"]])
if len(sys.argv) > 2:
    json.dump(out, open(sys.argv[2], "w"), indent=1)
