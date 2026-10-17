import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Send,
  Paperclip,
  Mic,
  Sparkles,
  MessageCircle,
  Globe,
  Code2,
  FileText,
  Presentation,
  ImageIcon,
  X,
  Upload,
} from "lucide-react";
import { addMessage, setSending, setActiveArtifact } from "../redux/messageSlice";
import {
  addConversation,
  setActiveConversation,
  updateConvoTitleInStore,
} from "../redux/conversationSlice";
import { sendMessage } from "../features/sendMessage";
import { createConversation } from "../features/createConversation";
import { updateConversationTitle } from "../features/updateConversation";
import { updateUserCredits } from "../redux/userSlice";

/**
 * Agent selector pill definitions.
 * 'auto' maps to null in the payload (router LLM decides).
 * All others map to their string value.
 */
const AGENT_OPTIONS = [
  { key: "auto", label: "Auto", icon: Sparkles },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "search", label: "Search", icon: Globe },
  { key: "coding", label: "Coding", icon: Code2 },
  { key: "pdf", label: "PDF", icon: FileText },
  { key: "ppt", label: "PPT", icon: Presentation },
  { key: "image", label: "Image", icon: ImageIcon },
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB — matches backend multer limit

/**
 * Generate a clean conversation title from the user's first message.
 */
const generateTitle = (text) => {
  const cleanText = text.trim().replace(/\s+/g, " ");
  if (cleanText.length <= 40) return cleanText;
  const sliced = cleanText.slice(0, 40);
  const lastSpaceIndex = sliced.lastIndexOf(" ");
  if (lastSpaceIndex > 0) return sliced.slice(0, lastSpaceIndex) + "…";
  return sliced + "…";
};

/**
 * Chat input with agent selector pills, file attachment, textarea, and send button.
 */
