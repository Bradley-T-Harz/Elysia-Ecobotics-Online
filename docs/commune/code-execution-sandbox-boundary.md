# Code Execution Sandbox Boundary

The public website does not execute code.

Future execution requires isolated sandbox workers, resource limits, network controls, filesystem isolation, logging, kill controls, and explicit user/admin approval.

No shell, package install, package hooks, dependency execution, repository clone, local Elysia access, private vault access, credential access, or host mounts should be available by default.

Local Elysia remains the final authority for local tools and installs.
