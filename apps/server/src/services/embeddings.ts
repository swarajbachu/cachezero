import { GoogleGenerativeAI } from "@google/generative-ai";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@cachezero/shared";
import { getConfig } from "./config.js";

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (genAI) return genAI;
  const config = getConfig();
  const key = config.gemini_api_key;
  if (!key) {
    throw new Error(
      "No Gemini API key configured. Run `cachezero init` or set gemini_api_key in ~/.cachezero/config.json"
    );
  }
  genAI = new GoogleGenerativeAI(key);
  return genAI;
}

/** Generate an embedding vector for a single text string */
export async function embed(text: string): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/** Generate embeddings for multiple texts in a single batch */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.batchEmbedContents({
    requests: texts.map((text) => ({
      content: { parts: [{ text }], role: "user" },
    })),
  });
  return result.embeddings.map((e) => e.values);
}

/** Check if the embedding service is available */
export async function checkEmbeddingHealth(): Promise<boolean> {
  try {
    const vec = await embed("test");
    return vec.length === EMBEDDING_DIMENSIONS;
  } catch {
    return false;
  }
}
