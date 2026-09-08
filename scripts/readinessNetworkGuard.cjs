// Local verification only. Mocked fetches remain usable; accidental real network
// dispatch fails before connection. Do not preload this in deployed services.
const net = require("node:net");
const tls = require("node:tls");
const dns = require("node:dns");
const allowed = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
function checkHost(host) {
  if (host !== undefined && !allowed.has(String(host))) {
    throw new Error("Isolated readiness check blocked a non-loopback connection.");
  }
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0];
  const options = Array.isArray(first) ? first[0] : first;
  if (options && typeof options === "object") {
    checkHost(options.host);
  } else if (typeof args[1] === "string") {
    checkHost(args[1]);
  }
  return connect.apply(this, args);
};
const tlsConnect = tls.connect;
tls.connect = function (...args) {
  if (args[0] && typeof args[0] === "object") checkHost(args[0].host ?? args[0].servername);
  else if (typeof args[1] === "string") checkHost(args[1]);
  return tlsConnect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (hostname, ...args) { checkHost(hostname); return lookup.call(this, hostname, ...args); };
const lookupPromise = dns.promises.lookup;
dns.promises.lookup = function (hostname, ...args) { checkHost(hostname); return lookupPromise.call(this, hostname, ...args); };
const realFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  checkHost(url.hostname);
  return realFetch(input, init);
};
