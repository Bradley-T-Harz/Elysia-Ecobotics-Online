import { useCallback, useEffect, useState } from "react";
import { inviteToCircle, loadCircleStateForHandle, removeFromCircle, respondToCircleInvitation, type CircleHandleState } from "./circleApi";

export default function CircleProfileAction({ handle }: { handle: string }) {
  const [status, setStatus] = useState<CircleHandleState>({ state: "unavailable", relationshipId: null });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await loadCircleStateForHandle(handle);
    setStatus(result.data);
    setMessage(result.warning ?? "");
    setLoading(false);
  }, [handle]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function act(action: "invite" | "accept" | "decline" | "remove") {
    setLoading(true);
    const result = action === "invite" ? await inviteToCircle(handle)
      : action === "accept" ? await respondToCircleInvitation(status.relationshipId ?? "", true)
      : action === "decline" ? await respondToCircleInvitation(status.relationshipId ?? "", false)
      : await removeFromCircle(status.relationshipId ?? "");
    setMessage(result.message);
    await refresh();
  }

  if (status.state === "self" || status.state === "unavailable") return message ? <span className="commons-circle-action-note" role="status">{message}</span> : null;
  return <div className="commons-circle-profile-action" aria-busy={loading}>
    {status.state === "can_invite" && <button type="button" disabled={loading} onClick={() => void act("invite")}>Invite to Circle</button>}
    {status.state === "sent" && <button type="button" disabled>Circle invitation sent</button>}
    {status.state === "incoming" && <><button className="button-primary" type="button" disabled={loading} onClick={() => void act("accept")}>Accept invitation</button><button type="button" disabled={loading} onClick={() => void act("decline")}>Decline</button></>}
    {status.state === "accepted" && <><span className="review-status">In Your Circle</span><button type="button" disabled={loading} onClick={() => void act("remove")}>Remove from Circle</button></>}
    {message && <span className="commons-circle-action-note" role="status">{message}</span>}
  </div>;
}
