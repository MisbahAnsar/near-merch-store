import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, ImagePlus, Loader2, Lock, Star, Trash2, Unlock, Upload, GripVertical, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropProvider, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/react";
import { AlertDialog } from "radix-ui";
import { useProduct } from "@/integrations/api";
import { useUpdateProduct, useRequestAssetUpload, useConfirmAssetUpload } from "@/integrations/api/admin";
import { productKeys } from "@/integrations/api/keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_marketplace/_authenticated/_admin/dashboard/inventory/$productId",
)({
  component: ProductEditSheet,
});

type ImageType = "primary" | "mockup" | "preview" | "detail" | "catalog";

const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  primary: "Primary",
  mockup: "Mockup",
  preview: "Preview",
  detail: "Detail",
  catalog: "Catalog",
};

interface ProductImageDraft {
  id: string;
  url: string;
  type: ImageType;
  altText?: string;
  placement?: string;
  style?: string;
  variantIds?: string[];
  order: number;
  isNew?: boolean;
}

interface VariantPriceDraft {
  id: string;
  title: string;
  sku?: string;
  attributes: Array<{ name: string; value: string }>;
  price: string;
}

function UnsavedChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-[90] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-2xl duration-300 sm:max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <AlertDialog.Title className="text-lg leading-none font-semibold">
              Discard unsaved changes?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground text-sm">
              Your product changes have not been saved. Discarding them cannot be undone.
            </AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" onClick={onKeepEditing}>
                Keep editing
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button type="button" variant="destructive" onClick={onDiscard}>
                Discard changes
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function formatVariantAttributes(attributes: Array<{ name: string; value: string }>) {
  if (attributes.length === 0) return "Default variant";
  return attributes.map((attr) => `${attr.name}: ${attr.value}`).join(" · ");
}

function ImageCard({
  img,
  index,
  isThumbnail,
  onSetThumbnail,
  onRemove,
  onChangeType,
}: {
  img: ProductImageDraft;
  index: number;
  isThumbnail: boolean;
  onSetThumbnail: () => void;
  onRemove: () => void;
  onChangeType: (type: ImageType) => void;
}) {
  const { ref: draggableRef } = useDraggable({ id: img.id });
  const { ref: droppableRef } = useDroppable({ id: img.id });

  return (
    <div
      ref={(node) => {
        draggableRef(node);
        droppableRef(node);
      }}
      className={cn(
        "relative group rounded-lg overflow-hidden border-2 aspect-square cursor-grab active:cursor-grabbing",
        isThumbnail ? "border-[#00EC97]" : "border-border/60 hover:border-border",
      )}
    >
      <img
        src={img.url}
        alt={img.altText || `Product image ${index + 1}`}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onSetThumbnail}
          className={cn(
            "p-1.5 rounded-md text-xs",
            isThumbnail
              ? "bg-[#00EC97] text-black"
              : "bg-white/90 text-foreground hover:bg-white",
          )}
          title={isThumbnail ? "Remove thumbnail" : "Set as thumbnail"}
        >
          <Star className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-md bg-red-500/90 text-white hover:bg-red-500"
          title="Remove image"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="absolute bottom-1 left-1 opacity-100 group-hover:opacity-0 transition-opacity">
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
          {IMAGE_TYPE_LABELS[img.type]}
        </span>
      </div>
      <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
        <Select value={img.type} onValueChange={(val: ImageType) => onChangeType(val)}>
          <SelectTrigger className="h-6 w-full text-[10px] bg-black/80 text-white border-0 hover:bg-black/90 rounded px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(IMAGE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="size-3.5 text-white/70" />
      </div>
    </div>
  );
}

