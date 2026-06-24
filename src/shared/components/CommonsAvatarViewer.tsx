import { useEffect, useState } from "react";

type CommonsAvatarViewerProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  viewLabel: string;
};

export default function CommonsAvatarViewer({ src, alt, fallback, viewLabel }: CommonsAvatarViewerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!src) {
    return <div className="commons-avatar"><span>{fallback}</span></div>;
  }

  return (
    <>
      <button type="button" className="commons-avatar commons-avatar-button" onClick={() => setOpen(true)} aria-label={viewLabel}>
        <img src={src} alt={alt} />
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
