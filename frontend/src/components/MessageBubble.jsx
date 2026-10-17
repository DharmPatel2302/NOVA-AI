import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../context/ThemeContext";
import { Bot, User, Copy, Check, ImageOff, X, FileText, Download, Presentation, Paperclip, ImageIcon } from "lucide-react";

/**
 * CopyButton — overlays top-right of code blocks.
 * Shows Copy icon, swaps to Check for 2 seconds on success.
 */
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-HTTPS contexts
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md cursor-pointer"
      style={{
        position: "absolute",
        top: "8px",
        right: "8px",
        padding: "4px 8px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: copied ? "var(--success)" : "var(--text-muted)",
        fontSize: "11px",
        transition: "color 0.2s, background 0.2s",
        zIndex: 2,
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.background = "rgba(255,255,255,0.14)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      title={copied ? "Copied!" : "Copy code"}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
};

/**
 * ImageLightbox — minimal fullscreen overlay for viewing images.
 * Reused by both SearchImageStrip and GeneratedImageBlock.
 * Click outside or X button to close.
 */
const ImageLightbox = ({ src, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      cursor: "pointer",
    }}
  >
    <button
      onClick={onClose}
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        background: "rgba(255,255,255,0.1)",
        border: "none",
        borderRadius: "50%",
        width: "36px",
        height: "36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      <X size={20} />
    </button>
    <img
      src={src}
      alt="Generated image"
      onClick={(e) => e.stopPropagation()}
      style={{
        maxWidth: "90vw",
        maxHeight: "90vh",
        borderRadius: "8px",
        objectFit: "contain",
        cursor: "default",
      }}
    />
  </div>
);

/**
 * SearchImageStrip — horizontally scrollable row of search result images.
 * Only rendered when searchImages.length > 0.
 */
const SearchImageStrip = ({ images }) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [failedUrls, setFailedUrls] = useState(new Set());

  const visibleImages = images.filter((img) => !failedUrls.has(img.url));

  if (visibleImages.length === 0) return null;

  return (
    <>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
      <div
        className="flex gap-2 overflow-x-auto mt-3 pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {visibleImages.map((img, i) => (
          <img
            key={i}
            src={img.url}
            alt={img.description || "Search result image"}
            loading="lazy"
            onClick={() => setLightboxSrc(img.url)}
            onError={() => {
              setFailedUrls((prev) => new Set(prev).add(img.url));
            }}
            className="flex-shrink-0 cursor-pointer"
            style={{
              height: "120px",
              width: "auto",
              minWidth: "120px",
              maxWidth: "200px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              transition: "transform 0.15s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          />
        ))}
      </div>
    </>
  );
};

/**
 * GeneratedImageBlock — renders a prominent AI-generated image with
 * click-to-lightbox and hover-to-download functionality.
 * Reuses the shared ImageLightbox component.
 */
const GeneratedImageBlock = ({ imageUrl }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation(); // Prevent lightbox from opening
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nova-generated-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Direct blob download failed (CORS or network issue), opening in new tab:", err);
      // Fallback: Open presigned URL directly in new tab so user can view/save
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  if (failed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "14px 16px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-muted)",
          fontSize: "13px",
          marginTop: "12px",
          maxWidth: "512px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ImageOff size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
            Image preview expired
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.5" }}>
          The secure preview link has timed out. Click below to reload and refresh the image.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            alignSelf: "flex-start",
            marginTop: "4px",
            padding: "4px 10px",
            background: "var(--accent-muted)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "6px",
            color: "var(--accent)",
            fontSize: "12px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Reload Image
        </button>
      </div>
    );
  }

  return (
    <>
      {lightboxOpen && (
        <ImageLightbox src={imageUrl} onClose={() => setLightboxOpen(false)} />
      )}
      <div
        style={{
          position: "relative",
          marginTop: "12px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--border-subtle)",
          cursor: "pointer",
          maxWidth: "512px",
          transition: "border-color 0.2s, box-shadow 0.3s",
          ...(hovered
            ? {
                borderColor: "var(--accent)",
                boxShadow: "0 4px 24px rgba(108, 92, 231, 0.2)",
              }
            : {}),
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src={imageUrl}
          alt="AI-generated image"
          loading="lazy"
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            display: "block",
            borderRadius: "11px",
          }}
        />
        {/* Download overlay — appears on hover */}
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.2s",
            pointerEvents: hovered ? "auto" : "none",
          }}
        >
          <button
            onClick={handleDownload}
            title="Download image"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(108, 92, 231, 0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.7)";
            }}
          >
            <Download size={14} />
            <span>{downloading ? "Saving…" : "Download"}</span>
          </button>
        </div>
      </div>
      {/* User-friendly caption below image */}
      <div
        style={{
          marginTop: "6px",
          fontSize: "11px",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <span>✨ Click image to view full size • Hover to save</span>
      </div>
    </>
  );
};

