import { useEffect, useState } from "react";
import splash from "@/assets/splash.png";

const KEY = "rf-splash-shown-v1";

export default function SplashScreen() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(KEY);
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t1 = setTimeout(() => setFading(true), 1600);
    const t2 = setTimeout(() => {
      sessionStorage.setItem(KEY, "1");
      setShow(false);
    }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [show]);

  if (!show) return null;
  return (
    <div
      className={`fixed inset-0 z-[100] bg-black transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
      aria-hidden
    >
      <img
        src={splash}
        alt="Riftflip"
        className="absolute inset-0 h-full w-full object-cover animate-scale-in"
      />
    </div>
  );
}
