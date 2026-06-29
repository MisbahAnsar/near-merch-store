import { useState, useCallback, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  Star,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  useBuildProduct,
  useUpdateProduct,
} from "@/integrations/api/admin";
import type { ProductImage } from "@/integrations/api/products";

interface LuluImage {
  id: string;
  url: string;
  isUploaded: boolean;
}

export function LuluBuilder({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();

  const [images, setImages] = useState<LuluImage[]>([]);
  const [thumbnailId, setThumbnailId] = useState<string | null>(null);
  const { uploadFiles: uploadProductImages, uploading: imageUploading } =
    useFileUpload("products");

  const pdfUpload = useFileUpload("assets");
  const [freeDownloadEnabled, setFreeDownloadEnabled] = useState(false);

  const buildMutation = useBuildProduct();
  const updateMutation = useUpdateProduct();

  const form = useForm({
    defaultValues: {
      productName: "",
      productDescription: "",
      price: "",
      podPackageId: "",
      pageCount: "",
      format: "",
      coverPdfUrl: "",
      interiorPdfUrl: "",
      downloadUrl: "",
      downloadLabel: "",
    },
    onSubmit: async ({ value }) => {
      const primaryImage = thumbnailId
        ? images.find((i) => i.id === thumbnailId)?.url
        : images[0]?.url;

      const pageCountNum = parseInt(value.pageCount);

      const metadata: Record<string, unknown> = {
        providerDetails: {
          lulu: {
            pageCount: pageCountNum,
            format: value.format.trim() || undefined,
          },
        },
      };

      if (freeDownloadEnabled && value.interiorPdfUrl.trim()) {
        metadata.downloads = [
          {
            url: value.interiorPdfUrl.trim(),
            label: value.downloadLabel.trim() || "Download for Free",
            kind: "free",
          },
        ];
      }

      buildMutation.mutate(
        {
          name: value.productName.trim(),
          description: value.productDescription.trim() || undefined,
          providerName: "lulu",
          image: primaryImage || undefined,
          variants: [
            {
              name: value.format.trim() || "Default",
              variantRef: "lulu-book",
              providerConfig: {
                podPackageId: value.podPackageId.trim(),
                pageCount: pageCountNum,
                coverPdfUrl: value.coverPdfUrl.trim(),
                interiorPdfUrl: value.interiorPdfUrl.trim(),
              },
            },
          ],
          files: [],
          priceOverride: parseFloat(value.price),
          currency: "USD",
          metadata,
        },
        {
          onSuccess: (product) => {
            if (images.length > 0 && product?.id) {
              const thumbnailUrl = thumbnailId
                ? images.find((i) => i.id === thumbnailId)?.url
                : images[0]?.url;

              const productImages: ProductImage[] = images.map((img, i) => ({
                id: img.id,
                url: img.url,
                type:
                  img.id === thumbnailId || i === 0
                    ? ("primary" as const)
                    : ("preview" as const),
                order: i,
              }));

              updateMutation.mutate(
                {
                  id: product.id,
                  images: productImages,
                  thumbnailImage: thumbnailUrl || undefined,
                },
                {
                  onSuccess: () => {
                    toast.success("Product created");
                    navigate({ to: "/dashboard/inventory" });
                  },
                  onError: () => {
                    toast.success("Product created", {
                      description:
                        "Images may need to be updated manually",
                    });
                    navigate({ to: "/dashboard/inventory" });
                  },
                },
              );
            } else {
              toast.success("Product created");
              navigate({ to: "/dashboard/inventory" });
            }
          },
        },
      );
    },
  });

  const isPending = buildMutation.isPending || updateMutation.isPending;

  const handleImageUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const results = await uploadProductImages(fileList);
      if (results.length === 0) return;

      const newImages: LuluImage[] = results.map((r) => ({
        id: r.id,
        url: r.url,
        isUploaded: true,
      }));

      setImages((prev) => {
        const updated = [...prev, ...newImages];
        setThumbnailId((prevId) => prevId ?? newImages[0]!.id);
        return updated;
      });
    },
    [uploadProductImages],
  );

  const handleAddImageUrl = () => {
    const input = document.getElementById(
      "lulu-image-url-input",
    ) as HTMLInputElement | null;
    const url = input?.value?.trim();
    if (!url) return;
    const newImage: LuluImage = {
      id: `url-${Date.now()}`,
      url,
      isUploaded: false,
    };
    setImages((prev) => [...prev, newImage]);
    setThumbnailId((prevId) => prevId ?? newImage.id);
    if (input) input.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      setThumbnailId((prevId) =>
        removed?.id === prevId ? (next[0]?.id ?? null) : prevId,
      );
      return next;
    });
  };

  const handleMoveImage = (index: number, direction: "up" | "down") => {
    setImages((prev) => {
      const next = [...prev];
      if (direction === "up" && index > 0) {
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
      } else if (direction === "down" && index < next.length - 1) {
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
      }
      return next;
    });
  };

  const handlePdfUpload = (
    file: File,
    field: "coverPdfUrl" | "interiorPdfUrl",
  ) => {
    pdfUpload
      .uploadSingle(file)
      .then((result) => {
        if (result) {
          form.setFieldValue(field, result.url);
        }
      })
      .catch(() => {
        // Upload toast is handled by useFileUpload hook
      });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const interiorFileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
  }, [handleImageUpload]);

  const isValid =
    form.state.values.productName.trim() !== "" &&
    form.state.values.price !== "" &&
    parseFloat(form.state.values.price) > 0 &&
    form.state.values.podPackageId.trim() !== "" &&
    form.state.values.pageCount !== "" &&
    parseInt(form.state.values.pageCount) > 0 &&
    form.state.values.coverPdfUrl.trim() !== "" &&
    form.state.values.interiorPdfUrl.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/dashboard/inventory" })}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Create Lulu Product
          </h2>
          <p className="text-sm text-foreground/90 dark:text-muted-foreground">
            Set up your print-on-demand book or publication
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#f97316]/30 bg-[#f97316]/5 px-4 py-3 flex items-center gap-2 text-sm">
        <div
          className="size-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: "#f9731620",
            color: "#f97316",
          }}
        >
          L
        </div>
        <span className="font-medium" style={{ color: "#f97316" }}>
          Lulu
        </span>
        <span className="text-foreground/60">
          — Print-on-demand books, prints, and publications
        </span>
        <button
          type="button"
          onClick={onBack}
          className="ml-auto text-xs text-foreground/50 hover:text-foreground underline"
        >
          Change
        </button>
      </div>

      <div className="space-y-4">
        {/* Details */}
        <div className="rounded-xl border border-border/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold">Details</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>
                Product Name <span className="text-destructive">*</span>
              </Label>
              <form.Field
                name="productName"
                validators={{
                  onSubmit: ({ value }) =>
                    !value.trim() ? "Product name is required" : undefined,
                }}
              >
                {(field) => (
                  <>
                    <Input
                      id={field.name}
                      placeholder="My Book Title"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316]"
                    />
                    {field.state.meta.errors[0] && (
                      <p className="text-xs text-destructive mt-1">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </>
                )}
              </form.Field>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <form.Field name="productDescription">
                {(field) => (
                  <textarea
                    id={field.name}
                    placeholder="Describe your book..."
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm focus:border-[#f97316] focus:outline-none focus:ring-0 resize-none"
                  />
                )}
              </form.Field>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="rounded-xl border border-border/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Images</h3>
            {images.length > 0 && (
              <span className="text-xs text-foreground/50">
                {images.length} image{images.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-[#f97316] bg-[#f97316]/5"
                : "border-border/60 hover:border-[#f97316]/40",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <ImagePlus className="size-6 mx-auto mb-2 text-foreground/40" />
            <p className="text-sm text-foreground/70">
              Drop images here or click to browse
            </p>
            <p className="text-xs text-foreground/50 mt-1">PNG, JPG, WebP</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleImageUpload(e.target.files);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {imageUploading && (
            <div className="flex items-center gap-2 text-sm text-[#f97316]">
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Add by URL</Label>
              <Input
                id="lulu-image-url-input"
                placeholder="https://example.com/image.jpg"
                className="h-9 bg-background/60 border border-border/60 rounded-lg text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddImageUrl();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddImageUrl}
              className="h-9"
            >
              <Upload className="size-3.5 mr-1" />
              Add
            </Button>
          </div>

          {images.length > 0 && (
            <div className="space-y-2">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
                >
                  <img
                    src={img.url}
                    alt=""
                    className="size-12 rounded object-cover bg-muted shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate text-foreground/80">
                      {img.url.split("/").pop() || "Image"}
                    </p>
                    {img.id === thumbnailId && (
                      <span className="text-[10px] text-[#f97316] font-medium">
                        Thumbnail
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setThumbnailId(img.id)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        img.id === thumbnailId
                          ? "text-[#f97316]"
                          : "text-foreground/30 hover:text-[#f97316]",
                      )}
                      title={
                        img.id === thumbnailId
                          ? "Current thumbnail"
                          : "Set as thumbnail"
                      }
                    >
                      <Star className="size-3.5" />
                    </button>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveImage(index, "up")}
                        disabled={index === 0}
                        aria-label="Move image up"
                        className="p-0.5 text-foreground/30 hover:text-foreground/70 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="size-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveImage(index, "down")}
                        disabled={index === images.length - 1}
                        aria-label="Move image down"
                        className="p-0.5 text-foreground/30 hover:text-foreground/70 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="size-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      aria-label="Remove image"
                      className="p-1 text-foreground/30 hover:text-red-500 transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Print Config */}
        <div className="rounded-xl border border-border/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold">Print Config</h3>

          <div className="space-y-2">
            <Label>
              podPackageId <span className="text-destructive">*</span>
            </Label>
            <form.Field
              name="podPackageId"
              validators={{
                onSubmit: ({ value }) =>
                  !value.trim() ? "Pod package ID is required" : undefined,
              }}
            >
              {(field) => (
                <>
                  <Input
                    id={field.name}
                    placeholder="0600X0900BWSTDPB"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316] font-mono text-sm"
                  />
                  <p className="text-xs text-foreground/50 mt-1">
                    Lulu's print package ID (e.g.{" "}
                    <code className="text-foreground/70">
                      0600X0900BWSTDPB
                    </code>
                    )
                  </p>
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive mt-1">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Page Count <span className="text-destructive">*</span>
              </Label>
              <form.Field
                name="pageCount"
                validators={{
                  onSubmit: ({ value }) =>
                    !value || parseInt(value) <= 0
                      ? "Valid page count is required"
                      : undefined,
                }}
              >
                {(field) => (
                  <>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="120"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316]"
                    />
                    {field.state.meta.errors[0] && (
                      <p className="text-xs text-destructive mt-1">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </>
                )}
              </form.Field>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <form.Field name="format">
                {(field) => (
                  <Input
                    id={field.name}
                    placeholder="Paperback"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316]"
                  />
                )}
              </form.Field>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Cover PDF URL <span className="text-destructive">*</span>
            </Label>
            <form.Field
              name="coverPdfUrl"
              validators={{
                onSubmit: ({ value }) =>
                  !value.trim() ? "Cover PDF URL is required" : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        id={field.name}
                        placeholder="https://..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => coverFileRef.current?.click()}
                      disabled={pdfUpload.uploading}
                      className="h-9 shrink-0"
                    >
                      {pdfUpload.uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      Upload
                    </Button>
                    <input
                      ref={coverFileRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handlePdfUpload(e.target.files[0], "coverPdfUrl");
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <div className="space-y-2">
            <Label>
              Interior PDF URL <span className="text-destructive">*</span>
            </Label>
            <form.Field
              name="interiorPdfUrl"
              validators={{
                onSubmit: ({ value }) =>
                  !value.trim()
                    ? "Interior PDF URL is required"
                    : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        id={field.name}
                        placeholder="https://..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => interiorFileRef.current?.click()}
                      disabled={pdfUpload.uploading}
                      className="h-9 shrink-0"
                    >
                      {pdfUpload.uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      Upload
                    </Button>
                    <input
                      ref={interiorFileRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handlePdfUpload(
                            e.target.files[0],
                            "interiorPdfUrl",
                          );
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-xl border border-border/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold">Pricing</h3>
          <div className="space-y-2">
            <Label>
              Price (USD) <span className="text-destructive">*</span>
            </Label>
            <form.Field
              name="price"
              validators={{
                onSubmit: ({ value }) =>
                  !value || parseFloat(value) <= 0
                    ? "Valid price is required"
                    : undefined,
              }}
            >
              {(field) => (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium text-foreground/50">
                      $
                    </span>
                    <Input
                      id={field.name}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="29.99"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="max-w-[200px] bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316]"
                    />
                  </div>
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive mt-1">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </>
              )}
            </form.Field>
          </div>
        </div>

        {/* Free Download */}
        <div className="rounded-xl border border-border/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Free Download</h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={freeDownloadEnabled}
                onChange={(e) => {
                  setFreeDownloadEnabled(e.target.checked);
                  if (e.target.checked && form.state.values.interiorPdfUrl) {
                    form.setFieldValue("downloadUrl", form.state.values.interiorPdfUrl);
                  } else if (!e.target.checked) {
                    form.setFieldValue("downloadUrl", "");
                    form.setFieldValue("downloadLabel", "");
                  }
                }}
              />
              <div className="w-9 h-5 bg-border/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f97316]" />
            </label>
          </div>
          {freeDownloadEnabled && (
            <>
              <p className="text-xs text-foreground/50">
                Readers can download a free copy of the interior PDF.
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Download URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={form.state.values.interiorPdfUrl || "No interior PDF set"}
                      disabled
                      className="bg-background/30 border border-border/60 rounded-lg text-sm text-foreground/50"
                    />
                    <span className="text-xs text-foreground/50 shrink-0 whitespace-nowrap">
                      auto from interior PDF
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Button Label</Label>
                  <form.Field name="downloadLabel">
                    {(field) => (
                      <Input
                        id={field.name}
                        placeholder="Download for Free"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="bg-background/60 border border-border/60 rounded-lg focus-visible:ring-0 focus-visible:border-[#f97316]"
                      />
                    )}
                  </form.Field>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          onClick={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          disabled={!isValid || isPending}
          className="bg-[#f97316] text-white hover:bg-[#e8690c]"
        >
          {isPending ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Check className="size-4 mr-2" />
          )}
          Create Product
        </Button>
      </div>
    </div>
  );
}
