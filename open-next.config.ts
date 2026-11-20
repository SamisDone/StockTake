import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Anything that reads the session or the database renders per request, so there is
// nothing to revalidate. Prerendered shells (the marketing page, PPR shells) are
// served read-only from Workers static assets, which needs no R2 bucket.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