/**
 * CodeBlock component for ReactMarkdown with theme-aware syntax highlighting.
 */
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const { theme } = useTheme();
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");

  // Fenced code block with language → syntax highlighted
  if (!inline && match) {
    return (
      <div style={{ position: "relative", margin: "12px 0" }}>
        {/* Language badge */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "12px",
            fontSize: "10px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            zIndex: 2,
          }}
        >
          {match[1]}
        </div>
        <CopyButton text={codeString} />
        <SyntaxHighlighter
          style={theme === "light" ? oneLight : oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{
            background: "var(--bg-elevated)",
            borderRadius: "10px",
            padding: "32px 16px 16px",
            fontSize: "13px",
            lineHeight: "1.6",
            border: "1px solid var(--border-subtle)",
            margin: 0,
          }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  // Fenced code block WITHOUT language → plain block, still gets copy button
  if (!inline) {
    return (
      <div style={{ position: "relative", margin: "12px 0" }}>
        <CopyButton text={codeString} />
        <pre
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            padding: "16px",
            fontSize: "13px",
            lineHeight: "1.6",
            overflowX: "auto",
            margin: 0,
            color: "var(--text-primary)",
          }}
        >
          <code>{codeString}</code>
        </pre>
      </div>
    );
  }

  // Inline code snippet `foo`
  return (
    <code
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "4px",
        padding: "2px 6px",
        fontSize: "12.5px",
        color: "var(--accent)",
      }}
      {...props}
    >
      {children}
    </code>
  );
};