const ChatInput = ({ draftMessage, setDraftMessage }) => {
  const dispatch = useDispatch();
  const { activeConversationId, conversations } = useSelector(
    (state) => state.conversation
  );
  const { sending } = useSelector((state) => state.message);

  // Transient UI state — resets to 'auto' after each send
  const [selectedAgentMode, setSelectedAgentMode] = useState("auto");

  // File attachment state
  const [attachedFile, setAttachedFile] = useState(null); // File object | null
  const [attachedFilePreviewUrl, setAttachedFilePreviewUrl] = useState(null); // object URL for image thumbnails
  const [fileError, setFileError] = useState(null); // inline error message
  const fileInputRef = useRef(null);

  // ─── Voice Input State & Ref ────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const isSpeechSupported = !!SpeechRecognition;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore cleanup stop errors
        }
      }
    };
  }, []);

  const handleMicClick = () => {
    if (!isSpeechSupported) return;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setDraftMessage((prev) => {
            if (!prev) return transcript;
            return prev.endsWith(" ") ? prev + transcript : prev + " " + transcript;
          });
        }
      };

      recognition.onerror = (event) => {
        console.error("[VoiceInput] Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "permission-denied") {
          setSpeechError("Microphone access denied — check browser permissions");
          setTimeout(() => setSpeechError(null), 4000);
        } else if (event.error !== "no-speech") {
          setSpeechError("Voice input failed — please try again");
          setTimeout(() => setSpeechError(null), 4000);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[VoiceInput] Failed to start speech recognition:", err);
      setSpeechError("Voice input failed to start");
      setTimeout(() => setSpeechError(null), 4000);
      setIsListening(false);
    }
  };

  // Send is allowed if EITHER text OR file is present
  const canSend = (draftMessage.trim().length > 0 || attachedFile !== null) && !sending;

  // Whether a file is attached — used to dim agent selector
  const hasFileAttached = attachedFile !== null;

  // ─── File Selection Handler ─────────────────────────────────────
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be re-selected after removal
    event.target.value = "";

    // Client-side validation: mimetype
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setFileError("Only image and PDF files are supported");
      setTimeout(() => setFileError(null), 3000);
      return;
    }

    // Client-side validation: size
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File too large — maximum size is 15MB");
      setTimeout(() => setFileError(null), 3000);
      return;
    }

    setFileError(null);
    setAttachedFile(file);

    // Generate preview URL for images
    if (file.type.startsWith("image/")) {
      setAttachedFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setAttachedFilePreviewUrl(null);
    }
  };

  // ─── Remove Attached File ───────────────────────────────────────
  const removeAttachedFile = () => {
    if (attachedFilePreviewUrl) {
      URL.revokeObjectURL(attachedFilePreviewUrl);
    }
    setAttachedFile(null);
    setAttachedFilePreviewUrl(null);
    setFileError(null);
  };

  // ─── Send Handler ───────────────────────────────────────────────
  const handleSend = async () => {
    if (!canSend) return;

    const messageText = draftMessage.trim();
    let conversationId = activeConversationId;
    let isNewConvo = false;

    // Auto-create conversation if user types directly without "New Chat"
    if (!conversationId) {
      try {
        const newConvo = await createConversation();
        dispatch(addConversation(newConvo));
        dispatch(setActiveConversation(newConvo._id));
        conversationId = newConvo._id;
        isNewConvo = true;
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return;
      }
    }

    const currentConvo = conversations.find((c) => c._id === conversationId);
    const isDefaultTitle =
      isNewConvo ||
      (currentConvo ? currentConvo.title === "New Conversation" : true);

    // Capture the agent override before resetting
    const agentOverride =
      selectedAgentMode === "auto" ? null : selectedAgentMode;

    // Reset to auto after send
    setSelectedAgentMode("auto");

    // Capture attachment info for optimistic message display
    const currentAttachedFile = attachedFile;
    const currentPreviewUrl = attachedFilePreviewUrl;
    const attachmentName = currentAttachedFile?.name || null;
    const attachmentType = currentAttachedFile
      ? currentAttachedFile.type.startsWith("image/")
        ? "image"
        : "pdf"
      : null;

    // Optimistic UI: show user message immediately
    dispatch(
      addMessage({
        role: "user",
        content: messageText,
        createdAt: new Date().toISOString(),
        attachmentName,
        attachmentType,
        attachmentPreviewUrl: currentPreviewUrl || null,
      })
    );

    // Clear input and file immediately
    setDraftMessage("");
    setAttachedFile(null);
    setAttachedFilePreviewUrl(null);
    // Don't revoke the object URL here — the optimistic message still uses it

    // Call agent service
    dispatch(setSending(true));
    try {
      const result = await sendMessage({
        conversationId,
        userPrompt: messageText,
        agentOverride,
        attachedFile: currentAttachedFile,
      });

      // Update user credits in Redux store if returned
      if (typeof result.remainingCredits === "number") {
        dispatch(updateUserCredits(result.remainingCredits));
      }

      dispatch(
        addMessage({
          role: "assistant",
          content: result.response,
          createdAt: new Date().toISOString(),
          searchImages: result.searchImages || [],
          artifactTitle: result.artifactTitle || null,
          artifactFiles: result.artifactFiles || [],
          generatedImageUrl: result.generatedImageUrl || null,
          generatedPdfUrl: result.generatedPdfUrl || null,
          pdfTitle: result.pdfTitle || null,
          generatedPptUrl: result.generatedPptUrl || null,
          pptTitle: result.pptTitle || null,
        })
      );

      // Auto-open Artifact panel if a new code artifact was generated
      if (result.artifactFiles && Array.isArray(result.artifactFiles) && result.artifactFiles.length > 0) {
        dispatch(
          setActiveArtifact({
            title: result.artifactTitle || "Code Artifact",
            files: result.artifactFiles,
          })
        );
      }

      // Trigger title update if needed
      if (isDefaultTitle && messageText) {
        const generatedTitle = generateTitle(messageText);
        updateConversationTitle({ conversationId, title: generatedTitle })
          .then(() => {
            dispatch(
              updateConvoTitleInStore({ conversationId, title: generatedTitle })
            );
          })
          .catch((err) => {
            console.error("Failed to update conversation title:", err);
          });
      }
    } catch (err) {
      console.error("Agent service error:", err);
      dispatch(
        addMessage({
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        })
      );
    } finally {
      dispatch(setSending(false));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="px-4 md:px-6 py-3"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <div className="max-w-3xl mx-auto">
        {/* ─── Agent Selector Pills ──────────────────────────────── */}
        <div
          className="flex gap-1.5 mb-2 overflow-x-auto items-center agent-pills-container"
          style={{
            scrollbarWidth: "none",
            opacity: hasFileAttached ? 0.4 : 1,
            pointerEvents: hasFileAttached ? "none" : "auto",
            transition: "opacity 0.2s",
          }}
        >
          {AGENT_OPTIONS.map((agent) => {
            const isActive = selectedAgentMode === agent.key;
            return (
              <button
                key={agent.key}
                onClick={() => setSelectedAgentMode(agent.key)}
                className="flex items-center gap-1.5 rounded-full cursor-pointer flex-shrink-0"
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--text-muted)",
                  border: isActive
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border-subtle)",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--bg-hover)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                    e.currentTarget.style.borderColor = "var(--border-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }
                }}
              >
                <agent.icon size={13} />
                <span className="agent-pill-label">{agent.label}</span>
              </button>
            );
          })}

          {/* Auto-routing indicator when file is attached */}
          {hasFileAttached && (
            <span
              className="flex items-center gap-1 text-xs flex-shrink-0 ml-1"
              style={{ color: "var(--accent)", fontWeight: 500, pointerEvents: "auto", opacity: 2.5 }}
            >
              <Upload size={11} />
              Auto-routing based on attachment
            </span>
          )}
        </div>

        {/* ─── Inline voice error notification */}
        {speechError && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.2)",
              color: "var(--danger)",
            }}
          >
            <span>{speechError}</span>
          </div>
        )}

        {/* ─── File Error Message ──────────────────────────────── */}
        {fileError && (
          <div
            className="mb-2 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: "rgba(231, 76, 92, 0.1)",
              color: "var(--danger)",
              border: "1px solid rgba(231, 76, 92, 0.2)",
            }}
          >
            {fileError}
          </div>
        )}

        {/* ─── Attachment Preview Chip ─────────────────────────── */}
        {attachedFile && (
          <div
            className="flex items-center gap-3 mb-2 px-3 py-2 rounded-xl"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Thumbnail or icon */}
            {attachedFilePreviewUrl ? (
              <img
                src={attachedFilePreviewUrl}
                alt="Preview"
                className="rounded-lg flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                className="rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  background: "rgba(220, 38, 38, 0.1)",
                }}
              >
                <FileText size={22} style={{ color: "#DC2626" }} />
              </div>
            )}

            {/* Filename */}
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {attachedFile.name}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {attachedFile.type.startsWith("image/") ? "Image" : "PDF"} •{" "}
                {(attachedFile.size / 1024).toFixed(0)} KB
              </div>
            </div>

            {/* Remove button */}
            <button
              onClick={removeAttachedFile}
              className="flex items-center justify-center rounded-lg p-1.5 flex-shrink-0 cursor-pointer"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                transition: "color 0.2s, background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--danger)";
                e.currentTarget.style.background = "rgba(231, 76, 92, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
              title="Remove attachment"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ─── Input Area ────────────────────────────────────────── */}
        <div
          className="flex items-end gap-2 rounded-2xl"
          style={{
            padding: "8px 8px 8px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
            style={{
              width: "32px",
              height: "32px",
              background: hasFileAttached ? "var(--accent-muted)" : "transparent",
              border: "none",
              color: hasFileAttached ? "var(--accent)" : "var(--text-muted)",
              transition: "color 0.2s, background 0.2s",
              marginBottom: "2px",
            }}
            onMouseEnter={(e) => {
              if (!hasFileAttached) {
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!hasFileAttached) {
                e.currentTarget.style.color = "var(--text-muted)";
              }
            }}
            title="Attach image or PDF"
          >
            <Paperclip size={16} />
          </button>

          {/* Textarea */}
          <textarea
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasFileAttached ? "Add a question about your file (optional)…" : "Ask me anything..."}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none custom-scrollbar"
            style={{
              color: "var(--text-primary)",
              border: "none",
              fontSize: "13.5px",
              lineHeight: "1.5",
              maxHeight: "120px",
              minHeight: "24px",
              padding: "10px 0",
            }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onFocus={(e) => {
              e.target.closest("[style]").style.borderColor = "var(--accent)";
              e.target.closest("[style]").style.boxShadow =
                "0 0 0 3px var(--accent-muted)";
            }}
            onBlur={(e) => {
              e.target.closest("[style]").style.borderColor =
                "var(--border-subtle)";
              e.target.closest("[style]").style.boxShadow = "none";
            }}
          />

          {/* Mic voice input button */}
          <button
            className={`flex items-center justify-center rounded-lg flex-shrink-0 ${
              isListening ? "animate-pulse-mic cursor-pointer" : isSpeechSupported ? "cursor-pointer" : "opacity-40 cursor-not-allowed"
            }`}
            style={{
              width: "32px",
              height: "32px",
              background: isListening ? "rgba(231, 76, 92, 0.2)" : "transparent",
              border: isListening ? "1px solid var(--danger)" : "none",
              color: isListening ? "var(--danger)" : "var(--text-muted)",
              transition: "all 0.2s",
              marginBottom: "2px",
            }}
            onMouseEnter={(e) => {
              if (!isListening && isSpeechSupported) {
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isListening && isSpeechSupported) {
                e.currentTarget.style.color = "var(--text-muted)";
              }
            }}
            title={
              !isSpeechSupported
                ? "Voice input isn't supported in this browser"
                : isListening
                ? "Click to stop recording"
                : "Click to record voice prompt"
            }
            onClick={handleMicClick}
            disabled={!isSpeechSupported}
          >
            <Mic size={16} />
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center justify-center rounded-xl cursor-pointer flex-shrink-0"
            style={{
              width: "36px",
              height: "36px",
              background: canSend ? "var(--accent)" : "var(--bg-hover)",
              color: canSend ? "#FFFFFF" : "var(--text-muted)",
              border: "none",
              transition:
                "background 0.2s, transform 0.1s, opacity 0.2s",
              opacity: canSend ? 1 : 0.4,
              marginBottom: "2px",
            }}
            onMouseEnter={(e) => {
              if (canSend)
                e.currentTarget.style.background = "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              if (canSend)
                e.currentTarget.style.background = "var(--accent)";
            }}
            onMouseDown={(e) => {
              if (canSend)
                e.currentTarget.style.transform = "scale(0.93)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            title="Send message"
          >
            <Send size={16} />
          </button>
        </div>

        <p
          className="text-center mt-2"
          style={{ fontSize: "10px", color: "var(--text-faint)" }}
        >
          Nova may produce inaccurate information. Verify important facts.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
