import { useSiteConfig } from "@/integrations/api/site-config";

export function MaintenanceBanner() {
  const { data } = useSiteConfig();

  if (!data?.maintenance.enabled) {
    return null;
  }

  return (
    <div className="relative z-[60] w-full bg-foreground text-background">
      <div className="container-app mx-auto px-4 md:px-8 lg:px-16 py-3 text-center text-sm font-medium">
        <p>
          Site under maintenance. Purchases are temporarily disabled — please reach out to
          support on{" "}
          <a
            href="https://t.me/nearmerch"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            Telegram
          </a>{" "}
          if issues arise.
        </p>
      </div>
    </div>
  );
}
