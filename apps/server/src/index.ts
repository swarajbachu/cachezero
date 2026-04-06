import { serve } from "@hono/node-server";
import { app } from "./routes.js";
import { DEFAULT_PORT } from "@cachezero/shared";
import { getConfig } from "./services/config.js";

const config = getConfig();
const port = config.server_port ?? DEFAULT_PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`CacheZero server running at http://localhost:${info.port}`);
});
