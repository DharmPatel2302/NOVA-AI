import { Annotation } from "@langchain/langgraph";

/**
 * Shared LangGraph state schema for the multi-agent workflow.
 *
 * This state flows through: router → selected agent(s) → END
 * Each node reads what it needs and returns partial updates.
 */
const AgentState = Annotation.Root({
  /** The incoming user message */
  userPrompt: Annotation({
    reducer: (_, next) => next,
    default: () => "",
  }),

  /** MongoDB ObjectId of the conversation (from chat service) */
  conversationId: Annotation({
    reducer: (_, next) => next,
    default: () => "",
  }),

  /** Authenticated user's ID (forwarded from gateway via x-user-id header) */
  userId: Annotation({
    reducer: (_, next) => next,
    default: () => "",
  }),

  /** Recent message history [{role, content}] fetched from Redis/MongoDB */
  chatHistory: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  /**
   * Frontend manual agent override. null = auto-classify via router LLM.
   * One of: 'chat', 'search', 'coding', 'pdf', 'ppt', 'image', or null.
   */
  agentOverride: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Set by router node — one of: 'chat', 'search', 'coding', 'pdf', 'ppt', 'image' */
  selectedAgent: Annotation({
    reducer: (_, next) => next,
    default: () => "",
  }),

  /**
   * Refined search query produced by chat.agent.js during the search flow.
   * chat.agent.js strips conversational filler and resolves pronouns from
   * the raw userPrompt using chatHistory context.
   * Kept separate from userPrompt so the original prompt is preserved
   * for message-saving and display purposes.
   */
  refinedQuery: Annotation({
    reducer: (_, next) => next,
    default: () => "",
  }),

  /** Final agent output text — returned to the client */
  response: Annotation({
    reducer: (_, next) => next,
    default: () => "",
  }),

  /**
   * Raw search results from Tavily, kept separate from the synthesized
   * text response so the frontend can render images independently.
   * Shape: { textResults: [{title, url, content}], images: [{url}] } | null
   */
  searchResults: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Intermediate data passed between nodes in multi-hop flows.
   * Used by the search flow: chat agent → search agent.
   * Each step appends to this array.
   */
  intermediateSteps: Annotation({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** Error message for graceful error propagation through the graph */
  error: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ─── Coding Agent Fields ────────────────────────────────────────

  /**
   * Coding intent classification result.
   * One of: 'code_generation', 'code_review', 'explanation', 'debugging' | null
   */
  codingIntent: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Generated artifact files for code_generation intent.
   * Shape: [{ filename: string, language: string, content: string }] | null
   * null/empty for review/explanation/debugging intents.
   */
  artifactFiles: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Short project title derived from the user's prompt (e.g. "Calculator App").
   * Used as the Artifact panel header and stored on the message record.
   */
  artifactTitle: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ─── Image Agent Fields ─────────────────────────────────────────

  /** Groq-refined image prompt (falls back to raw userPrompt if refinement fails) */
  refinedImagePrompt: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Permanent Cloudinary URL for the generated image (no expiry, no refresh needed) */
  generatedImageUrl: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Cloudinary public_id for the generated image (needed for deletion) */
  generatedImagePublicId: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ─── PDF Agent Fields ──────────────────────────────────────────

  /**
   * Structured content from the LLM, before rendering.
   * Shape: { title: string, subtitle: string|null, sections: [{heading, content, bullets}] }
   */
  pdfContent: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Permanent Cloudinary URL for the generated PDF (no expiry, no refresh needed) */
  generatedPdfUrl: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Cloudinary public_id for the generated PDF (needed for deletion) */
  generatedPdfPublicId: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Document title for display + download filename */
  pdfTitle: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ─── PPT Agent Fields ──────────────────────────────────────────

  /**
   * Structured content from the LLM, before rendering.
   * Shape: { title: string, subtitle: string|null, slides: [{heading, bullets, content}] }
   */
  pptContent: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Permanent Cloudinary URL for the generated PPT (no expiry, no refresh needed) */
  generatedPptUrl: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Cloudinary public_id for the generated PPT (needed for deletion) */
  generatedPptPublicId: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Presentation title for display + download filename */
  pptTitle: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ─── Credit System Fields ────────────────────────────────────────

  /** Flag set by creditCheckNode if pre-execution credit check fails */
  creditCheckFailed: Annotation({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // ─── File Attachment Fields (Hidden Agents) ─────────────────────

  /**
   * Attached file metadata from multer (req.file).
   * Shape: { path: string, mimetype: string, originalname: string } | null
   * Populated by the controller when a file is uploaded with the request.
   */
  attachedFile: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Derived file type from attachedFile.mimetype.
   * 'image' for image/*, 'pdf' for application/pdf, null when no file attached.
   * Used by the router to auto-route to hidden agents (imageAnalyzer, pdfRag).
   */
  fileType: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Retrieved chunk text from Qdrant similarity search (PDF RAG flow).
   * Kept separate from chatHistory so the RAG context is clearly delineated
   * in the pdfRag agent's final prompt construction.
   */
  ragContext: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ─── Short-Circuit Control Fields ─────────────────────────────────

  /**
   * Flag set by the router when it produces a direct, trivial response
   * (e.g. "please re-attach your file") that requires no LLM/agent work.
   * When true, the controller skips post-execution credit deduction.
   */
  skipCredits: Annotation({
    reducer: (_, next) => next,
    default: () => false,
  }),
});

export default AgentState;
