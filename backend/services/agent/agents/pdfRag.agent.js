import fs from "fs";
import crypto from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { ragModel } from "../config/llmModel.js";
import { getVectorStoreForConversation } from "../config/vectorDb.js";

/**
 * PDF RAG Agent — processes uploaded documents and handles RAG queries.
 *
 * Pipeline:
 * 1. Ingest PDF if attached (read -> parse -> chunk -> embed & store in Qdrant).
 * 2. Connect to Qdrant collection for conversation.
 * 3. Retrieve relevant context (using scroll points for vague queries like "what is this", or vector similarity search).
 * 4. Generate grounded LLM response using retrieved context.
 */
export const pdfRagAgent = async (state) => {
  let filePath = state.attachedFile?.path;
  let vectorStore;

  try {
    vectorStore = await getVectorStoreForConversation(state.conversationId);

    // ─── STEP 1: Parse & Ingest attached file ──────────────────────
    if (filePath) {
      let parsedText;
      try {
        const buffer = await fs.promises.readFile(filePath);
        const parsed = await pdfParse(buffer);
        parsedText = parsed.text;
      } catch (parseErr) {
        console.error("[PdfRag] PDF parsing failed:", parseErr.message);
        return {
          response: "I couldn't read this PDF file — it may be corrupted or password-protected. Please try a different file.",
        };
      }

      if (!parsedText || parsedText.trim().length === 0) {
        return {
          response: "This PDF contains no extractable text (it might be a scanned image). Text extraction from scanned images isn't supported yet.",
        };
      }

      console.log(`[PdfRag] Ingesting PDF: "${state.attachedFile.originalname}" (${parsedText.length} chars)`);

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 150,
      });
      const chunks = await splitter.splitText(parsedText);
      console.log(`[PdfRag] Split into ${chunks.length} chunks.`);

      const documents = chunks.map((chunk, index) => {
        const id = crypto
          .createHash("md5")
          .update(`${state.attachedFile.originalname}-${index}-${chunk}`)
          .digest("hex");

        return new Document({
          pageContent: chunk,
          metadata: {
            conversationId: state.conversationId,
            filename: state.attachedFile.originalname,
            chunkIndex: index,
            _qdrantPointId: id,
          },
        });
      });

      const ids = documents.map((d) => d.metadata._qdrantPointId);
      await vectorStore.addDocuments(documents, { ids });
      console.log(`[PdfRag] Upserted ${documents.length} chunks into Qdrant for conversation ${state.conversationId}`);
    }

    // ─── STEP 2: Smart Query & Context Retrieval ───────────────────
    const rawPrompt = (state.userPrompt || "").trim();
    const lowerPrompt = rawPrompt.toLowerCase();

    // Detect vague / broad queries like "what is this", "waht is this", "?", "summarize"
    const isVagueQuery =
      !rawPrompt ||
      rawPrompt === "?" ||
      rawPrompt.length < 12 ||
      lowerPrompt.includes("what is this") ||
      lowerPrompt.includes("waht is this") ||
      lowerPrompt.includes("summarize") ||
      lowerPrompt.includes("summary") ||
      lowerPrompt.includes("overview") ||
      lowerPrompt.includes("tell me about") ||
      lowerPrompt.includes("explain this");

    let retrievedDocs = [];

    if (isVagueQuery) {
      console.log("[PdfRag] Vague or overview query detected — combining leading scroll chunks + broad search.");
      const scrollDocs = await vectorStore.getScrollPoints(6);
      const semanticDocs = await vectorStore.similaritySearch("overview summary background key details document resume report", 4);

      // Deduplicate retrieved chunks
      const seen = new Set();
      for (const doc of [...scrollDocs, ...semanticDocs]) {
        if (doc && doc.pageContent && !seen.has(doc.pageContent)) {
          seen.add(doc.pageContent);
          retrievedDocs.push(doc);
        }
      }
    } else {
      console.log(`[PdfRag] Performing similarity search for query: "${rawPrompt}"`);
      retrievedDocs = await vectorStore.similaritySearch(rawPrompt, 6);
    }

    if (retrievedDocs.length === 0) {
      return {
        response: "I don't have any document content available to answer your question. Please try uploading a PDF file.",
      };
    }

    const ragContext = retrievedDocs
      .map((doc, i) => `--- CHUNK ${i + 1} (${doc.metadata?.filename || "Document"}) ---\n${doc.pageContent}`)
      .join("\n\n");

    console.log(`[PdfRag] Assembled ${retrievedDocs.length} chunks for LLM context.`);

    // ─── STEP 3: LLM Response Generation ──────────────────────────
    const docFilename =
      state.attachedFile?.originalname ||
      retrievedDocs[0]?.metadata?.filename ||
      "Uploaded Document";

    const systemPrompt = `You are a professional document analysis AI assistant. You have full access to the context of the document "${docFilename}" attached by the user.

RULES:
1. Ground your answer in the provided document context below.
2. If the user asks "what is this", "waht is this", "?", or asks for a summary/overview, provide a clear, structured breakdown:
   - Identify what the document is (e.g. Candidate Resume, Financial Report, Technical Specification, Invoice, etc.).
   - Who or what it is about (e.g. candidate name, company, project).
   - Key highlights, skills, experience, or major findings.
3. Be direct, helpful, and use markdown formatting (headings, bold text, bullet points).
4. Do NOT claim you lack context — the document text IS provided below.`;

    const humanPrompt = `DOCUMENT CONTEXT:\n${ragContext}\n\nUSER QUESTION:\n${rawPrompt || "What is this document about?"}`;

    const result = await ragModel.invoke([
      { role: "system", content: systemPrompt },
      { role: "human", content: humanPrompt },
    ]);

    return {
      response: result.content || "I couldn't generate a response for your document query.",
      ragContext,
    };
  } catch (error) {
    console.error("[PdfRag] Unexpected error:", error.message);
    return {
      response: "Something went wrong while analyzing your document. Please try again.",
      error: error.message,
    };
  } finally {
    if (filePath) {
      try {
        await fs.promises.unlink(filePath);
        console.log(`[PdfRag] Cleaned up temp upload: ${filePath}`);
      } catch (cleanupErr) {
        console.warn(`[PdfRag] Failed to delete temp file: ${cleanupErr.message}`);
      }
    }
  }
};
