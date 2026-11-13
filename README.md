# SkyPilot: a wall clock step fails every running managed job

Unofficial demo by Cheryl Aurelia: not affiliated with SkyPilot.

## The problem

`controller_process_alive` in `sky/jobs/utils.py` treats the jobs controller as dead when
`psutil.Process(pid).create_time() != record.started_at`. On Linux, psutil computes `create_time()`
as ticks since boot plus `btime` from `/proc/stat`, and since psutil 7.1.0 it reads `btime` on every
call ([psutil#2544](https://github.com/giampaolo/psutil/pull/2544)). `btime` moves when the wall
clock is stepped, so after a step a live controller fails the check. The skylet then sets every job
on that controller to `FAILED_CONTROLLER`, tears down the job clusters, and starts a second
controller.

Related prior art: psutil's own pid-reuse check switched to `create_time(monotonic=True)` after
the same bug ([psutil#1724](https://github.com/giampaolo/psutil/issues/1724)); Patroni hit it after
an NTP correction ([patroni#811](https://github.com/patroni/patroni/issues/811)); SkyPilot's
`sky/server/metrics.py` `_process_identity` already avoids `create_time()` for this reason.

## What the page shows

A controlled repro on local Kubernetes (`sky local up`, kind on Colima), SkyPilot nightly
1.0.0.dev20261112:

- 3 runs with a +60 s clock step on the node: 3 FAILED_CONTROLLER, while the controller process kept running.
- 3 no-step controls: 3 SUCCEEDED.
- The same step runs with the patch on the controller (see `data/after.json`).

Every number on the page is read from `data/before.json` and `data/after.json`, which
`drill/to_page.py` generates from the raw logs in `drill/runs/`.

## Run the repro yourself

Needs Docker (Colima here), `kubectl`, and SkyPilot with the Kubernetes extra.

```bash
pip install "skypilot-nightly[kubernetes]"
sky local up
sky volumes apply drill/volume.yaml
cd drill
# The Colima guest agent resyncs the clock within seconds; batch.sh stops it during runs
# so a step stays, as an NTP correction or a VM resume would.
SKY=$(which sky) PREFIX=b3 ./batch.sh
python3 summarize.py b3
```

Each run is a 140 × 3 s checkpointing job. The skylet checks controller liveness every 300 s, so a
stepped run fails at the first check after the step.

## Run the page

```bash
npm install
npm run build && npm run start
```

## The patch

Branch `fix/controller-alive-clock-step` on
[cherylaurelia/skypilot](https://github.com/cherylaurelia/skypilot/tree/fix/controller-alive-clock-step):
accept a `create_time()` that differs from `started_at` by a whole number of seconds only when the
process cmdline is still `sky.jobs.controller`; otherwise keep the exact match. No schema change.
