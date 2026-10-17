import React from "react";
import { useSelector } from "react-redux";
import { PanelRight, PanelRightClose, Menu } from "lucide-react";

/**
 * Top navigation bar for the chat area.
 * Shows hamburger menu (mobile), conversation title, and artifacts panel toggle.
 */
const Nav = ({ isArtifactsOpen, onToggleArtifacts, onOpenMobileSidebar }) => {
  const { conversations, activeConversationId } = useSelector(
    (state) => state.conversation
  );

  const activeConvo = conversations.find((c) => c._id === activeConversationId);
  const title = activeConvo?.title || "New Chat";

  return (
    <div
      className="flex items-center justify-between px-4 md:px-5"
      style={{
        minHeight: "52px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-base)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Hamburger menu — mobile only */}
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="show-on-mobile items-center justify-center rounded-lg cursor-pointer"
            style={{
              width: "32px",
              height: "32px",
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              transition: "background 0.2s, color 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            title="Open sidebar"
          >
            <Menu size={18} />
          </button>
        )}

        {/* Conversation title */}
        <h2
          className="font-medium truncate"
          style={{
            fontSize: "14px",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>

      {/* Artifacts toggle — hidden on mobile (<768px) via CSS */}
      <button
        onClick={onToggleArtifacts}
        className="hide-on-mobile items-center justify-center rounded-lg cursor-pointer"
        style={{
          width: "32px",
          height: "32px",
          background: isArtifactsOpen ? "var(--accent-muted)" : "transparent",
          color: isArtifactsOpen ? "var(--accent)" : "var(--text-muted)",
          border: "none",
          transition: "background 0.2s, color 0.2s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isArtifactsOpen) {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isArtifactsOpen) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }
        }}
        title={isArtifactsOpen ? "Close artifacts" : "Open artifacts"}
      >
        {isArtifactsOpen ? (
          <PanelRightClose size={17} />
        ) : (
          <PanelRight size={17} />
        )}
      </button>
    </div>
  );
};

export default Nav;
