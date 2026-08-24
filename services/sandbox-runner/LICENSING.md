# Sandbox runner licensing

The runner and its operator release bundle are private Website infrastructure,
not public Elysia or Codev source. `LICENSE` governs the first-party files.
`THIRD_PARTY_NOTICES.txt` and `LICENSES/` travel with every packaged runner and
record the separately licensed `yaml` runtime dependency and build/runtime
components. Runtime images are built locally from reviewed immutable base-image
digests and are never pulled automatically by the service.
