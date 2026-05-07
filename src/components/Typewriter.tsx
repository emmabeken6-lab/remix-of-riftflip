import { useEffect, useState } from "react";

export default function Typewriter({
  phrases,
  typingSpeed = 90,
  deletingSpeed = 50,
  pauseAfterType = 1400,
  pauseAfterDelete = 350,
  className = "",
}: {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseAfterType?: number;
  pauseAfterDelete?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[index % phrases.length];
    let delay = deleting ? deletingSpeed : typingSpeed;

    if (!deleting && text === current) {
      delay = pauseAfterType;
      const t = setTimeout(() => setDeleting(true), delay);
      return () => clearTimeout(t);
    }
    if (deleting && text === "") {
      const t = setTimeout(() => {
        setDeleting(false);
        setIndex((i) => (i + 1) % phrases.length);
      }, pauseAfterDelete);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setText((prev) =>
        deleting ? current.substring(0, prev.length - 1) : current.substring(0, prev.length + 1)
      );
    }, delay);
    return () => clearTimeout(t);
  }, [text, deleting, index, phrases, typingSpeed, deletingSpeed, pauseAfterType, pauseAfterDelete]);

  return (
    <span className={className} aria-live="polite">
      {text}
      <span className="ml-1 inline-block w-[2px] -translate-y-0.5 align-middle bg-current animate-pulse" style={{ height: "0.9em" }} />
    </span>
  );
}
