# Recovery of the redesigned production UI (2026-11-07)

Evidence: the user screenshot showed the previous blue/sage interface. A fresh request to www.regaplatform.com/build-info.json returned e5c568e-mw5o20wc, and HTML still used theme #4F7F95. This was a server release regression, not evidence of a device-cache problem.

GitHub run 42277837507 was originally created on 2026-11-06 for commit e5c568e47b38b601b205348380bf4b4defa6667a. Its deployment job was rerun on 2026-11-07 at 00:29:07 UTC and completed at 00:30:15 UTC, after successful redesign deployment run 42310493054. A healthy old application passed the previous smoke test because it checked content mode and behavior but not release identity.

Fix: new deployment runs verify that GITHUB_SHA equals current remote main after checkout and immediately before upload. The live smoke test requires the exact build ID of the artifact produced in that workflow. Regression tests reject the superseded commit and reject an otherwise healthy production build with a different ID. Home screenshots are now included in smoke artifacts.

Limit: GitHub reruns use the workflow definition from the original commit. Historical runs created before this guard still lack it; do not rerun those runs. Start a fresh deploy.yml workflow_dispatch from current main. The existing explicit rollback step remains unchanged for real smoke failures. No old runs, data or branch protections were deleted or bypassed.

The latest main also includes the separately merged /dr control center; recovery builds from current main and preserves it. No redesign is rebuilt and no domain, payment or database activation is introduced.

## No republishing of the live release (2026-11-07)

`build-info.json` now carries the full `commit`. A `guard` job runs before CI: it rejects anything but the newest
`main` and reads the live `build-info.json`. If production already serves that exact commit (full `commit`, or the
short-SHA prefix of `buildId` for older builds), the run ends as **ALREADY_LIVE**: no CI, no build, no upload. The same
check repeats immediately before upload. After upload the smoke test requires both the exact build ID and the commit.
An unreachable or unidentifiable live build never blocks deploying the newest main.
