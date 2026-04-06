import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "CacheZero",
    description: "Bookmark anything to your AI-powered second brain",
    permissions: ["activeTab", "storage"],
    host_permissions: ["http://localhost:3777/*"],
  },
});
