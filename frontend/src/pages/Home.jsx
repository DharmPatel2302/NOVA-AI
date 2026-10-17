import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import Artifacts from "../components/Artifacts";
import BillingDrawer from "../components/BillingDrawer";
import LandingPage from "../components/LandingPage";
import { toggleArtifactPanel } from "../redux/messageSlice";

/**
 * Custom hook for responsive breakpoint detection.
 * Returns true when viewport width is below the given breakpoint.
 */
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
};

const Home = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.user);
  const { activeArtifact, isArtifactPanelOpen } = useSelector((state) => state.message);

  const [isBillingDrawerOpen, setIsBillingDrawerOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const isMobile = useIsMobile(768);

  // ─── Authenticated: Dashboard layout ──────────────────────────────
  if (isAuthenticated && user) {
    return (
      <div
        className="flex h-screen overflow-hidden w-full relative"
        style={{ background: "var(--bg-base)" }}
      >
        {/* ─── DESKTOP Sidebar (inline, always visible) ──────────── */}
        {!isMobile && (
          <Sidebar onOpenBilling={() => setIsBillingDrawerOpen(true)} />
        )}

        {/* ─── MOBILE Sidebar (off-canvas overlay) ───────────────── */}
        {isMobile && isMobileSidebarOpen && (
          <>
            <div
              className="sidebar-backdrop"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div className="sidebar-mobile-overlay">
              <Sidebar
                onOpenBilling={() => {
                  setIsBillingDrawerOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                isMobileMode
                onMobileClose={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </>
        )}

        <ChatArea
          isArtifactsOpen={isArtifactPanelOpen}
          onToggleArtifacts={() => dispatch(toggleArtifactPanel())}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          isMobile={isMobile}
        />

        {/* Artifacts panel — renders differently on mobile vs desktop */}
        {activeArtifact && <Artifacts isMobile={isMobile} />}

        {/* Billing & Credits drawer */}
        <BillingDrawer
          isOpen={isBillingDrawerOpen}
          onClose={() => setIsBillingDrawerOpen(false)}
        />
      </div>
    );
  }

  // ─── Unauthenticated: Interactive Landing Page ────────────────────
  return <LandingPage />;
};

export default Home;
