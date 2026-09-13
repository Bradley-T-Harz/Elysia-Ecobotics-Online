/** Signed fixed-loopback transport. Constructed only after explicit Sync/native confirmation. */
import type { BrokerPolicy, BrokerProof, BrokerResponse, BrowserPublicKey, PairingIntent, PairingSession } from "./contracts";
import { browserHash } from "./workspace";

export const codevBrokerPolicy = { origin: "http://127.0.0.1:47321", host: "127.0.0.1:47321", port: 47321,
  max_body_bytes: 2097152, clock_skew_seconds: 30 } satisfies Required<BrokerPolicy>;
export type PairingView = { pairing_id: string; native_public_key: BrowserPublicKey | null; intent: PairingIntent; workspace_grants: never[] };
export type OnlineScope = { accountId: string; loginSessionId: string; origin: string; surface: "marketplace" | "forge"; browserSessionId: string };
export type ScopedKey = { scope: OnlineScope; privateKey: CryptoKey; publicKey: BrowserPublicKey; expiresAt: string };
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
export const codevRandomId = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const utf8 = (text: string) => new TextEncoder().encode(text);
function decode(value: string, size: number) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid Codev signature encoding.");
  const bytes = Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4)), char => char.charCodeAt(0));
  if (bytes.length!==size || encode(bytes)!==value) throw new Error("Invalid Codev signature length.");
  return bytes;
}
function transcript(values: string[]) {
  if (values.some(value => !value || /[\r\n\0]/.test(value))) throw new Error("Invalid Codev connection binding.");
  return utf8(values.join("\n"));
}
export function codevScopeKey(scope: OnlineScope) {
  return JSON.stringify([scope.origin,scope.accountId,scope.loginSessionId,scope.surface,scope.browserSessionId]);
}
export function codevLoginSessionId(token: string): string | null {
  try {
    const encoded=token.split(".")[1];
    const value=JSON.parse(atob(encoded.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-encoded.length%4)%4)));
    return typeof value.session_id === "string" && /^[a-f0-9-]{36}$/i.test(value.session_id) ? value.session_id : null;
  } catch {return null;}
}
export async function createCodevKey(scope: OnlineScope): Promise<ScopedKey> {
  if (!crypto.subtle || !["https://elysiaecobotics.com","https://www.elysiaecobotics.com"].includes(scope.origin)) throw new Error("Codev sync requires the secure production website.");
  const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]);
  const value=await crypto.subtle.exportKey("jwk",pair.publicKey);
  return {scope,privateKey:pair.privateKey,publicKey:{kty:"EC",crv:"P-256",x:value.x!,y:value.y!},expiresAt:new Date(Date.now()+300000).toISOString()};
}
export function validatePairing(value: unknown, scope: OnlineScope, publicKey: BrowserPublicKey): PairingView {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Invalid Codev pairing response.");
  const pairing=value as PairingView;const intent=pairing.intent;
  if (Object.keys(pairing).sort().join()!=="intent,native_public_key,pairing_id,workspace_grants" || !intent
    || intent.contract_version!=="codev-pairing-1" || intent.intent_id!==pairing.pairing_id
    || !/^[a-f0-9-]{36}$/i.test(pairing.pairing_id) || intent.online_account_id!==scope.accountId
    || intent.origin!==scope.origin || intent.surface!==scope.surface || intent.browser_session_id!==scope.browserSessionId
    || intent.browser_public_key?.x!==publicKey.x || intent.browser_public_key?.y!==publicKey.y
    || intent.browser_public_key?.kty!=="EC" || intent.browser_public_key?.crv!=="P-256"
    || !Array.isArray(pairing.workspace_grants) || pairing.workspace_grants.length
    || !["pending","native_approved","paired","denied","expired","revoked"].includes(intent.status ?? "")
    || typeof intent.account_label!=="string" || intent.account_label.length>200
    || !Number.isFinite(Date.parse(intent.expires_at)) || Date.parse(intent.expires_at)>Date.now()+960000) throw new Error("Codev pairing identity changed.");
  return pairing;
}
const paths = new Set(["status","revoke","workspace/share","workspace/revoke","workspace/status","workspace/reset","chat","chat/cancel","patch/plan","patch/authorize","receipts"]);
export class CodevBrokerClient {
  private closed=false;
  private pending=new Set<AbortController>();
  readonly key: ScopedKey;
  readonly pairing: PairingView;
  private checkAccount: () => Promise<void>;
  constructor(key: ScopedKey, pairing: PairingView, checkAccount: () => Promise<void>) {
    this.key=key;this.pairing=validatePairing(pairing,key.scope,key.publicKey);this.checkAccount=checkAccount;
    if (!pairing.native_public_key || !["native_approved","paired"].includes(pairing.intent.status??"")) throw new Error("Approve this connection in local Elysia first.");
  }
  disconnect() {this.closed=true;for(const abort of this.pending)abort.abort();this.pending.clear();}
  assertActive() {
    if (this.closed || Date.parse(this.pairing.intent.expires_at)<=Date.now()) throw new Error("Codev connection expired or disconnected. Sync again.");
  }
  async request<T>(route: string,payload: object,signal?: AbortSignal): Promise<T> {
    if (!paths.has(route)) throw new Error("Codev operation is unavailable.");
    await this.checkAccount();
    if (this.closed || Date.parse(this.pairing.intent.expires_at)<=Date.now()) throw new Error("Codev connection expired. Sync again.");
    const path="/codev/"+route;const payloadJson=JSON.stringify(payload);
    const proof: BrokerProof={pairing_id:this.pairing.pairing_id,browser_session_id:this.key.scope.browserSessionId,
      online_account_id:this.key.scope.accountId,nonce:codevRandomId(),timestamp_ms:Date.now(),signature:""};
    const payloadHash=await browserHash(utf8(payloadJson));
    const message=transcript(["elysia-codev-request-1",this.key.scope.origin,"POST",path,proof.pairing_id,
      proof.browser_session_id,proof.online_account_id,proof.nonce,String(proof.timestamp_ms),payloadHash]);
    proof.signature=encode(new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},this.key.privateKey,message)));
    const body=JSON.stringify({proof,payload_json:payloadJson});
    if (utf8(body).length>codevBrokerPolicy.max_body_bytes) throw new Error("Share fewer or smaller files with Codev.");
    const abort=new AbortController();this.pending.add(abort);
    const stop=()=>abort.abort();signal?.addEventListener("abort",stop,{once:true});
    if(signal?.aborted)abort.abort();
    let timedOut=false;
    const timeout=window.setTimeout(()=>{timedOut=true;stop();},route==="chat"?240000:20000);
    try {
      await this.checkAccount();if(this.closed)throw new Error("Codev disconnected.");
      const init: RequestInit & {targetAddressSpace: "loopback"} = {method:"POST",headers:{"content-type":"application/json"},
        body,mode:"cors",credentials:"omit",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",signal:abort.signal,targetAddressSpace:"loopback"};
      const response=await fetch(codevBrokerPolicy.origin+path,init);
      if(!response.ok || !response.body)throw new Error("The local Codev connection is unavailable or no longer authorized.");
      const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
      try {for(;;){const{value,done}=await reader.read();if(done)break;length+=value.length;
        if(length>codevBrokerPolicy.max_body_bytes*2){await reader.cancel();throw new Error("Codev response exceeds its limit.");}chunks.push(value);}}
      finally{reader.releaseLock();}
      const raw=new Uint8Array(length);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
      const envelope=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw)) as BrokerResponse;
      if(Object.keys(envelope).sort().join()!=="payload_json,signature" || typeof envelope.payload_json!=="string" || utf8(envelope.payload_json).length>codevBrokerPolicy.max_body_bytes)throw new Error("Invalid Codev response envelope.");
      const pinned=this.pairing.native_public_key!;
      if(pinned.kty!=="EC" || pinned.crv!=="P-256" || Object.keys(pinned).sort().join()!=="crv,kty,x,y")throw new Error("Invalid local Codev public key.");
      decode(pinned.x,32);decode(pinned.y,32);
      const verificationKey=await crypto.subtle.importKey("jwk",pinned,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
      const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},verificationKey,decode(envelope.signature,64),
        transcript(["elysia-codev-response-1",this.key.scope.origin,path,proof.pairing_id,proof.browser_session_id,
          proof.online_account_id,proof.nonce,payloadHash,await browserHash(utf8(envelope.payload_json))]));
      if(!valid)throw new Error("The response did not come from the Codev connection you approved.");
      await this.checkAccount();
      if(this.closed || abort.signal.aborted || Date.parse(this.pairing.intent.expires_at)<=Date.now())throw new Error("Codev response arrived after cancellation or expiry.");
      const result=JSON.parse(envelope.payload_json);
      if(result.ok!==true)throw new Error(typeof result.error==="string"?result.error:"Codev could not complete the operation.");
      return result.data as T;
    } catch(error) {
      // A lost response must not leave an admitted model request running merely
      // because the browser has stopped waiting. This remains actor-bound and
      // cannot cancel another session's work or grant any additional authority.
      const requestId=(payload as {request_id?:unknown}).request_id;
      if(route==="chat" && typeof requestId==="string" && /^codev_[a-f0-9]{32}$/.test(requestId))
        void this.request("chat/cancel",{request_id:requestId}).catch(()=>{});
      if(timedOut)throw new Error("Local Codev did not respond in time. Your browser files are unchanged. Retry when local reasoning is available.");
      if(abort.signal.aborted)throw new Error("This Codev request was cancelled. Your browser files are unchanged.");
      throw error;
    } finally {window.clearTimeout(timeout);signal?.removeEventListener("abort",stop);this.pending.delete(abort);}
  }
  async verifyConnection(): Promise<PairingSession> {
    const result=await this.request<{session:PairingSession;status:string}>("status",{});
    const value=result.session;
    if(!value || value.contract_version!=="codev-pairing-1" || value.pairing_id!==this.pairing.pairing_id
      || value.actor.online_account_id!==this.key.scope.accountId || value.actor.origin!==this.key.scope.origin
      || value.actor.surface!==this.key.scope.surface || value.actor.client_kind!=="browser"
      || value.browser_session_id!==this.key.scope.browserSessionId || !value.installation.installed || !value.installation.usable
      || value.installation.version!=="1.0.0" || !Array.isArray(value.workspace_grants) || value.workspace_grants.length)throw new Error("Installed Codev could not be verified for this connection.");
    return value;
  }
}
