import { useEffect, useState } from "react";

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const initialHeight = viewport.height;

    const handleResize = () => {
      const heightDiff = initialHeight - viewport.height;
      // seuil ~100px pour éviter les faux positifs
      setIsKeyboardOpen(heightDiff > 100);
    };

    viewport.addEventListener("resize", handleResize);

    return () => {
      viewport.removeEventListener("resize", handleResize);
    };
  }, []);

  return isKeyboardOpen;
}