import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Loader2Icon,
  LockIcon,
  ShieldCheckIcon,
  Sparkles,
  TicketCheckIcon,
  WalletIcon,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNearAccountId } from '@/hooks/use-near-account-id';
import { useMerchBoxRequest, useVanguardSbtCheck } from '@/integrations/api/merch-box';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_marketplace/_authenticated/claim/merch-box')({
  component: ClaimMerchBoxPage,
});

function ClaimMerchBoxPage() {
  const [orderDetails, setOrderDetails] = useState('');
  const nearAccountId = useNearAccountId();
  const { data: sbtCheck, isLoading: isSbtLoading } = useVanguardSbtCheck(nearAccountId);
  const merchBoxMutation = useMerchBoxRequest();

  const isHolder = sbtCheck?.isHolder ?? false;

  const handleSubmit = async () => {
    if (!orderDetails.trim()) {
      toast.error('Please describe what you want to order');
      return;
    }

    merchBoxMutation.mutate(
      { orderDetails: orderDetails.trim() },
      {
        onSuccess: () => {
          toast.success('Merch box request submitted!', {
            description: 'We will review your request and get back to you soon.',
          });
          setOrderDetails('');
        },
        onError: (error) => {
          toast.error('Failed to submit request', {
            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
          });
        },
      },
    );
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-background/60 backdrop-blur-sm border border-border/60 px-6 md:px-8 py-8 md:py-10 space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Claim Your Vanguard Merch Box
            </h1>
            <p className="text-sm text-muted-foreground">
              This drop is exclusive to Vanguard SBT holders.
            </p>
          </div>

          {/* Wallet status */}
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm',
              nearAccountId
                ? 'border-border/60 bg-background/60'
                : 'border-destructive/30 bg-destructive/5',
            )}
          >
            <WalletIcon className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">NEAR Account</p>
              <p className="truncate text-muted-foreground">
                {nearAccountId ?? 'Not connected'}
              </p>
            </div>
            {nearAccountId && (
              <ShieldCheckIcon className="size-5 shrink-0 text-green-500" />
            )}
          </div>

          {/* Vanguard SBT status */}
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm',
              isSbtLoading
                ? 'border-border/40 bg-background/40'
                : isHolder
                  ? 'border-[#00EC97]/40 bg-[#00EC97]/5'
                  : 'border-border/60 bg-background/60',
            )}
          >
            <div className="flex size-5 shrink-0 items-center justify-center">
              {isSbtLoading ? (
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              ) : isHolder ? (
                <TicketCheckIcon className="size-5 text-[#00EC97]" />
              ) : (
                <LockIcon className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Vanguard SBT</p>
              <p className="truncate text-muted-foreground">
                {isSbtLoading
                  ? 'Checking...'
                  : isHolder
                    ? 'Verified'
                    : 'Not found on this account'}
              </p>
            </div>
          </div>

          {/* Content area */}
          {isSbtLoading ? null : isHolder ? (
            <>
              <div className="space-y-2">
                <label
                  htmlFor="order-details"
                  className="text-sm font-medium text-foreground"
                >
                  What would you like to order?
                </label>
                <textarea
                  id="order-details"
                  placeholder="Describe what you'd like to order and how much (e.g., '2 NEAR t-shirts, size L, 1 NEAR hoodie, size M')..."
                  value={orderDetails}
                  onChange={(e) => setOrderDetails(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-[#00EC97] focus:outline-none focus:ring-0 resize-none"
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={merchBoxMutation.isPending || !orderDetails.trim()}
                className="w-full bg-[#00EC97] text-black hover:bg-[#00d97f] disabled:opacity-50"
              >
                {merchBoxMutation.isPending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </>
          ) : (
            <div className="rounded-xl border border-[#00EC97]/40 bg-gradient-to-b from-[#00EC97]/10 to-transparent px-5 py-6 space-y-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-[#00EC97]/15 border border-[#00EC97]/40">
                  <Sparkles className="size-6 text-[#00EC97]" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold text-foreground">
                    Join Legion. Rank up. Claim merch.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This drop is reserved for{' '}
                    <span className="font-semibold text-foreground">Vanguard-tier</span>{' '}
                    Legion members. Join Legion, complete quests, and level up
                    to unlock exclusive merch boxes and more.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href="https://nearlegion.com/join"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md',
                    'bg-[#00EC97] text-black font-semibold text-sm',
                    'hover:bg-[#00d97f] transition-colors',
                  )}
                >
                  Join Legion
                  <ArrowUpRight className="size-4" />
                </a>
                <Link
                  to="/products"
                  search={{ category: '', categoryId: undefined, collection: undefined }}
                >
                  <Button variant="outline" className="w-full">
                    Browse Shop
                  </Button>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
