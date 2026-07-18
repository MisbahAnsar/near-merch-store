import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircleIcon, ClockIcon, PackageIcon } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/utils/orpc';
import { useMerchBoxRequests, useMarkMerchBoxRequestReviewed } from '@/integrations/api/merch-box';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_marketplace/_authenticated/_admin/dashboard/merch-box')({
  component: AdminMerchBoxPage,
});

type MerchBoxRequest = Awaited<ReturnType<typeof apiClient.getMerchBoxRequests>>['requests'][number];

function AdminMerchBoxPage() {
  const [showReviewed, setShowReviewed] = useState(false);
  const { data, isLoading } = useMerchBoxRequests({ limit: 100 });
  const markReviewed = useMarkMerchBoxRequestReviewed();

  const requests = data?.requests ?? [];

  const filteredRequests = useMemo(
    () => (showReviewed ? requests : requests.filter((r) => !r.reviewed)),
    [requests, showReviewed],
  );

  const columns: ColumnDef<MerchBoxRequest>[] = useMemo(
    () => [
      {
        accessorKey: 'nearAccountId',
        header: 'Account',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {row.original.nearAccountId}
          </span>
        ),
      },
      {
        accessorKey: 'items',
        header: 'Items',
        cell: ({ row }) => {
          const items: Array<{ article: string; qty: number; cost: number }> = row.original.items;
          const totalQty = items.reduce((s, i) => s + i.qty, 0);
          const totalCost = items.reduce((s, i) => s + i.qty * i.cost, 0);
          return (
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {items.length} item{items.length !== 1 ? 's' : ''} ({totalQty} units)
              </p>
              <p className="text-xs text-muted-foreground">
                ${totalCost.toFixed(2)}
              </p>
            </div>
          );
        },
      },
      {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => {
          const items: Array<{ article: string; qty: number; cost: number }> = row.original.items;
          return (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition-colors">
                View items
              </summary>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {items.map((item, i) => (
                  <li key={i}>
                    {item.article} x{item.qty} @ ${item.cost.toFixed(2)} = $
                    {(item.qty * item.cost).toFixed(2)}
                  </li>
                ))}
              </ul>
              {row.original.notes && (
                <p className="mt-1.5 italic text-muted-foreground">
                  Notes: {row.original.notes}
                </p>
              )}
            </details>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Submitted',
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          );
        },
      },
      {
        accessorKey: 'reviewed',
        header: 'Status',
        cell: ({ row }) => {
          const reviewed = row.original.reviewed;
          return (
            <Badge
              variant="outline"
              className={cn(
                'gap-1',
                reviewed
                  ? 'border-[#00EC97]/40 text-[#00EC97]'
                  : 'border-yellow-500/40 text-yellow-500',
              )}
            >
              {reviewed ? (
                <CheckCircleIcon className="size-3" />
              ) : (
                <ClockIcon className="size-3" />
              )}
              {reviewed ? 'Reviewed' : 'Pending'}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          if (row.original.reviewed) return null;
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                markReviewed.mutate(
                  { id: row.original.id },
                  {
                    onSuccess: () => {
                      toast.success('Marked as reviewed');
                    },
                    onError: (error) => {
                      toast.error('Failed to mark as reviewed', {
                        description:
                          error instanceof Error ? error.message : 'Unknown error',
                      });
                    },
                  },
                );
              }}
              disabled={markReviewed.isPending}
              className="h-8 text-xs"
            >
              <CheckCircleIcon className="size-3" />
              Mark Reviewed
            </Button>
          );
        },
      },
    ],
    [markReviewed],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Merch Box Requests</h2>
          <p className="text-sm text-foreground/90 dark:text-muted-foreground">
            Review and manage Vanguard merch box requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/90 dark:text-muted-foreground">
            <PackageIcon className="inline size-4 mr-1" />
            {requests.filter((r) => !r.reviewed).length} pending
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReviewed(!showReviewed)}
            className="h-8 text-xs"
          >
            {showReviewed ? 'Hide reviewed' : 'Show all'}
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={filteredRequests} />
    </div>
  );
}
