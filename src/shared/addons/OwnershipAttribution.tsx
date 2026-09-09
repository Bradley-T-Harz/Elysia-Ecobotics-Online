import { useState } from "react";
import { Link } from "react-router-dom";
import { ownershipSelectionSchema, publisherRpc, usePublisherWorkspace, type OwnershipSelection } from "./publisherOwnership";
import "./ownershipAttribution.css";

export default function OwnershipAttribution({ value, onChange, disabled = false }: { value: OwnershipSelection; onChange: (next: OwnershipSelection) => void; disabled?: boolean }) {
  const workspace = usePublisherWorkspace();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ token: string; text: string } | null>(null);
  const options = workspace.state?.publishers ?? [];
  const selected = options.find(item => item.id === value.publisherId);
  async function createPersonalPublisher() {
    if (!workspace.token || busy) return;
    const token = workspace.token;
    setBusy(true);
    try {
      await publisherRpc(token, "save_own_marketplace_publisher", { p_display_name: newName.trim(), p_publisher_id: null });
      setMessage({ token, text: "Your individual publisher is saved. Select it below. This does not create official verification or review authority." });
      workspace.refresh();
    } catch (cause) { setMessage({ token, text: cause instanceof Error ? cause.message : "Publisher creation was not confirmed." }); }
    finally { setBusy(false); }
  }
  return <fieldset className="ownership-attribution" disabled={disabled || busy}>
    <legend>Ownership &amp; attribution</legend>
    <div className="ownership-attribution__fields">
      <div><label><span>Creator / Organization</span><input value={value.creatorAttribution} maxLength={200} onChange={event => onChange({ ...value, creatorAttribution: event.target.value })} /></label>
        <button type="button" disabled={!workspace.state?.commonsDisplayName} onClick={() => onChange({ ...value, creatorAttribution: workspace.state!.commonsDisplayName! })}>Use my Commons Profile display name</button></div>
      <label><span>Publisher account</span><select aria-label="Publisher account" value={selected?.id ?? ""} disabled={!workspace.signedIn || !workspace.state} onChange={event => onChange({ ...value, publisherId: event.target.value || null })}>
        <option value="">{workspace.signedIn ? "Select an authorized publisher" : "Sign in to select a publisher"}</option>
        {options.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
      </select></label>
    </div>
    <p className="boundary-note">Creator / Organization is attribution text. Typing an organization name grants no control over its publisher. Publisher selection uses your recorded authorization, independently of administrator, reviewer or financial roles.</p>
    {selected && <p>Publisher identity: {selected.entityKind === "organization" ? "Organization" : "Individual"}{selected.legalName ? ` · ${selected.legalName}` : ""}. Submission records preserve the attribution and publisher name used at that time.</p>}
    {!workspace.signedIn && <p>Local drafts can retain attribution. A publisher must be authorized again before anything is saved or submitted to the Marketplace.</p>}
    {workspace.loading && <p role="status">Checking your publisher identities…</p>}{workspace.error && <p role="status">{workspace.error}</p>}
    {value.publisherId && !selected && !workspace.loading && <p role="status">The recorded publisher is not available to this session. Select an authorized identity before saving to the Marketplace.</p>}
    {workspace.signedIn && workspace.state && !options.length && <details><summary>Create my individual publisher identity</summary><p>This creates a publisher you manage. Organization publishers and delegated managers require a separate governed authorization.</p><label><span>New publisher display name</span><input value={newName} maxLength={200} onChange={event => setNewName(event.target.value)} /></label><button type="button" disabled={!newName.trim()} onClick={() => void createPersonalPublisher()}>Create my publisher</button><p><Link to="/commons-circle/setup/profile">Commons Profile setup</Link> must be complete first.</p></details>}
    {message?.token === workspace.token && <p role="status">{message?.text}</p>}
  </fieldset>;
}

export function ownershipIsReady(value: OwnershipSelection) { return ownershipSelectionSchema.safeParse(value).success; }