const markdownComponents = {
  code: CodeBlock,

  // ─── Links ─────────────────────────────────────────────────────
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "var(--accent)",
          textDecoration: "none",
          transition: "text-decoration 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecoration = "underline";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecoration = "none";
        }}
        {...props}
      >
        {children}
      </a>
    );
  },

  // ─── Headers ───────────────────────────────────────────────────
  h1({ children, ...props }) {
    return (
      <h1
        style={{
          fontSize: "1.5em",
          fontWeight: 700,
          margin: "20px 0 10px",
          color: "var(--text-primary)",
          lineHeight: 1.3,
        }}
        {...props}
      >
        {children}
      </h1>
    );
  },
  h2({ children, ...props }) {
    return (
      <h2
        style={{
          fontSize: "1.25em",
          fontWeight: 600,
          margin: "18px 0 8px",
          color: "var(--text-primary)",
          lineHeight: 1.35,
        }}
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3({ children, ...props }) {
    return (
      <h3
        style={{
          fontSize: "1.1em",
          fontWeight: 600,
          margin: "14px 0 6px",
          color: "var(--text-primary)",
          lineHeight: 1.4,
        }}
        {...props}
      >
        {children}
      </h3>
    );
  },

  // ─── Tables ────────────────────────────────────────────────────
  table({ children, ...props }) {
    return (
      <div style={{ overflowX: "auto", margin: "12px 0" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }) {
    return (
      <thead
        style={{
          background: "var(--bg-elevated)",
          fontWeight: 600,
        }}
        {...props}
      >
        {children}
      </thead>
    );
  },
  th({ children, ...props }) {
    return (
      <th
        style={{
          padding: "8px 12px",
          textAlign: "left",
          borderBottom: "2px solid var(--border-hover)",
          color: "var(--text-primary)",
        }}
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
        }}
        {...props}
      >
        {children}
      </td>
    );
  },

  // ─── Lists ─────────────────────────────────────────────────────
  ul({ children, ...props }) {
    return (
      <ul
        style={{
          paddingLeft: "20px",
          margin: "8px 0",
          listStyleType: "disc",
        }}
        {...props}
      >
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol
        style={{
          paddingLeft: "20px",
          margin: "8px 0",
          listStyleType: "decimal",
        }}
        {...props}
      >
        {children}
      </ol>
    );
  },
  li({ children, ...props }) {
    return (
      <li
        style={{
          margin: "4px 0",
          lineHeight: 1.6,
          color: "var(--text-secondary)",
        }}
        {...props}
      >
        {children}
      </li>
    );
  },

  // ─── Blockquote ────────────────────────────────────────────────
  blockquote({ children, ...props }) {
    return (
      <blockquote
        style={{
          borderLeft: "3px solid var(--accent)",
          paddingLeft: "14px",
          margin: "12px 0",
          color: "var(--text-muted)",
          fontStyle: "italic",
        }}
        {...props}
      >
        {children}
      </blockquote>
    );
  },

  // ─── Paragraph ─────────────────────────────────────────────────
  p({ children, ...props }) {
    return (
      <p
        style={{
          margin: "6px 0",
          lineHeight: 1.7,
          color: "var(--text-primary)",
        }}
        {...props}
      >
        {children}
      </p>
    );
  },

  // ─── Horizontal rule ──────────────────────────────────────────
  hr(props) {
    return (
      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--border-subtle)",
          margin: "16px 0",
        }}
        {...props}
      />
    );
  },

  // ─── Strong / emphasis ─────────────────────────────────────────
  strong({ children, ...props }) {
    return (
      <strong style={{ fontWeight: 600, color: "var(--text-primary)" }} {...props}>
        {children}
      </strong>
    );
  },
  em({ children, ...props }) {
    return (
      <em style={{ fontStyle: "italic" }} {...props}>
        {children}
      </em>
    );
  },
};

/**
 * FileDownloadCard — reusable download card for AI-generated files (PDF, PPT, etc.).
 * Parameterized with icon, colors, and file type label so new file agents
 * can reuse the same component without building separate UI.
 * Uses fetch → blob → anchor-click download for cross-origin presigned URLs.
 */
