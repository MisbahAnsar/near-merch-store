import { useEffect, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Gift, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'merch-box-fab-dismissed';

export function MerchBoxFab() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  // Hide on the claim page itself (redundant there)
  if (location.pathname === '/claim/merch-box') return null;
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <div className="relative inline-flex">
        <Link
          to="/claim/merch-box"
          aria-label="Claim Merch Box"
          className={cn(
            'inline-flex items-center gap-2 rounded-full',
            'bg-[#00EC97] text-black',
            'hover:bg-[#00d97f] transition-colors',
            'shadow-lg font-semibold text-sm',
            'h-12 px-4 sm:pl-4 sm:pr-5',
          )}
        >
          <Gift className="h-5 w-5 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">
            Claim Merch Box
          </span>
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className={cn(
            'absolute -top-1.5 -right-1.5 inline-flex items-center justify-center',
            'h-5 w-5 rounded-full',
            'bg-background border border-border/60 text-muted-foreground',
            'hover:text-foreground hover:border-foreground/40 transition-colors',
            'shadow',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
