import { z } from "zod";

export const contentTypes = ["tweet", "linkedin", "article", "youtube", "other"] as const;

export const ContentTypeSchema = z.enum(contentTypes);

/** Schema for creating a new bookmark via the API */
export const CreateBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  contentType: ContentTypeSchema.default("other"),
  textContent: z.string().min(1),
  author: z.string().optional(),
  authorUrl: z.string().url().optional(),
  publishedDate: z.string().optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateBookmarkInput = z.infer<typeof CreateBookmarkSchema>;

/** Schema for search queries */
export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().default(10),
  contentType: ContentTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;


/** Schema for the config file */
export const ConfigSchema = z.object({
  gemini_api_key: z.string().optional(),
  server_port: z.number().default(3777),
  vault_dir: z.string().default("~/.cachezero/vault"),
  index_dir: z.string().default("~/.cachezero/index"),
});

export type Config = z.infer<typeof ConfigSchema>;