const FileDownloadCard = ({ url, title, filename, typeLabel, IconComponent, iconColor, iconBgColor }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn(`${typeLabel} blob download failed, opening in new tab:`, err);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "12px",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "420px",
        transition: "border-color 0.2s",
        cursor: "pointer",
      }}
      onClick={handleDownload}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      {/* File type icon */}
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: iconBgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconComponent size={20} style={{ color: iconColor }} />
      </div>

      {/* Title + type label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginTop: "2px",
          }}
        >
          {typeLabel} • Click to download
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        style={{
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--border-subtle)",
          background: "var(--accent-muted)",
          color: "var(--accent)",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        <Download size={14} />
        <span>{downloading ? "Saving…" : "Download"}</span>
      </button>
    </div>
  );
};

/**
 * Single message renderer with asymmetric styling:
 * - USER messages: right-aligned bubble with accent background (unchanged)
 * - ASSISTANT messages: left-aligned, NO bubble background (professional look,
 *   mirrors ChatGPT/Claude style), full-width text with rich markdown rendering
 */
const MessageBubble = ({ message }) => {
  const isUser = message.role === "user";
  const searchImages = message.searchImages || [];
  const generatedPdfUrl = message.generatedPdfUrl || null;
  const pdfTitle = message.pdfTitle || null;
  const generatedPptUrl = message.generatedPptUrl || null;
  const pptTitle = message.pptTitle || null;
  const generatedImageUrl = message.generatedImageUrl || null;

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
      style={{ padding: "4px 0" }}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            width: "30px",
            height: "30px",
            background: "var(--accent-muted)",
            marginTop: "2px",
          }}
        >
          <Bot size={16} style={{ color: "var(--accent)" }} />
        </div>
      )}

      {/* Content */}
      {isUser ? (
        /* USER BUBBLE */
        <div
          className="rounded-2xl max-w-[85%] md:max-w-[75%]"
          style={{
            padding: "10px 16px",
            background: "var(--accent)",
            color: "#FFFFFF",
            fontSize: "13.5px",
            lineHeight: "1.65",
            borderBottomRightRadius: "6px",
            wordBreak: "break-word",
          }}
        >
          {/* Attachment indicator chip */}
          {message.attachmentName && (
            <div
              className="flex items-center gap-2 rounded-lg mb-2"
              style={{
                padding: "6px 10px",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "10px",
              }}
            >
              {/* Image thumbnail or PDF icon */}
              {message.attachmentType === "image" && message.attachmentPreviewUrl ? (
                <img
                  src={message.attachmentPreviewUrl}
                  alt="Attached"
                  className="rounded flex-shrink-0"
                  style={{ width: "32px", height: "32px", objectFit: "cover" }}
                />
              ) : message.attachmentType === "image" ? (
                <ImageIcon size={16} style={{ opacity: 0.8, flexShrink: 0 }} />
              ) : (
                <FileText size={16} style={{ opacity: 0.8, flexShrink: 0 }} />
              )}
              <span
                className="truncate"
                style={{ fontSize: "12px", opacity: 0.9, maxWidth: "200px" }}
              >
                {message.attachmentName}
              </span>
              <Paperclip size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
            </div>
          )}
          {message.content && (
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p>
          )}
        </div>
      ) : (
        /* ASSISTANT — no bubble background, professional flat rendering */
        <div
          className="max-w-[95%] md:max-w-[85%]"
          style={{
            fontSize: "13.5px",
            lineHeight: "1.65",
            wordBreak: "break-word",
          }}
        >
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* AI-generated PDF download card */}
          {generatedPdfUrl && (
            <FileDownloadCard
              url={generatedPdfUrl}
              title={pdfTitle || "Report"}
              filename={`${pdfTitle || "report"}.pdf`}
              typeLabel="PDF Document"
              IconComponent={FileText}
              iconColor="#DC2626"
              iconBgColor="rgba(220, 38, 38, 0.12)"
            />
          )}

          {/* AI-generated PPT download card */}
          {generatedPptUrl && (
            <FileDownloadCard
              url={generatedPptUrl}
              title={pptTitle || "Presentation"}
              filename={`${pptTitle || "presentation"}.pptx`}
              typeLabel="PowerPoint Presentation"
              IconComponent={Presentation}
              iconColor="#D97706"
              iconBgColor="rgba(217, 119, 6, 0.12)"
            />
          )}

          {/* AI-generated Image display */}
          {generatedImageUrl && (
            <div
              style={{
                marginTop: "12px",
                borderRadius: "14px",
                overflow: "hidden",
                maxWidth: "420px",
                border: "1px solid var(--border-subtle)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <img
                src={generatedImageUrl}
                alt="AI Generated Art"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  maxHeight: "420px",
                  objectFit: "cover",
                  borderRadius: "12px",
                }}
                loading="lazy"
              />
            </div>
          )}

          {/* Search result images */}
          {searchImages.length > 0 && (
            <SearchImageStrip images={searchImages} />
          )}
        </div>
      )}

      {/* User avatar */}
      {isUser && (
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            width: "30px",
            height: "30px",
            background: "var(--accent)",
            marginTop: "2px",
          }}
        >
          <User size={16} style={{ color: "#FFFFFF" }} />
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
