#!/usr/bin/env python3
"""One-command, full-roster API-Football matching. Never edits scouting_players."""
import json, os, sys, time, urllib.error, urllib.request

BASE = os.environ.get("TEAM_LINK_URL", "https://dispfics.vercel.app/api/cron/team-link")
SECRET = os.environ.get("CRON_SECRET")
if not SECRET:
    sys.exit("Set CRON_SECRET in your environment first (do not commit or share it).")
TOTAL = 17849
STEP = 100
REPORT = "team-link-scan-results.jsonl"
print(f"Scanning {TOTAL} players via API-Football. Progress saved to {REPORT}.", flush=True)
completed = set()
if os.path.exists(REPORT):
    with open(REPORT, encoding="utf-8") as f:
        for line in f:
            try:
                item = json.loads(line)
                if item.get("finished"):
                    completed.add(item["offset"])
            except (ValueError, KeyError):
                pass
for offset in range(0, TOTAL, STEP):
    if offset in completed:
        continue
    url = f"{BASE}?offset={offset}&limit={min(STEP,TOTAL-offset)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {SECRET}"})
    try:
        with urllib.request.urlopen(req, timeout=110) as response:
            result = json.load(response)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        print(f"Stopped at offset {offset}: {error}. Re-run to resume.", file=sys.stderr)
        sys.exit(1)
    if result.get("apiErrors", 0):
        print(f"API errors at offset {offset}; stopping to avoid exhausting quota. {result}", file=sys.stderr)
        sys.exit(2)
    # A window can end early on the server's time budget; do not mark it done
    # unless the endpoint confirms the entire window was processed.
    checked = result.get("checked", 0)
    if checked < min(STEP,TOTAL-offset):
        print(f"Incomplete window at {offset} (checked={checked}); retry after checking API quota. {result}", file=sys.stderr)
        sys.exit(3)
    result.update({"offset": offset, "finished": True})
    with open(REPORT, "a", encoding="utf-8") as f:
        f.write(json.dumps(result, ensure_ascii=False) + "\n")
    print(f"{min(offset+STEP,TOTAL)}/{TOTAL} processed, new matches={result.get('linked',0)}", flush=True)
    time.sleep(1)
print("All windows checked. Review matches before updating club/league.")
