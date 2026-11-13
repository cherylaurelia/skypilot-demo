#!/usr/bin/env bash
# Usage: SKY=<sky> clockstep.sh <name> <step_seconds|0>
# Launches the drill job, waits until RUNNING at checkpoint step >= 5, then steps the Colima VM
# wall clock by <step_seconds> (0 = control, no step) and records what the job does next.
set -u
NAME=$1; STEP=$2; export RUN_ID=$NAME
log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*"; }
"$SKY" jobs launch -y -d -n "$NAME" --env RUN_ID="$NAME" --env STEPS="${STEPS:-60}" train.yaml > "runs/$NAME.launch.log" 2>&1
JID=$("$SKY" jobs queue 2>/dev/null | awk -v n="$NAME" '$3==n {print $1}' | head -1)
log "job id $JID, clock step ${STEP}s"
st() { "$SKY" jobs queue 2>/dev/null | awk -v id="$JID" '$1==id' | grep -oE 'PENDING|STARTING|RUNNING|RECOVERING|SUCCEEDED|FAILED[A-Z_]*|CANCELLING|CANCELLED' | head -1; }
pod() { kubectl get pods --no-headers 2>/dev/null | awk -v n="${NAME}-" 'index($1,n)==1 {print $1}' | head -1; }
while :; do
  s=$(st); p=$(pod)
  c=$([ -n "$p" ] && kubectl exec "$p" -- cat "/checkpoint/$NAME.json" 2>/dev/null | sed 's/[^0-9]//g')
  [ "$s" = RUNNING ] && [ -n "$c" ] && [ "$c" -ge 5 ] && break
  case "$s" in SUCCEEDED|FAILED*|CANCELLED) log "ended before step: $s"; exit 1;; esac
  sleep 2
done
log "RUNNING at checkpoint step $c; btime before: $(kubectl exec "$p" -- grep btime /proc/stat)"
if [ "$STEP" != 0 ]; then
  colima ssh -- sudo date -s "@$(( $(colima ssh -- date +%s) + STEP ))" >/dev/null
  log "stepped VM clock by ${STEP}s; btime after: $(kubectl exec "$p" -- grep btime /proc/stat)"
fi
last=""
while :; do
  s=$(st); p=$(pod)
  [ "$s/$p" != "$last" ] && log "job=$s pod=${p:-none}" && last="$s/$p"
  case "$s" in SUCCEEDED|FAILED*|CANCELLED) break;; esac
  sleep 3
done
log "end btime: $(colima ssh -- grep btime /proc/stat)"
"$SKY" jobs queue 2>/dev/null | awk -v id="$JID" 'NR==1 || $1=="ID" || $1==id'
"$SKY" jobs logs --controller "$JID" --no-follow > "runs/$NAME.controller.log" 2>&1
grep -nE "Controller process|dead|FAILED_CONTROLLER|cleaned up" "runs/$NAME.controller.log" | head -5
