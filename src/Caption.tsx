import {
  useId,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import { Info } from "lucide-react";

/** Fixed positioning lets the tooltip escape scrolling tables. */
export function Caption({ text }: { text: string }) {
  const id = useId();
  const [place, setPlace] = useState<CSSProperties>();
  function anchor(event: SyntheticEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setPlace({
      position: "fixed",
      top: box.bottom + 6,
      right: Math.max(8, innerWidth - box.right),
    });
  }
  return (
    <span className="caption-tip" onPointerEnter={anchor} onFocus={anchor}>
      <button
        type="button"
        className="caption-button"
        aria-label="What the picture showed"
        aria-describedby={id}
      >
        <Info size={16} />
      </button>
      <span role="tooltip" id={id} style={place}>
        {text}
      </span>
    </span>
  );
}
