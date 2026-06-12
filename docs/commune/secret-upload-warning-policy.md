# Secret Upload Warning Policy

Secret scanners should flag:

- `.env`
- `API_KEY`
- `SECRET`
- `TOKEN`
- `PASSWORD`
- `PRIVATE KEY`
- `BEGIN PRIVATE KEY`
- `sk-`
- `ghp_`
- `github_pat_`
- `AWS_ACCESS_KEY_ID`
- `SUPABASE_SERVICE_ROLE`
- `service_role`
- `/home/`
- `C:\`
- `vault`
- `credentials`

Do not store detected secret strings in audit metadata. Store only safe flags such as `secret_warning_triggered`.
