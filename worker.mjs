// The Worker's entry (`main` in wrangler.jsonc). Requests go to the handler OpenNext
// generates at build time; the nightly Cron Trigger starts the demo over.
//
// Plain JavaScript on purpose: `.open-next/worker.js` exists only after a build, so a
// TypeScript entry couldn't be type-checked in CI. Everything with logic in it is typed
// and tested in src/seed/.
import openNext from "./.open-next/worker.js";
import { resetDemo } from "./src/seed/reset.ts";

const worker = {
  fetch: openNext.fetch,

  /** @param {ScheduledController} controller @param {CloudflareEnv} env @param {ExecutionContext} ctx */
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      resetDemo(env.DB, new Date(controller.scheduledTime)).then(({ anchor, statements, ms }) =>
        console.log(`Demo reset to ${anchor.toISOString()}: ${statements} statements in ${ms} ms`),
      ),
    );
  },
};

export default worker;
