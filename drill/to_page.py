"""Write web/data/{before,after}.json from run logs. Usage: python3 to_page.py <prefix> <before|after> <version-file> [evidence-file]"""
import json, subprocess, sys
prefix, which, version_file = sys.argv[1:4]
tmp = f"/tmp/{prefix}.json"
subprocess.run([sys.executable, "summarize.py", prefix, tmp], check=True, stdout=subprocess.DEVNULL)
data = json.load(open(tmp))
data["version"] = open(version_file).read().split("version")[-1].strip()
data["evidence"] = [l.rstrip() for l in open(sys.argv[4])] if len(sys.argv) > 4 else []
json.dump(data, open(f"../web/data/{which}.json", "w"), indent=1)
print(which, data["summary"], data["version"])
