import before from "../data/before.json";
import after from "../data/after.json";

const REPO = "https://github.com/skypilot-org/skypilot";

const BRANCH =
  "https://github.com/skypilot-org/skypilot/compare/master...cherylaurelia:skypilot:fix/controller-alive-clock-step";

const DEMO_REPO = "https://github.com/cherylaurelia/skypilot-demo";

type Run = (typeof before.runs)[number];

function outcome(run: Run): string {
  return run.final ?? "unknown";
}

function stepLabel(run: Run): string {
  return run.step_s === 0 ? "none (control)" : `+${run.step_s} s`;
}

function failedAt(run: Run): string {
  const end = run.events.find((e) => e.job !== "RUNNING");

  return end ? end.t : "";
}

function RunTable({ runs, caption }: { runs: Run[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="px-4 pt-3 text-left text-xs text-muted">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2 font-medium">Run</th>
            <th className="px-4 py-2 font-medium">Clock step</th>
            <th className="px-4 py-2 font-medium">Stepped at (UTC)</th>
            <th className="px-4 py-2 font-medium">Ended (UTC)</th>
            <th className="px-4 py-2 font-medium">Final status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px]">
          {runs.map((run) => {
            const failed = outcome(run) !== "SUCCEEDED";

            return (
              <tr key={run.run} className="border-b border-line last:border-0">
                <td className="px-4 py-2">{run.run}</td>
                <td className="px-4 py-2">{stepLabel(run)}</td>
                <td className="px-4 py-2">{run.stepped_at ?? "–"}</td>
                <td className="px-4 py-2">{failedAt(run)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 ${failed ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"}`}
                  >
                    {outcome(run)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function byStart(runs: Run[]): Run[] {
  return runs.toSorted((a, b) => (a.events[0]?.t ?? "").localeCompare(b.events[0]?.t ?? ""));
}

function count(runs: Run[], step: boolean, status: string): string {
  const group = runs.filter((r) => (r.step_s !== 0) === step);

  return `${group.filter((r) => r.final === status).length} of ${group.length}`;
}

const CURRENT = `# sky/jobs/utils.py, controller_process_alive()
process = psutil.Process(record.pid)
if record.started_at is not None:
    if process.create_time() != record.started_at:
        return False   # -> job marked FAILED_CONTROLLER, cluster torn down`;

const PATCH = `+def _same_start_time(process, started_at: float) -> bool:
+    create_time = process.create_time()
+    if create_time == started_at:
+        return True
+    shift = create_time - started_at
+    if abs(shift - round(shift)) > 1e-3:   # same clock tick since boot?
+        return False
+    cmd_str = ' '.join(process.cmdline())  # and still the controller?
+    return ('-m sky.jobs.controller' in cmd_str or
+            '-msky.jobs.controller' in cmd_str)
 ...
-            if process.create_time() != record.started_at:
+            if not _same_start_time(process, record.started_at):`;

export default function Page() {
  const beforeRuns = byStart(before.runs);
  const afterRuns = byStart(after.runs);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-blue">
        SkyPilot managed jobs · bug report with a patch
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
        A wall clock step on the jobs controller fails every managed job running on it.
      </h1>
      <p className="mt-4 text-lg text-muted">
        <code className="font-mono text-base">controller_process_alive</code> compares psutil&apos;s
        epoch <code className="font-mono text-base">create_time()</code> with the stored start time
        by exact equality. On Linux that value moves when the clock is stepped, so a live controller
        looks dead. The patch accepts a whole-second shift only when the process is still a jobs
        controller started on the same clock tick: 22 added lines in one file, no schema change.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={BRANCH}
          className="rounded-md bg-carbon px-4 py-2 text-sm font-medium text-white hover:bg-black"
        >
          See the patch (fork branch)
        </a>
        <a
          href={REPO}
          className="rounded-md border border-carbon px-4 py-2 text-sm font-medium hover:bg-white"
        >
          skypilot-org/skypilot
        </a>
      </div>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">No step (control)</p>
          <p className="mt-2 text-2xl font-semibold text-ok">
            {count(beforeRuns, false, "SUCCEEDED")}
          </p>
          <p className="text-sm text-muted">jobs SUCCEEDED</p>
        </div>
        <div className="rounded-lg border border-danger-soft bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">+60 s step, nightly</p>
          <p className="mt-2 text-2xl font-semibold text-danger">
            {count(beforeRuns, true, "FAILED_CONTROLLER")}
          </p>
          <p className="text-sm text-muted">jobs FAILED_CONTROLLER, controller still alive</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">+60 s step, patched</p>
          <p className="mt-2 text-2xl font-semibold text-ok">{count(afterRuns, true, "SUCCEEDED")}</p>
          <p className="text-sm text-muted">jobs SUCCEEDED</p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Before: nightly {before.version}</h2>
        <p className="mt-2 text-muted">
          Controls and steps alternate on the same jobs controller. The clock goes back to the
          original boot time after every step run, before the next run starts.
        </p>
        <div className="mt-4">
          <RunTable runs={beforeRuns} caption="Every row is generated from drill/runs/*.clockstep.log" />
        </div>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-carbon p-4 font-mono text-[13px] leading-relaxed text-white">
          {before.evidence.join("\n")}
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">After: same nightly with the patch on the controller</h2>
        <div className="mt-4">
          <RunTable runs={afterRuns} caption="Same script and step; controller relaunched from the patched source" />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Why it happens</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-carbon p-4 font-mono text-[13px] leading-relaxed text-white">
          {CURRENT}
        </pre>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
          <li>
            On Linux, psutil returns ticks since boot plus <code className="font-mono">btime</code>{" "}
            from <code className="font-mono">/proc/stat</code>. Since psutil 7.1.0 it reads btime on
            every call (
            <a className="text-blue underline" href="https://github.com/giampaolo/psutil/pull/2544">
              psutil#2544
            </a>
            ), so a clock step shifts <code className="font-mono">create_time()</code> by whole
            seconds for the same process.
          </li>
          <li>
            One <code className="font-mono">sky.jobs.controller</code> process serves many jobs, so
            the skylet check (every 300 s) fails all of them at once and starts a second controller.
          </li>
          <li>
            SkyPilot already avoids this in{" "}
            <code className="font-mono">sky/server/metrics.py</code> (
            <code className="font-mono">_process_identity</code>), and psutil&apos;s own pid-reuse
            check moved to <code className="font-mono">create_time(monotonic=True)</code> after the
            same bug (
            <a className="text-blue underline" href="https://github.com/giampaolo/psutil/issues/1724">
              psutil#1724
            </a>
            ).
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Where clocks step outside a laptop</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
          <li>
            chrony&apos;s default <code className="font-mono">makestep 1 3</code> steps the clock
            during the first updates after boot, which can land after a new controller VM has
            started its controller.
          </li>
          <li>
            VM suspend/resume and live migration (
            <a className="text-blue underline" href="https://bugzilla.redhat.com/show_bug.cgi?id=1780165">
              RHBZ#1780165
            </a>
            ). Patroni hit the same start-time comparison after an NTP correction (
            <a className="text-blue underline" href="https://github.com/patroni/patroni/issues/811">
              patroni#811
            </a>
            ).
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">The patch</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed">
          {PATCH}
        </pre>
        <p className="mt-3 text-muted">
          Unit tests shift the clock by +190 s and −3600 s (fail on master, pass with the patch),
          check that a reused pid with another cmdline is still treated as dead, and shift
          psutil&apos;s real Linux <code className="font-mono">boot_time</code> for a live process.
          Existing <code className="font-mono">started_at</code> rows keep working.
        </p>
      </section>

      <section className="mt-12 rounded-lg border border-line bg-surface p-5 text-sm text-muted">
        <h2 className="text-base font-semibold text-carbon">How this was measured</h2>
        <p className="mt-2">
          Local Kubernetes from <code className="font-mono">sky local up</code> (kind on Colima)
          and a checkpointing job of 140 × 3 s. Once the job is RUNNING, the script steps
          the VM clock with <code className="font-mono">date -s</code>. Colima&apos;s guest agent
          normally puts the clock back within seconds, so it is stopped during runs to keep the
          step, the way a real NTP correction or a VM resume stays. Scripts and raw logs are in the{" "}
          <a className="text-blue underline" href={DEMO_REPO}>
            demo repo
          </a>
          . The skylet check runs every 300 s, so the job fails at the first check after the step.
          pmset logged no Sleep or Wake during the counted runs. One patched run, during which the
          Mac went to sleep, is excluded and kept under drill/runs/excluded.
        </p>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-sm text-muted">
        Unofficial demo by Cheryl Aurelia: not affiliated with SkyPilot.
      </footer>
    </main>
  );
}
