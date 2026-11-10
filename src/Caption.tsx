import {
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { Info } from "lucide-react";

/** Fixed positioning lets the tooltip escape scrolling tables. */
export function Tip({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [place, setPlace] = useState<CSSProperties>();
  function anchor(event: SyntheticEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const height =
      event.currentTarget.querySelector<HTMLElement>("[role=tooltip]")
        ?.offsetHeight ?? 0;
    const below = box.bottom + 6 + height <= innerHeight - 8;
    setPlace({
      position: "fixed",
      top:
        below || box.top < height + 14 ? box.bottom + 6 : box.top - 6 - height,
      right: Math.max(8, innerWidth - box.right),
    });
  }
  return (
    <span className="caption-tip" onPointerEnter={anchor} onFocus={anchor}>
      <button
        type="button"
        className="caption-button"
        aria-label={label}
        aria-describedby={id}
      >
        {icon}
      </button>
      <span role="tooltip" id={id} className={className} style={place}>
        {children}
      </span>
    </span>
  );
}

export const Caption = ({ text }: { text: string }) => (
  <Tip label="What the picture showed" icon={<Info size={16} />}>
    {text}
  </Tip>
);
