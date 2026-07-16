import React, { useRef, useEffect } from 'react';

function CursorSpotlight() {
  const overlayRef = useRef(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleMove = (e) => {
      overlay.style.setProperty('--mouse-x', `${e.clientX}px`);
      overlay.style.setProperty('--mouse-y', `${e.clientY}px`);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return <div ref={overlayRef} className="mi-cursor-spotlight" aria-hidden="true" />;
}

export default CursorSpotlight;
