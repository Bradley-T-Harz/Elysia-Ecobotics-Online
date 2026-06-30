import { useEffect, useState } from "react";

type CommonsAvatarViewerProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  viewLabel: string;
  className?: string;
  imageClassName?: string;
};

export default function CommonsAvatarViewer({ src, alt, fallback, viewLabel, className = "", imageClassName = "" }: CommonsAvatarViewerProps) {
  const [open, setOpen] = useState(false);
  const avatarClassName = ["commons-avatar", className].filter(Boolean).join(" ");

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!src) {
    return <div className={avatarClassName}><span>{fallback}</span></div>;
  }

  return (
    <>
      <button type="button" className={`${avatarClassName} commons-avatar-button`} onClick={() => setOpen(true)} aria-label={viewLabel}>
        <img className={imageClassName} src={src} alt={alt} />
      </button>
      {open && (
        <div
          className="commons-avatar-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Full Commons profile picture"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="commons-avatar-lightbox-panel">
            <button type="button" className="commons-avatar-lightbox-close" onClick={() => setOpen(false)}>Close</button>
            <img className="commons-avatar-lightbox-image" src={src} alt={alt} />
          </div>
        </div>
      )}
    </>
  );
}