function ProductEditSheet() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: productData, isLoading, error } = useProduct(productId);
  const product = productData?.product;
  const hasMultipleVariants = (product?.variants?.length ?? 0) > 1;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceLocked, setPriceLocked] = useState(false);
  const [variantPrices, setVariantPrices] = useState<VariantPriceDraft[]>([]);
  const [images, setImages] = useState<ProductImageDraft[]>([]);
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageType, setNewImageType] = useState<ImageType>("primary");
  const [uploadingFile, setUploadingFile] = useState(false);
  const uploadTypeRef = useRef<ImageType>("primary");
  const [initialized, setInitialized] = useState(false);
  const [lastSavedHash, setLastSavedHash] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useUpdateProduct();
  const requestUpload = useRequestAssetUpload();
  const confirmUpload = useConfirmAssetUpload();

  useEffect(() => {
    if (product && !initialized) {
      setName(product.title);
      setDescription(product.description ?? "");
      setPrice(String(product.price));
      setPriceLocked(product.priceLocked ?? false);
      setVariantPrices(
        (product.variants ?? []).map((variant) => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          attributes: variant.attributes ?? [],
          price: String(variant.price),
        })),
      );
      setImages(
        (product.images ?? []).map((img, i) => ({
          id: img.id,
          url: img.url,
          type: (img.type || "catalog") as ImageType,
          altText: img.altText,
          placement: img.placement,
          style: img.style,
          variantIds: img.variantIds,
          order: img.order ?? i,
        })),
      );
      setThumbnailImage(product.thumbnailImage ?? null);
      setLastSavedHash(
        JSON.stringify({
          title: product.title,
          description: product.description ?? "",
          price: product.price,
          priceLocked: product.priceLocked ?? false,
          variants: (product.variants ?? []).map((variant) => ({
            id: variant.id,
            price: variant.price,
          })),
          images: product.images ?? [],
          thumbnailImage: product.thumbnailImage ?? null,
        }),
      );
      setInitialized(true);
    }
  }, [product, initialized]);

  const currentHash = initialized
    ? JSON.stringify({
        title: name,
        description,
        price: Number(price) || 0,
        priceLocked,
        variants: variantPrices.map((variant) => ({
          id: variant.id,
          price: Number(variant.price) || 0,
        })),
        images,
        thumbnailImage,
      })
    : "";
  const hasUnsavedChanges = currentHash !== lastSavedHash && initialized;
  const shouldBlockNavigation = useCallback(
    () => hasUnsavedChanges,
    [hasUnsavedChanges],
  );
  const blocker = useBlocker({
    shouldBlockFn: shouldBlockNavigation,
    withResolver: true,
    enableBeforeUnload: false,
  });

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleClose = useCallback(() => {
    navigate({ to: "/dashboard/inventory" });
  }, [navigate]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((img, i) => ({ ...img, order: i }));
    });
  }, []);

  const handleSetThumbnail = useCallback((url: string) => {
    setThumbnailImage((prev) => (prev === url ? null : url));
  }, []);

  const handleChangeImageType = useCallback((index: number, type: ImageType) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, type } : img)),
    );
  }, []);

  const handleAddImageUrl = useCallback(() => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [
      ...prev,
      {
        id: `new-img-${Date.now()}`,
        url: newImageUrl.trim(),
        type: newImageType,
        order: prev.length,
        isNew: true,
      },
    ]);
    setNewImageUrl("");
  }, [newImageUrl, newImageType]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large", { description: "Maximum file size is 10 MB" });
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type", { description: "Please upload an image file" });
        return;
      }

      setUploadingFile(true);
      try {
        const uploadReq = await requestUpload.mutateAsync({
          filename: file.name,
          contentType: file.type,
        });

        const putRes = await fetch(uploadReq.presignedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed: ${putRes.status}`);
        }

        await confirmUpload.mutateAsync({
          key: uploadReq.key,
          publicUrl: uploadReq.publicUrl,
          assetId: uploadReq.assetId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });

        setImages((prev) => [
          ...prev,
          {
            id: `new-img-${Date.now()}`,
            url: uploadReq.publicUrl,
            type: uploadTypeRef.current,
            order: prev.length,
            isNew: true,
          },
        ]);
      } catch (err) {
        toast.error("Image upload failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [requestUpload, confirmUpload],
  );

  const handleSave = useCallback(() => {
    if (!product) return;
    const parsedPrice = Number(price);
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error("Price must be a positive number");
      return;
    }

    const parsedVariants = variantPrices.map((variant) => ({
      id: variant.id,
      price: Number(variant.price),
    }));

    const invalidVariant = parsedVariants.find((variant) => isNaN(variant.price) || variant.price <= 0);
    if (invalidVariant) {
      toast.error("Variant prices must be positive numbers");
      return;
    }

    updateMutation.mutate(
      {
        id: productId,
        name: name !== product.title ? name : undefined,
        description: description !== (product.description ?? "") ? description : undefined,
        price: parsedPrice !== product.price ? parsedPrice : undefined,
        priceLocked: priceLocked !== (product.priceLocked ?? false) ? priceLocked : undefined,
        variants:
          hasMultipleVariants
            ? parsedVariants.filter(
                (variant, index) => variant.price !== (product.variants?.[index]?.price ?? variant.price),
              )
            : undefined,
        images: images.map((img, i) => ({
          id: img.id,
          url: img.url,
          type: img.type,
          altText: img.altText,
          placement: img.placement,
          style: img.style,
          variantIds: img.variantIds,
          order: i,
        })),
        thumbnailImage: thumbnailImage !== (product.thumbnailImage ?? null) ? thumbnailImage : undefined,
      },
      {
        onSuccess: (result) => {
          const savedProduct = result.product ?? product;

          setName(savedProduct.title);
          setDescription(savedProduct.description ?? "");
          setPrice(String(savedProduct.price));
          setPriceLocked(savedProduct.priceLocked ?? false);
          setVariantPrices(
            (savedProduct.variants ?? []).map((variant) => ({
              id: variant.id,
              title: variant.title,
              sku: variant.sku,
              attributes: variant.attributes ?? [],
              price: String(variant.price),
            })),
          );
          setImages(
            (savedProduct.images ?? []).map((img, i) => ({
              id: img.id,
              url: img.url,
              type: (img.type || "catalog") as ImageType,
              altText: img.altText,
              placement: img.placement,
              style: img.style,
              variantIds: img.variantIds,
              order: img.order ?? i,
            })),
          );
          setThumbnailImage(savedProduct.thumbnailImage ?? null);
          toast.success("Product updated");
          setLastSavedHash(
            JSON.stringify({
              title: savedProduct.title,
              description: savedProduct.description ?? "",
              price: savedProduct.price,
              priceLocked: savedProduct.priceLocked ?? false,
              variants: (savedProduct.variants ?? []).map((variant) => ({
                id: variant.id,
                price: variant.price,
              })),
              images: savedProduct.images ?? [],
              thumbnailImage: savedProduct.thumbnailImage ?? null,
            }),
          );
          queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
      },
    );
  }, [updateMutation, productId, name, description, price, priceLocked, variantPrices, images, thumbnailImage, product, queryClient, hasMultipleVariants]);

  return (
    <>
      <Sheet open onOpenChange={(open) => { if (!open) handleClose(); }}>
        <SheetContent side="right" hideCloseButton>
        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00EC97]" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <p className="text-destructive font-semibold">Failed to load product</p>
            <p className="text-sm text-foreground/60">{error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        ) : product ? (
          <>
            <div className="px-6 py-5 border-b border-border/60">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold tracking-tight truncate">{product.title}</h2>
                  <p className="text-sm text-foreground/60 mt-0.5">{product.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-background/60 hover:text-[#00EC97] transition-colors shrink-0 ml-3"
                  aria-label="Close edit panel"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <a
                  href={`/products/${product.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-[#00EC97] transition-colors"
                >
                  <ExternalLink className="size-3" />
                  View on site
                </a>
                {hasUnsavedChanges && (
                  <span className="text-xs text-foreground/50">Unsaved changes</span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-6 space-y-6">
                <div className="rounded-xl border border-border/60 p-5 space-y-4">
                  <h3 className="text-sm font-medium text-foreground/90">Details</h3>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="space-y-2 w-40">
                        <Label htmlFor="price">{hasMultipleVariants ? "Base Price (USD)" : "Price (USD)"}</Label>
                      <div className="flex items-center gap-2">
                        <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                        <button
                          type="button"
                          onClick={() => setPriceLocked((v) => !v)}
                          className={cn(
                            "shrink-0 h-9 w-9 flex items-center justify-center rounded-md border transition-colors",
                            priceLocked
                              ? "border-[#00EC97] bg-[#00EC97]/10 text-[#00EC97]"
                              : "border-border/60 bg-background/60 text-foreground/40 hover:text-foreground/70",
                          )}
                          title={priceLocked ? "Price locked — sync won't overwrite" : "Price unlocked — sync may overwrite"}
                        >
                          {priceLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                        </button>
                      </div>
                      {priceLocked && (
                        <p className="text-[11px] text-[#00EC97]">Locked — re-sync won't change your price</p>
                      )}
                    </div>
                    {(() => {
                      const costs = (product.variants ?? [])
                        .map((v) => v.fulfillmentCost)
                        .filter((c): c is number => typeof c === "number" && c > 0);
                      const minCost = costs.length > 0 ? Math.min(...costs) : null;
                      const parsedPrice = Number(price) || 0;
                      const margin = minCost !== null ? parsedPrice - minCost : null;
                      if (minCost === null) return null;
                      return (
                        <div className="rounded-lg border border-border/40 bg-background/30 p-3 space-y-1.5">
                          <p className="text-xs font-medium text-foreground/70">Fulfillment Cost</p>
                          <p className="text-sm">${minCost.toFixed(2)}</p>
                          <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                            <p className="text-xs font-medium text-foreground/70">Margin</p>
                            <p className={cn(
                              "text-sm font-semibold",
                              margin !== null && margin > 0 && "text-[#00EC97]",
                              margin !== null && margin <= 0 && "text-red-500",
                            )}>
                              {margin !== null ? `$${margin.toFixed(2)}` : "—"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {(product.variants?.length ?? 0) > 1 && (
                      <div className="rounded-lg border border-border/40 bg-background/30 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground/80">Variant Prices</p>
                            <p className="text-xs text-foreground/50">Storefront listings use the lowest variant price.</p>
                          </div>
                          <span className="text-xs text-foreground/50">{variantPrices.length} variants</span>
                        </div>
                        <div className="space-y-3">
                          {variantPrices.map((variant, index) => (
                            <div key={variant.id} className="rounded-md border border-border/30 bg-background/50 p-3">
                              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="min-w-0 space-y-1">
                                  <p className="text-sm font-medium text-foreground/90 truncate">{variant.title}</p>
                                  <p className="text-xs text-foreground/50">{formatVariantAttributes(variant.attributes)}</p>
                                  {variant.sku && <p className="text-xs text-foreground/40">SKU: {variant.sku}</p>}
                                </div>
                                <div className="w-full md:w-40 space-y-2">
                                  <Label htmlFor={`variant-price-${variant.id}`} className="text-xs uppercase tracking-wide text-foreground/60">Price (USD)</Label>
                                  <Input
                                    id={`variant-price-${variant.id}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={variant.price}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setVariantPrices((prev) =>
                                        prev.map((item, itemIndex) =>
                                          itemIndex === index ? { ...item, price: next } : item,
                                        ),
                                      );
                                    }}
                                    className="h-9 bg-background/60 border border-border/60 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground/90">Images</h3>
                    <p className="text-xs text-foreground/50">Drag to reorder · Hover to edit</p>
                  </div>

                  <DragDropProvider
                    onDragEnd={(event) => {
                      const sourceId = event.operation?.source?.id;
                      const targetId = event.operation?.target?.id;
                      if (!sourceId || !targetId || sourceId === targetId) return;
                      setImages((prev) => {
                        const sourceIndex = prev.findIndex((img) => img.id === sourceId);
                        const targetIndex = prev.findIndex((img) => img.id === targetId);
                        if (sourceIndex === -1 || targetIndex === -1) return prev;
                        const next = [...prev];
                        const [moved] = next.splice(sourceIndex, 1);
                        next.splice(targetIndex, 0, moved);
                        return next.map((img, i) => ({ ...img, order: i }));
                      });
                    }}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.map((img, index) => (
                        <ImageCard
                          key={img.id}
                          img={img}
                          index={index}
                          isThumbnail={thumbnailImage === img.url}
                          onSetThumbnail={() => handleSetThumbnail(img.url)}
                          onRemove={() => handleRemoveImage(index)}
                          onChangeType={(type) => handleChangeImageType(index, type)}
                        />
                      ))}
                      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
                        {() => null}
                      </DragOverlay>

                      <div className="rounded-lg border-2 border-dashed border-border/60 aspect-square flex flex-col items-center justify-center gap-2 text-foreground/40 hover:text-foreground/70 hover:border-foreground/30 transition-colors">
                        <label className="cursor-pointer flex flex-col items-center gap-1">
                          <Upload className="size-5" />
                          <span className="text-xs">Upload</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploadingFile}
                          />
                        </label>
                        {uploadingFile && <Loader2 className="size-4 animate-spin text-foreground/50" />}
                      </div>
                    </div>
                  </DragDropProvider>

                  {thumbnailImage && (
                    <p className="text-xs text-foreground/60 flex items-center gap-1">
                      <Star className="size-3 text-[#00EC97]" /> Thumbnail set
                    </p>
                  )}

                  <div className="flex gap-2 items-end pt-2 border-t border-border/40">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="imageUrl">Add image by URL</Label>
                      <Input
                        id="imageUrl"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="https://example.com/image.png"
                        onKeyDown={(e) => e.key === "Enter" && handleAddImageUrl()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imageType">Type</Label>
                      <Select value={newImageType} onValueChange={(val: ImageType) => setNewImageType(val)}>
                        <SelectTrigger className="h-9 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(IMAGE_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" onClick={handleAddImageUrl} variant="outline" className="h-9">
                      <ImagePlus className="size-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/60">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || !hasUnsavedChanges}
                className={cn(
                  "w-full font-semibold",
                  hasUnsavedChanges
                    ? "bg-[#00EC97] text-black hover:bg-[#00d97f]"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {updateMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </>
        ) : null}
        </SheetContent>
      </Sheet>
      <UnsavedChangesDialog
        open={blocker.status === "blocked"}
        onKeepEditing={() => {
          if (blocker.status === "blocked") blocker.reset();
        }}
        onDiscard={() => {
          if (blocker.status === "blocked") blocker.proceed();
        }}
      />
    </>
  );
}
