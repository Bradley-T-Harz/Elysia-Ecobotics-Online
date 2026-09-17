"""Scoped auth-return configuration; existing secure CLI login, no backend-key retrieval."""
import json, os, sys, urllib.request

PROJECT = "kdtqyxlrkpmlpupzgmwv"
ORIGIN = "https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev"
DESIRED = {"site_url": ORIGIN, "uri_allow_list": ",".join(ORIGIN + path for path in ["/account", "/commons-circle", "/account/recovery"])}
FIELDS = ["site_url", "uri_allow_list", "disable_signup", "external_email_enabled", "mailer_autoconfirm", "security_captcha_enabled"]

def main():
    if "--apply" not in sys.argv:
        print(json.dumps({"dryRun": True, "projectRef": PROJECT, "changes": DESIRED}, indent=2))
        return
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        import secretstorage
        bus = secretstorage.dbus_init()
        for username in ["supabase", "access-token"]:
            for item in secretstorage.search_items(bus, {"service": "Supabase CLI", "username": username}):
                if not item.is_locked():
                    token = item.get_secret().decode()
                    break
            if token:
                break
    if not token:
        raise RuntimeError("Existing secure Supabase CLI management login is unavailable.")
    def request(method="GET", fields=None):
        req = urllib.request.Request("https://api.supabase.com/v1/projects/" + PROJECT + "/config/auth",
            data=json.dumps(fields).encode() if fields is not None else None,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"}, method=method)
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    before = request()
    if before.get("site_url") not in ["http://localhost:3000", ORIGIN] or before.get("uri_allow_list") not in ["", DESIRED["uri_allow_list"]]:
        raise RuntimeError("Unexpected sandbox auth return configuration; review before updating.")
    changed = any(before.get(key) != value for key, value in DESIRED.items())
    if changed:
        request("PATCH", DESIRED)
    after = request()
    assert all(after.get(key) == value for key, value in DESIRED.items())
    assert all(before.get(key) == after.get(key) for key in FIELDS if key not in DESIRED)
    print(json.dumps({"projectRef": PROJECT, "changed": changed, "before": {k: before.get(k) for k in FIELDS},
        "after": {k: after.get(k) for k in FIELDS}, "credentialsPrinted": False, "productionAccessed": False}, indent=2))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Sandbox auth configuration failed; credential values and provider response are withheld.", file=sys.stderr)
        sys.exit(1)
