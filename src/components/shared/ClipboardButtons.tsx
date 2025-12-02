import CopyIcon from "@/assets/svg/copy.svg";
import PasteIcon from "@/assets/svg/paste.svg";

interface ClipboardButtonProps {
  onClick: () => void;
  title?: string;
  showLabel?: boolean;
  label?: string;
}

export function CopyButton({ 
  onClick, 
  title = "Copy to Clipboard",
  showLabel = false,
  label = "Copy"
}: ClipboardButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 p-2 hover:bg-surface-hover rounded-default transition-colors border border-strong"
      title={title}
    >
      <img src={CopyIcon} alt="" className="dark:invert w-5 h-5 sm:w-6 sm:h-6" />
      {showLabel && <span className="sm:hidden text-sm">{label}</span>}
    </button>
  );
}

export function PasteButton({ 
  onClick, 
  title = "Paste from Clipboard",
  showLabel = false,
  label = "Paste"
}: ClipboardButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 p-2 hover:bg-surface-hover rounded-default transition-colors border border-strong"
      title={title}
    >
      <img src={PasteIcon} alt="" className="dark:invert w-5 h-5 sm:w-6 sm:h-6" />
      {showLabel && <span className="sm:hidden text-sm">{label}</span>}
    </button>
  );
}
