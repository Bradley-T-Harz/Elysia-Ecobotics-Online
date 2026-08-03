import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CommonsAvatarViewerProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  viewLabel: string;
  className?: string;
  imageClassName?: string;
  imageIdentity?: string | null;
  onImageError?: (failedSrc: string) => void | Promise<void>;
};

export default function CommonsAvatarViewer({ src, alt, fallback, viewLabel, className = "", imageClassName = "", imageIdentity = null, onImageError }: CommonsAvatarViewerProps) {
  const [open, setOpen] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const renewalRef = useRef<{ identity: string | null; attempted: boolean }>({ identity: imageIdentity, attempted: false });
  const avatarClassName = ["commons-avatar", className].filter(Boolean).join(" ");
  const imageAvailable = Boolean(src && failedSrc !== src);

  function handleImageError() {
    if (!src) return;
    setFailedSrc(src);
    setOpen(false);
    if (!onImageError) return;
    if (renewalRef.current.identity !== imageIdentity) renewalRef.current = { identity: imageIdentity, attempted: false };
    if (renewalRef.current.attempted) return;
    renewalRef.current.attempted = true;
    void onImageError(src);
  }

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!imageAvailable) {
    return <div className={avatarClassName}><span>{fallback}</span></div>;
  }

  const lightbox = open ? (
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
        <img className="commons-avatar-lightbox-image" src={src!} alt={alt} onError={handleImageError} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className={`${avatarClassName} commons-avatar-button`} onClick={() => setOpen(true)} aria-label={viewLabel}>
        <img className={imageClassName} src={src!} alt={alt} onError={handleImageError} />
      </button>
      {lightbox && typeof document !== "undefined" ? createPortal(lightbox, document.body) : null}
    </>
  );
}
