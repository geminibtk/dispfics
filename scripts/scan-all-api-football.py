#!/usr/bin/env python3
"""Resume-safe API-Football roster scan. Never edits scouting_players."""
import json, os, sys, time, urllib.error, urllib.request

BASE = os.environ.get("TEAM_LINK_URL", "https://dispfics.vercel.app/api/cron/team-link")
SECRET = os.environ.get("CRON_SECRET")
if not SECRET:
    sys.exit("Set CRON_SECRET in your environment first (do not commit or share it).")
TOTAL = 17849
STEP = 100
REPORT = "team-link-scan-results.jsonl"
cursor = 0
if os.path.exists(REPORT):
    with open(REPORT, encoding="utf-8") as f:
        for line in f:
            try:
                item = json.loads(line)
                cursor = max(cursor, int(item.get("nextCursor", 0)))
            except (ValueError, TypeError):
                pass
print(f"Scanning {TOTAL} players; resuming at {cursor}. Progress: {REPORT}.", flush=True)
while cursor < TOTAL:
    url = f"{BASE}?offset={cursor}&limit={min(STEP, TOTAL-cursor)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {SECRET}"})
    try:
        with urllib.request.urlopen(req, timeout=110) as response:
            result = json.load(response)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        sys.exit(f"Stopped at {cursor}: {error}. Re-run to resume.")
    if result.get("apiErrors", 0):
        sys.exit(f"API error at {cursor}; re-run later: {result}")
    processed = int(result.get("processed", 0))
    if processed <= 0:
        sys.exit(f"No progress at {cursor}; re-run later: {result}")
    next_cursor = cursor + processed
    result.update({"offset": cursor, "nextCursor": next_cursor})
    with open(REPORT, "a", encoding="utf-8") as f:
        f.write(json.dumps(result, ensure_ascii=False) + "\n")
    cursor = next_cursor
    print(f"{cursor}/{TOTAL} scanned, new links={result.get('linked',0)}, ambiguous={result.get('ambiguous',0)}", flush=True)
    if cursor < TOTAL:
        time.sleep(65)
print("All player records visited. Review matches before updating club/league.")
