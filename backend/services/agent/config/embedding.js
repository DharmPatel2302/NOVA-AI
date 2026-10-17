import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/**
 * Google Generative AI Embeddings — reuses the existing GOOGLE_API_KEY.
 *
 * Model: text-embedding-004
 * Output dimension: 768 (default for this model)
 *
 * Used for both ingesting PDF chunks into Qdrant and querying at retrieval time.
 */
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "text-embedding-004",
});

export default embeddings;
