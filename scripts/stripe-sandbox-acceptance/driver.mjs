// Local loopback driver only. No credentials or authenticated browser session.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const methods = { '/inspect': 'inspect', '/record-catalog': 'recordCatalog', '/readiness': 'readiness', '/checkout': 'startGuestCheckout', '/job': 'accountFlow', '/recurring': 'accountFlow', '/portal': 'accountFlow', '/refund': 'accountFlow', '/reconcile': 'reconcile', '/negative-checks': 'negativeChecks', '/expire': 'expireCheckout' };
    if (url.hostname !== '127.0.0.1' || request.method !== 'POST' || request.headers.has('origin') || !Object.hasOwn(methods, url.pathname) || url.search) {
      return new Response(null, { status: 404 });
    }
    try {
      if (url.pathname === '/expire') return Response.json(await env.ACCEPTANCE.expireCheckout((await request.json()).sessionId));
      const refundId = url.pathname === '/refund' ? (await request.json()).refundId : undefined;
      return Response.json(await env.ACCEPTANCE[methods[url.pathname]](url.pathname.slice(1), refundId));
    }
    catch { return Response.json({ result: 'private_service_binding_unavailable' }, { status: 503 }); }
  }
};
