import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

export interface ConfirmDeleteButtonProps {
  onDelete: () => void;
  className?: string;
  size?: 'sm' | 'default';
}

export function ConfirmDeleteButton({
  onDelete,
  className = '',
  size = 'default',
}: ConfirmDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Reset confirming state when clicking outside
  useEffect(() => {
    if (!confirming) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setConfirming(false);
      }
    };

    // Also reset after a timeout
    const timeout = setTimeout(() => setConfirming(false), 3000);

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timeout);
    };
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3 h-3';
  const buttonSize = size === 'sm' ? 'p-1' : 'w-6 h-7';

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className={`flex items-center justify-center ${buttonSize} ${
          confirming ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'
        } ${className}`}
        title={confirming ? 'Click again to delete' : 'Delete'}
      >
        <Trash2 className={iconSize} />
      </button>
      {confirming && (
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1 px-2 py-0.5 text-xs text-destructive/70 bg-destructive/10 border border-destructive/20 rounded whitespace-nowrap z-10">
          Confirm delete?
        </div>
      )}
    </div>
  );
}
