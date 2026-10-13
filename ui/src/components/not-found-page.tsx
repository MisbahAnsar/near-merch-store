import { Link } from "@tanstack/react-router";
import { MarketplaceFooter } from "@/components/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace-header";
import { VideoBackground } from "@/components/video-background";

export function NotFoundPage() {
  return (
    <div className="min-h-screen w-full relative bg-background">
      <MarketplaceHeader />

      <main className="border-0 relative bg-background min-h-screen pt-32 pb-16 flex items-center justify-center px-4">
        <VideoBackground />

        <div className="w-full max-w-md relative z-10">
          <div className="rounded-2xl bg-background/60 backdrop-blur-sm border border-border/60 px-6 md:px-8 py-8 md:py-10 space-y-6 text-center">
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground/90 dark:text-muted-foreground">
                404
              </h1>
              <p className="text-xl md:text-2xl font-semibold text-foreground/90 dark:text-muted-foreground">
                Page Not Found
              </p>
              <p className="text-base text-foreground/90 dark:text-muted-foreground">
                The page you're looking for doesn't exist or has been moved.
              </p>
            </div>

            <Link
              to="/"
              className="w-full bg-[#00EC97] text-black px-6 py-4 flex items-center justify-center gap-3 hover:bg-[#00d97f] transition-colors rounded-lg font-semibold"
            >
              <span className="text-sm font-medium">Go Home</span>
            </Link>
          </div>
        </div>
      </main>

      <MarketplaceFooter />
    </div>
  );
}
