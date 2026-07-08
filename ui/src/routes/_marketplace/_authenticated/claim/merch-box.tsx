import { useState, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Loader2Icon,
  LockIcon,
  PlusIcon,
  ShieldCheckIcon,
  Sparkles,
  TicketCheckIcon,
  Trash2Icon,
  WalletIcon,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNearAccountId } from '@/hooks/use-near-account-id';
import { useMerchBoxRequest, useVanguardSbtCheck } from '@/integrations/api/merch-box';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_marketplace/_authenticated/claim/merch-box')({
  component: ClaimMerchBoxPage,
});

interface LineItem {
  id: string;
  article: string;
  qty: string;
  cost: string;
}

function createItem(): LineItem {
  return { id: crypto.randomUUID(), article: '', qty: '1', cost: '' };
}

function toFloat(value: string): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

function toInt(value: string): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function ClaimMerchBoxPage() {
  const [items, setItems] = useState<LineItem[]>([createItem()]);
  const [notes, setNotes] = useState('');
  const nearAccountId = useNearAccountId();
  const { data: sbtCheck, isLoading: isSbtLoading } = useVanguardSbtCheck(nearAccountId);
  const merchBoxMutation = useMerchBoxRequest();

  const isHolder = sbtCheck?.isHolder ?? false;

  const updateItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }, []);

  const clampQty = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: String(Math.max(1, toInt(item.qty) || 1)) } : item,
      ),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createItem()]);
  }, []);

  const totalQty = items.reduce((sum, item) => sum + toInt(item.qty), 0);
  const totalCost = items.reduce((sum, item) => sum + toInt(item.qty) * toFloat(item.cost), 0);

  const handleSubmit = async () => {
    const validItems = items.filter((item) => item.article.trim().length > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one item with a description');
      return;
    }

    merchBoxMutation.mutate(
      {
        items: validItems.map((item) => ({
          article: item.article.trim(),
          qty: Math.max(1, toInt(item.qty) || 1),
          cost: toFloat(item.cost),
        })),
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Merch box request submitted!', {
            description: 'An admin will review your request soon.',
          });
          setItems([createItem()]);
          setNotes('');
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
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
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
            <div className="space-y-5">

              {/* Item table */}
              <div className="rounded-lg border border-border/60 bg-background/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left font-medium text-foreground px-3 py-2.5 w-[50%]">Article</th>
                      <th className="text-left font-medium text-foreground px-3 py-2.5 w-[15%]">QTY</th>
                      <th className="text-left font-medium text-foreground px-3 py-2.5 w-[20%]">COST</th>
                      <th className="w-[15%]" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border/30 last:border-0">
                        <td className="px-3 py-2">
                          <Input
                            placeholder="T-shirt, Hoodie..."
                            value={item.article}
                            onChange={(e) => updateItem(item.id, 'article', e.target.value)}
                            className="h-8 text-sm bg-background/80"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                            onBlur={() => clampQty(item.id)}
                            className="h-8 text-sm bg-background/80 w-16"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            placeholder="0.00"
                            value={item.cost}
                            onChange={(e) => updateItem(item.id, 'cost', e.target.value)}
                            className="h-8 text-sm bg-background/80 w-20"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            aria-label="Remove item"
                          >
                            <Trash2Icon className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/60 bg-muted/20">
                      <td className="px-3 py-3 text-sm font-medium text-foreground" colSpan={2}>
                        {totalQty} item{totalQty !== 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-foreground" colSpan={2}>
                        ${totalCost.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="w-full"
              >
                <PlusIcon className="size-4" />
                Add Item
              </Button>

              {/* Additional notes */}
              <div className="space-y-2">
                <label
                  htmlFor="notes"
                  className="text-sm font-medium text-foreground"
                >
                  Additional Notes (optional)
                </label>
                <textarea
                  id="notes"
                  placeholder="Any special requests, sizing details, or comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-[#00EC97] focus:outline-none focus:ring-0 resize-none"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={
                  merchBoxMutation.isPending ||
                  !items.some((i) => i.article.trim().length > 0)
                }
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
            </div>
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
