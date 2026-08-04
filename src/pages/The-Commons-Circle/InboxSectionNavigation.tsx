import { Link, useLocation } from "react-router-dom";

const INBOX_ROOT = "/commons-circle/signals/inbox";

export default function InboxSectionNavigation() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const isNewConversation = pathname === `${INBOX_ROOT}/new`;
  const isSettings = pathname === `${INBOX_ROOT}/settings`;
  const isConversation = pathname.startsWith(`${INBOX_ROOT}/conversations/`);
  const isInbox = pathname === INBOX_ROOT;

  return <nav className="section-card inbox-section-navigation" aria-label="Inbox section navigation">
    <Link
      className="button-link"
      to={INBOX_ROOT}
      aria-current={isInbox ? "page" : isConversation ? "location" : undefined}
    >Inbox</Link>
    <Link
      className="button-link"
      to={`${INBOX_ROOT}/new`}
      aria-current={isNewConversation ? "page" : undefined}
    >Start a private conversation</Link>
    <Link
      className="button-link"
      to={`${INBOX_ROOT}/settings`}
      aria-current={isSettings ? "page" : undefined}
    >Messaging settings</Link>
  </nav>;
}
