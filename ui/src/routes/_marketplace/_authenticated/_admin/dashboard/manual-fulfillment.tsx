import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Truck,
  PackageCheck,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/utils/orpc";
import { cn } from "@/lib/utils";

type ManualFulfillmentStatus = "pending" | "accepted" | "processing" | "shipped" | "delivered" | "rejected" | "cancelled";

const STATUS_TABS: { value: ManualFulfillmentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "rejected", label: "Rejected" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "pending": return "bg-yellow-500/10 text-yellow-600 border-yellow-500";
    case "accepted": return "bg-blue-500/10 text-blue-600 border-blue-500";
    case "processing": return "bg-indigo-500/10 text-indigo-600 border-indigo-500";
    case "shipped": return "bg-purple-500/10 text-purple-600 border-purple-500";
    case "delivered": return "bg-emerald-500/10 text-emerald-500 border-emerald-500";
    case "rejected": return "bg-red-500/10 text-red-600 border-red-500";
    case "cancelled": return "bg-gray-500/10 text-gray-500 border-gray-500";
    default: return "";
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export const Route = createFileRoute(
  "/_marketplace/_authenticated/_admin/dashboard/manual-fulfillment"
)({
  loader: async () => {
    const result = await apiClient.getManualFulfillmentQueue({ limit: 100, offset: 0 });
    return result;
  },
  component: ManualFulfillmentPage,
});

type FulfillmentItem = Awaited<ReturnType<typeof apiClient.getManualFulfillmentQueue>>['fulfillments'][0];

function ManualFulfillmentPage() {
  const initialData = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState<ManualFulfillmentStatus | "all">("all");
  const [fulfillments, setFulfillments] = useState(initialData.fulfillments);
  const [total, setTotal] = useState(initialData.total);
  const [isLoading, setIsLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [carrier, setCarrier] = useState("");

  const refresh = async () => {
    setIsLoading(true);
    try {
      const statusParam = activeTab === "all" ? undefined : activeTab;
      const result = await apiClient.getManualFulfillmentQueue({ limit: 100, offset: 0, status: statusParam });
      setFulfillments(result.fulfillments);
      setTotal(result.total);
    } catch (err) {
      toast.error("Failed to refresh fulfillment queue");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await apiClient.acceptManualFulfillment({ fulfillmentId: id });
      toast.success("Order accepted");
      refresh();
    } catch (err) {
      toast.error("Failed to accept order");
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    try {
      await apiClient.rejectManualFulfillment({ fulfillmentId: selectedId, reason: rejectReason || undefined });
      toast.success("Order rejected");
      setRejectDialogOpen(false);
      setSelectedId(null);
      setRejectReason("");
      refresh();
    } catch (err) {
      toast.error("Failed to reject order");
      console.error(err);
    }
  };

  const handleMarkShipped = async () => {
    if (!selectedId) return;
    try {
      await apiClient.updateManualFulfillment({
        fulfillmentId: selectedId,
        status: "shipped",
        trackingCode: trackingCode || undefined,
        trackingUrl: trackingUrl || undefined,
        carrier: carrier || undefined,
      });
      toast.success("Order marked as shipped");
      setShipDialogOpen(false);
      setSelectedId(null);
      setTrackingCode("");
      setTrackingUrl("");
      setCarrier("");
      refresh();
    } catch (err) {
      toast.error("Failed to update order");
      console.error(err);
    }
  };

  const handleMarkDelivered = async (id: string) => {
    try {
      await apiClient.updateManualFulfillment({ fulfillmentId: id, status: "delivered" });
      toast.success("Order marked as delivered");
      refresh();
    } catch (err) {
      toast.error("Failed to update order");
      console.error(err);
    }
  };

  const filteredFulfillments = activeTab === "all"
    ? fulfillments
    : fulfillments.filter((f: FulfillmentItem) => f.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Manual Fulfillment</h2>
          <p className="text-sm text-foreground/90 dark:text-muted-foreground">
            Manage orders that require manual fulfillment
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="px-6 py-3 rounded-lg bg-background/60 backdrop-blur-sm border border-border/60 text-foreground flex items-center justify-center font-semibold text-sm hover:bg-[#00EC97] hover:border-[#00EC97] hover:text-black transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.value
                ? "bg-[#00EC97] text-black"
                : "bg-background/60 border border-border/60 text-foreground/70 hover:bg-foreground/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-foreground/50 mb-2">{total} total orders</div>

      {filteredFulfillments.length === 0 ? (
        <div className="rounded-2xl bg-background border border-border/60 p-12 text-center">
          <PackageCheck className="size-12 mx-auto mb-4 text-foreground/30" />
          <p className="text-foreground/70">No manual fulfillment orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFulfillments.map((f: FulfillmentItem) => (
            <div key={f.id} className="rounded-xl bg-background border border-border/60 p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn("font-normal capitalize", getStatusColor(f.status))}>
                      {f.status}
                    </Badge>
                    <span className="text-xs text-foreground/50">Created {formatDate(f.createdAt)}</span>
                  </div>
                  {f.order && (
                    <div className="text-sm space-y-0.5">
                      <p className="font-medium">Order {f.order.id.slice(0, 8)}…</p>
                      <p className="text-foreground/60">
                        {f.order.items?.map((item: { productName: string; quantity: number }) => `${item.productName} ×${item.quantity}`).join(", ")}
                      </p>
                      {f.order.shippingAddress && (
                        <p className="text-foreground/50 text-xs">
                          {f.order.shippingAddress.firstName} {f.order.shippingAddress.lastName} · {f.order.shippingAddress.email}
                        </p>
                      )}
                    </div>
                  )}
                  {f.trackingCode && (
                    <p className="text-xs text-foreground/50 mt-1">
                      Tracking: {f.trackingCode} {f.carrier && `(${f.carrier})`}
                    </p>
                  )}
                  {f.internalNotes && (
                    <p className="text-xs text-foreground/50 mt-1 italic">{f.internalNotes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {f.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleAccept(f.id)}
                      >
                        <CheckCircle className="size-3.5 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setSelectedId(f.id); setRejectDialogOpen(true); }}
                      >
                        <XCircle className="size-3.5 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  {f.status === "accepted" && (
                    <Button
                      size="sm"
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                      onClick={() => { setSelectedId(f.id); setShipDialogOpen(true); }}
                    >
                      <Truck className="size-3.5 mr-1" />
                      Ship
                    </Button>
                  )}
                  {f.status === "shipped" && (
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => handleMarkDelivered(f.id)}
                    >
                      <PackageCheck className="size-3.5 mr-1" />
                      Delivered
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>Are you sure you want to reject this order? This will mark the order as rejected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Input id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Shipped</DialogTitle>
            <DialogDescription>Add tracking information for this order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tracking-code">Tracking Code</Label>
              <Input id="tracking-code" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="e.g. 1Z999AA10123456784" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking-url">Tracking URL</Label>
              <Input id="tracking-url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. USPS, FedEx, UPS" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialogOpen(false)}>Cancel</Button>
            <Button className="bg-purple-500 hover:bg-purple-600 text-white" onClick={handleMarkShipped}>
              {isLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Truck className="size-4 mr-2" />}
              Mark Shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}