import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from "crypto";
import embeddings from "./embedding.js";

// ─── Validate required env vars at module load ──────────────────────
if (!process.env.QDRANT_API_KEY) {
  throw new Error("[VectorDB] QDRANT_API_KEY is required but not set in .env");
}
if (!process.env.QDRANT_ENDPOINT) {
  throw new Error("[VectorDB] QDRANT_ENDPOINT is required but not set in .env");
}

/**
 * Qdrant REST client — connects to Qdrant Cloud.
 */
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_ENDPOINT,
  apiKey: process.env.QDRANT_API_KEY,
});

/**
 * VECTOR_SIZE must match the embedding model's output dimensions exactly.
 * text-embedding-004 produces 768-dimensional vectors.
 */
const VECTOR_SIZE = 768;

/**
 * Custom QdrantVectorStore built on @langchain/core and @qdrant/js-client-rest.
 */
export class CustomQdrantVectorStore extends VectorStore {
  _vectorstoreType() {
    return "qdrant";
  }

  constructor(embeddings, args) {
    super(embeddings, args);
    this.client = args.client;
    this.collectionName = args.collectionName;
  }

  async addVectors(vectors, documents, documentOptions) {
    if (vectors.length === 0) return;

    const points = vectors.map((embedding, idx) => {
      const pointId =
        documentOptions?.ids?.[idx] ||
        documents[idx].metadata?._qdrantPointId ||
        crypto.randomUUID();

      return {
        id: pointId,
        vector: embedding,
        payload: {
          content: documents[idx].pageContent,
          metadata: documents[idx].metadata || {},
        },
      };
    });

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });
    } catch (err) {
      console.error(`[VectorDB] Upsert to "${this.collectionName}" failed:`, err.message);
      throw err;
    }
  }

  async addDocuments(documents, documentOptions) {
    const texts = documents.map(({ pageContent }) => pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    await this.addVectors(vectors, documents, documentOptions);
  }

  async similaritySearchVectorWithScore(queryVector, k = 6, filter) {
    if (!queryVector || queryVector.length === 0) return [];

    try {
      const res = await this.client.query(this.collectionName, {
        query: queryVector,
        limit: k,
        filter,
        with_payload: ["metadata", "content"],
        with_vector: false,
      });

      return (res.points || []).map((point) => [
        new Document({
          id: String(point.id),
          metadata: point.payload?.metadata || {},
          pageContent: point.payload?.content || "",
        }),
        point.score,
      ]);
    } catch (err) {
      console.error(`[VectorDB] Similarity search in "${this.collectionName}" failed:`, err.message);
      throw err;
    }
  }

  async similaritySearch(query, k = 6, filter) {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const results = await this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
    return results.map(([doc]) => doc);
  }

  /**
   * Scroll leading points directly from Qdrant without requiring vector similarity.
   * Crucial for vague/overview questions like "what is this", "summarize", "?".
   */
  async getScrollPoints(limit = 6) {
    try {
      const res = await this.client.scroll(this.collectionName, {
        limit,
        with_payload: ["metadata", "content"],
        with_vector: false,
      });

      return (res.points || []).map((point) => new Document({
        id: String(point.id),
        metadata: point.payload?.metadata || {},
        pageContent: point.payload?.content || "",
      }));
    } catch (err) {
      console.error(`[VectorDB] Scroll points failed for "${this.collectionName}":`, err.message);
      return [];
    }
  }
}

/**
 * Checks if a conversation has an active Qdrant collection with ingested documents.
 */
export const hasDocumentsForConversation = async (conversationId) => {
  if (!conversationId) return false;
  const sanitized = String(conversationId).replace(/[^a-zA-Z0-9_]/g, "_");
  const collectionName = `pdf_docs_${sanitized}`;

  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);
    if (!exists) return false;

    const countRes = await qdrantClient.count(collectionName);
    return (countRes.count || 0) > 0;
  } catch (err) {
    return false;
  }
};

/**
 * Returns a CustomQdrantVectorStore instance scoped to a specific conversation.
 */
export const getVectorStoreForConversation = async (conversationId) => {
  const sanitized = String(conversationId).replace(/[^a-zA-Z0-9_]/g, "_");
  const collectionName = `pdf_docs_${sanitized}`;

  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);

    if (!exists) {
      await qdrantClient.createCollection(collectionName, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      console.log(`[VectorDB] Created new collection: "${collectionName}"`);
    }
  } catch (err) {
    console.error(`[VectorDB] Collection check/create failed for "${collectionName}":`, err.message);
    throw err;
  }

  return new CustomQdrantVectorStore(embeddings, {
    client: qdrantClient,
    collectionName,
  });
};

/**
 * Deletes the Qdrant collection associated with a conversation (if it exists).
 */
export const deleteQdrantCollectionForConversation = async (conversationId) => {
  if (!conversationId) return;
  const sanitized = String(conversationId).replace(/[^a-zA-Z0-9_]/g, "_");
  const collectionName = `pdf_docs_${sanitized}`;

  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);
    if (exists) {
      await qdrantClient.deleteCollection(collectionName);
      console.log(`[VectorDB] Deleted Qdrant collection: "${collectionName}"`);
    }
  } catch (err) {
    console.error(`[VectorDB] Failed to delete collection "${collectionName}":`, err.message);
  }
};
