import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  PanelLeft,
  PanelLeftClose,
  SquarePen,
  MessageSquare,
  Coins,
  LogOut,
  Sun,
  Moon,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { clearUser } from "../redux/userSlice";
import {
  setConversations,
  addConversation,
  setActiveConversation,
  removeConversation,
} from "../redux/conversationSlice";
import { clearMessages } from "../redux/messageSlice";
import { getConversations } from "../features/getConversations";
import { createConversation } from "../features/createConversation";
import { deleteConversation as deleteConversationApi } from "../features/deleteConversation";
import { logout } from "../features/logout";

/**
 * Generate a stable HSL color from a string (name/email).
 * Uses a simple hash so the same user always gets the same color.
 */
const getAvatarColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
};

/** Extract up to 2 initials from a name */
const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Format a date for sidebar display */
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const Sidebar = ({ onOpenBilling, isMobileMode = false, onMobileClose }) => {
  const dispatch = useDispatch();
  const { theme, toggleTheme } = useTheme();
  const { user } = useSelector((state) => state.user);
  const { conversations, activeConversationId, loading } = useSelector(
    (state) => state.conversation
  );

  // In mobile overlay mode, sidebar is always expanded (never collapsed)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [deletingConvoId, setDeletingConvoId] = useState(null);

  // Force expanded in mobile mode
  const effectiveCollapsed = isMobileMode ? false : isCollapsed;

  const userCredits = typeof user?.credits === "number" ? user.credits : 100;

  // ─── Fetch conversations on mount ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      try {
        const data = await getConversations();
        if (data) {
          dispatch(setConversations(data));
        } else {
          dispatch(setConversations([]));
        }
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
        dispatch(setConversations([]));
      }
    };
    fetchConversations();
  }, [dispatch, user]);

  // ─── Create new conversation ────────────────────────────────────
  const handleNewChat = async () => {
    if (creatingChat) return;
    setCreatingChat(true);

    try {
      const data = await createConversation();
      if (data && data.conversation) {
        dispatch(addConversation(data.conversation));
        dispatch(setActiveConversation(data.conversation._id));
        if (isMobileMode && onMobileClose) {
          onMobileClose();
        }
      }
    } catch (err) {
      console.error("Failed to create new conversation:", err);
    } finally {
      setCreatingChat(false);
    }
  };

  // ─── Select conversation ────────────────────────────────────────
  const handleSelectConversation = (id) => {
    dispatch(setActiveConversation(id));
    if (isMobileMode && onMobileClose) {
      onMobileClose();
    }
  };

  // ─── Delete conversation handler (Optimistic UI) ───────────────
  const handleDeleteConfirm = async (convoId) => {
    const previousConversations = [...conversations];
    setDeletingConvoId(null);

    // If deleting currently active conversation, reset active conversation and messages
    if (convoId === activeConversationId) {
      dispatch(setActiveConversation(null));
      dispatch(clearMessages());
    }

    // Optimistic Redux removal
    dispatch(removeConversation(convoId));

    try {
      await deleteConversationApi(convoId);
    } catch (err) {
      console.error("[Sidebar] Failed to delete conversation:", err);
      // Rollback on failure
      dispatch(setConversations(previousConversations));
    }
  };

  // ─── Logout handler ─────────────────────────────────────────────
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      dispatch(clearUser());
      dispatch(resetConversations());
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = getInitials(user?.name || user?.email);
  const avatarColor = user ? getAvatarColor(user.name || user.email || "") : "#6C5CE7";

  return (
    <aside
      className={`h-full flex flex-col flex-shrink-0 ${
        isMobileMode ? "w-full" : "sidebar-transition"
      }`}
      style={{
        width: isMobileMode
          ? "100%"
          : effectiveCollapsed
          ? "var(--sidebar-collapsed)"
          : "var(--sidebar-width)",
        backgroundColor: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        userSelect: "none",
      }}
    >
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-3"
        style={{
          height: "56px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {/* Toggle Collapse button (desktop only) */}
        {!isMobileMode && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center rounded-lg cursor-pointer transition-colors"
            style={{
              width: "36px",
              height: "36px",
              color: "var(--text-secondary)",
              background: "transparent",
              border: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {effectiveCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}

        {/* Mobile close button */}
        {isMobileMode && (
          <button
            onClick={onMobileClose}
            className="flex items-center justify-center rounded-lg cursor-pointer"
            style={{
              width: "36px",
              height: "36px",
              color: "var(--text-secondary)",
              background: "transparent",
              border: "none",
            }}
          >
            <PanelLeftClose size={18} />
          </button>
        )}

        {/* App Title (visible when expanded) */}
        {!effectiveCollapsed && (
          <div className="flex items-center gap-2 animate-fade-in">
            <span
              className="font-bold tracking-tight"
              style={{
                fontSize: "15px",
                color: "var(--text-primary)",
                fontFamily: "var(--sans)",
              }}
            >
              NOVA <span style={{ color: "var(--accent)" }}>AI</span>
            </span>
          </div>
        )}

        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          disabled={creatingChat}
          className="flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{
            width: "36px",
            height: "36px",
            backgroundColor: "var(--accent)",
            color: "#FFFFFF",
            border: "none",
            opacity: creatingChat ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!creatingChat) e.currentTarget.style.backgroundColor = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            if (!creatingChat) e.currentTarget.style.backgroundColor = "var(--accent)";
          }}
          title="New Chat"
        >
          <SquarePen size={18} />
        </button>
      </div>

      {/* ─── Conversations List ───────────────────────────────────── */}
      {!effectiveCollapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
          {loading ? (
            /* Loading skeletons */
            <div className="flex flex-col gap-2 p-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 skeleton-shimmer" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            /* Empty state */
            <div
              className="flex flex-col items-center justify-center py-12 px-4 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              <MessageSquare size={28} className="mb-2 opacity-40" />
              <p className="text-xs font-medium" style={{ margin: 0 }}>
                No recent conversations
              </p>
              <p className="text-[11px] opacity-60 mt-1" style={{ margin: 0 }}>
                Click the icon above to start a new chat
              </p>
            </div>
          ) : (
            /* Conversation items */
            <div className="flex flex-col gap-0.5">
              {conversations.map((convo) => {
                const isActive = convo._id === activeConversationId;
                const isDeletingThis = deletingConvoId === convo._id;

                if (isDeletingThis) {
                  /* Inline Delete Confirmation */
                  return (
                    <div
                      key={convo._id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl animate-fade-in"
                      style={{
                        background: "rgba(220, 38, 38, 0.12)",
                        border: "1px solid rgba(220, 38, 38, 0.3)",
                      }}
                    >
                      <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                        Delete this chat?
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteConfirm(convo._id)}
                          className="p-1 rounded-md cursor-pointer transition-colors"
                          style={{
                            background: "var(--danger)",
                            color: "#FFFFFF",
                            border: "none",
                          }}
                          title="Confirm Delete"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingConvoId(null)}
                          className="p-1 rounded-md cursor-pointer transition-colors"
                          style={{
                            background: "var(--bg-hover)",
                            color: "var(--text-secondary)",
                            border: "none",
                          }}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={convo._id}
                    className="group relative flex items-center w-full"
                  >
                    <button
                      onClick={() => handleSelectConversation(convo._id)}
                      className="flex items-center gap-2.5 w-full text-left rounded-xl transition-all cursor-pointer truncate"
                      style={{
                        padding: "8px 10px",
                        paddingRight: "32px",
                        backgroundColor: isActive ? "var(--bg-elevated)" : "transparent",
                        borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                        fontSize: "13px",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "var(--bg-hover)";
                          e.currentTarget.style.color = "var(--text-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }
                      }}
                    >
                      <MessageSquare
                        size={14}
                        style={{
                          flexShrink: 0,
                          color: isActive ? "var(--accent)" : "var(--text-muted)",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium" style={{ fontSize: "13px", margin: 0 }}>
                          {convo.title || "New Conversation"}
                        </p>
                        <p
                          className="truncate"
                          style={{
                            fontSize: "10px",
                            margin: 0,
                            color: "var(--text-muted)",
                            marginTop: "2px",
                          }}
                        >
                          {formatDate(convo.lastMessageAt || convo.createdAt)}
                        </p>
                      </div>
                    </button>

                    {/* Trash icon (visible on hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingConvoId(convo._id);
                      }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg cursor-pointer transition-all"
                      style={{
                        color: "var(--text-muted)",
                        background: "transparent",
                        border: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--danger)";
                        e.currentTarget.style.background = "rgba(220, 38, 38, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.background = "transparent";
                      }}
                      title="Delete conversation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Spacer when collapsed to push footer down */}
      {effectiveCollapsed && <div className="flex-1" />}

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <div
        className="mt-auto px-3 py-3"
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="flex items-center gap-3 rounded-xl"
          style={{
            padding: isCollapsed ? "4px 0" : "8px 10px",
            justifyContent: isCollapsed ? "center" : "flex-start",
            flexDirection: isCollapsed ? "column" : "row",
            gap: isCollapsed ? "8px" : "10px",
          }}
        >
          {/* Avatar */}
          {user?.photoURL && !imgError ? (
            <img
              src={user.photoURL}
              alt={user.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="rounded-full object-cover"
              style={{
                width: isCollapsed ? "28px" : "34px",
                height: isCollapsed ? "28px" : "34px",
                flexShrink: 0,
                border: "2px solid var(--border-subtle)",
              }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center font-semibold"
              style={{
                width: isCollapsed ? "28px" : "34px",
                height: isCollapsed ? "28px" : "34px",
                flexShrink: 0,
                backgroundColor: avatarColor,
                color: "#fff",
                fontSize: isCollapsed ? "10px" : "12px",
              }}
            >
              {initials}
            </div>
          )}

          {/* User info + action icons */}
          {!effectiveCollapsed && (
            <div className="flex items-center flex-1 min-w-0 gap-2 animate-fade-in">
              <div className="flex-1 min-w-0">
                <p
                  className="truncate font-medium"
                  style={{
                    fontSize: "13px",
                    margin: 0,
                    color: "var(--text-primary)",
                  }}
                >
                  {user?.name || "User"}
                </p>
                <p
                  className="truncate"
                  style={{
                    fontSize: "10px",
                    margin: 0,
                    color: "var(--text-muted)",
                    marginTop: "1px",
                  }}
                >
                  {user?.email}
                </p>
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                style={{
                  width: "28px",
                  height: "28px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-elevated)";
                }}
                title={theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {/* Coins / Billing button */}
              <button
                onClick={onOpenBilling}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                style={{
                  background: "var(--accent-muted)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--accent)",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent-muted)";
                }}
                title="Billing & Credits"
              >
                <Coins size={14} />
                <span className="text-xs font-semibold">{userCredits}</span>
              </button>

              {/* Logout icon */}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center justify-center rounded-lg cursor-pointer"
                style={{
                  width: "28px",
                  height: "28px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  transition: "background 0.2s, color 0.2s",
                  flexShrink: 0,
                  opacity: loggingOut ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loggingOut) {
                    e.currentTarget.style.background = "rgba(231, 76, 92, 0.1)";
                    e.currentTarget.style.color = "var(--danger)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          {/* Collapsed: show Theme toggle, Coins button, & logout icon */}
          {effectiveCollapsed && (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center rounded-lg cursor-pointer"
                style={{
                  width: "28px",
                  height: "28px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
                title={theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              <button
                onClick={onOpenBilling}
                className="flex flex-col items-center justify-center rounded-lg cursor-pointer p-1.5 relative"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                  border: "none",
                }}
                title={`Credits: ${userCredits} — Click to open Billing`}
              >
                <Coins size={16} />
                <span style={{ fontSize: "9px", fontWeight: "700", marginTop: "1px" }}>
                  {userCredits > 999 ? "999+" : userCredits}
                </span>
              </button>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center justify-center rounded-lg cursor-pointer"
                style={{
                  width: "28px",
                  height: "28px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  transition: "background 0.2s, color 0.2s",
                  opacity: loggingOut ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loggingOut) {
                    e.currentTarget.style.background = "rgba(231, 76, 92, 0.1)";
                    e.currentTarget.style.color = "var(--danger)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
