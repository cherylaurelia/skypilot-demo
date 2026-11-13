#!/usr/bin/env bash
# Controlled repro, persistent step: the VM's lima-guestagent (its SyncTime puts the clock back
# within seconds) and systemd-timesyncd are stopped for the whole batch so a
# step stays (like an NTP/chrony correction or a VM resume in production), and jobs run 140 x 3 s = 7 min so at least
# one 300 s skylet ManagedJobEvent check falls after the step. After each step run the clock is put
# back (lima-guestagent SyncTime) and btime is confirmed back at its original value before the next run.
cd "$(dirname "$0")"
export DOCKER_HOST=${DOCKER_HOST:-unix://$HOME/.colima/default/docker.sock}
export SKY=${SKY:-sky} STEPS=140
vm() { colima ssh -- "$@"; }
P=${PREFIX:-b3}
"$SKY" --version > runs/batch-$P.version 2>&1
vm sudo systemctl stop systemd-timesyncd lima-guestagent
BT0=$(vm grep btime /proc/stat); echo "batch btime: $BT0"
for r in ${RUNS:-ctl1:0 step1:60 ctl2:0 step2:60 ctl3:0 step3:60}; do
  n=$P$r; n=${n%%:*}; s=${r#*:}
  echo "=== $n step=$s $(date -u +%FT%TZ) $(pmset -g batt | head -1) $(vm grep btime /proc/stat)"
  ./clockstep.sh "$n" "$s" 2>&1 | tee "runs/$n.clockstep.log"
  if [ "$s" != 0 ]; then
    vm sudo systemctl start lima-guestagent
    for i in $(seq 60); do [ "$(vm grep btime /proc/stat)" = "$BT0" ] && break; sleep 5; done
    vm sudo systemctl stop lima-guestagent
    echo "restored: $(vm grep btime /proc/stat)"
  fi
done
vm sudo systemctl start lima-guestagent
vm sudo systemctl start systemd-timesyncd
echo "=== done $(date -u +%FT%TZ)"
pmset -g log | grep -E "^$(date +%Y-%m-%d).*(Sleep|DarkWake) " | tail -5
