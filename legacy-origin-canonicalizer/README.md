# Legacy origin canonicalizer

This bounded Cloudflare Pages artifact retires the stale `elysia-marketplace.pages.dev` client without deleting its project or any established route. Every request receives a fixed-origin `308` redirect to `https://elysiaecobotics.com` with the original pathname and query string. Browser fragment inheritance remains intact; the static fallback also copies fragments explicitly.

The destination origin is a constant. Request hosts and query values can never select another destination. Redirect responses are not cached during the qualification period and instruct crawlers not to index the legacy hostname.

Deploy from this directory so Wrangler discovers the adjacent `functions/` directory:

```sh
wrangler pages deploy public --project-name elysia-marketplace --branch main
```

The pre-retirement rollback deployment is `935c0d56`. Do not delete the Pages project or that deployment.
