# Coding Cornucopia Threat Model

## Primary Threats

- malicious code execution
- secret exfiltration
- attempts to access Supabase service-role keys
- attempts to access local Elysia memory/files/logs/vaults/credentials
- crypto mining or resource abuse
- fork bombs or process flooding
- infinite loops
- output flooding
- network scanning
- dependency supply-chain abuse
- filesystem probing
- social engineering through pasted code
- fake safe/trusted labels
- public users self-assigning trust
- DDoS through sandbox runs
- using the sandbox to attack third-party services

## Current Protections

- public snippets render as inert text
- CodeMirror editor does not execute code
- static secret/private-data diagnostics run before save/run paths
- sandbox endpoint is opt-in and fail-closed when not configured
- local runner uses Docker/Podman with `--network none`
- local runner uses non-root `65534:65534`
- local runner uses read-only root, cap-drop all, no-new-privileges
- local runner uses CPU, memory, pids, timeout, and output limits
- runner never pulls images automatically
- runner never falls back to host execution

## Required Production Controls

Before exposing the runner beyond localhost, Bradley/operator must configure:

- TLS and a reviewed public endpoint
- origin allowlist
- authentication or trusted backend proxy
- per-user and per-IP rate limits
- process supervision
- log retention policy
- abuse monitoring
- image update/rebuild workflow
- manual Supabase migration for run/diagnostic records if account-backed run history is needed

Shell, C/C++, native binaries, Docker-in-Docker, repo clone/run, package install, and arbitrary network access remain disabled unless a future policy pass explicitly enables them.
