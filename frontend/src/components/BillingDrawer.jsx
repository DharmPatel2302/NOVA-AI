import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Zap, Coins, CreditCard, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";
import { getPlans } from "../features/getPlans";
import { createOrder } from "../features/createOrder";
import { verifyPayment } from "../features/verifyPayment";
import { getCurrentUser } from "../features/getCurrentUser";
import { setUser } from "../redux/userSlice";

const BillingDrawer = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.user);

  const [plansData, setPlansData] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch plans on drawer open
  useEffect(() => {
    if (!isOpen) return;

    const fetchCatalog = async () => {
      setLoadingPlans(true);
      setErrorMsg(null);
      try {
        const data = await getPlans();
        setPlansData(data);
      } catch (err) {
        console.error("Failed to load plans:", err);
        setErrorMsg("Failed to load plan catalog. Please check your connection.");
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchCatalog();
  }, [isOpen]);

  const currentPlanId = user?.plan || "free";
  const currentCredits = typeof user?.credits === "number" ? user.credits : 100;
  const totalCredits = typeof user?.totalCredits === "number" ? user.totalCredits : 100;
  const progressPercent = Math.min(100, Math.max(0, (currentCredits / (totalCredits || 1)) * 100));

  const handleUpgrade = async (planId) => {
    if (isProcessing) return;
    if (planId === currentPlanId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Guard: verify Razorpay checkout script is loaded
    if (!window.Razorpay) {
      setErrorMsg("Payment system is still loading. Please try again in a moment.");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create payment order backend
      const orderRes = await createOrder({ planId });
      const { orderId, amount, currency, keyId } = orderRes;

      // 2. Configure Razorpay modal
      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: amount, // in paise
        currency: currency || "INR",
        order_id: orderId,
        name: "Nova AI",
        description: `${planId.toUpperCase()} Plan Subscription`,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#6C5CE7", // Nova accent color
        },
        handler: async (response) => {
          try {
            // 3. Verify payment signature on backend
            const verifyRes = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.success) {
              setSuccessMsg(`🎉 Successfully upgraded to ${plansData?.[planId]?.name || planId} Plan!`);
              // Re-fetch updated profile and update Redux store
              const freshUser = await getCurrentUser();
              if (freshUser) {
                dispatch(setUser(freshUser));
              }
            } else {
              setErrorMsg(verifyRes.message || "Payment verification failed. Please contact support.");
            }
          } catch (err) {
            console.error("Payment verification error:", err);
            setErrorMsg("Payment verification error. If money was deducted, your account will update shortly.");
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        console.error("Razorpay payment failed:", response.error);
        setErrorMsg(response.error?.description || "Payment failed or was cancelled.");
        setIsProcessing(false);
      });

      rzp.open();
    } catch (err) {
      console.error("Failed to initiate order:", err);
      setErrorMsg(err.response?.data?.message || "Failed to start checkout session.");
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Drawer Sliding Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="relative z-10 w-full max-w-md h-full flex flex-col shadow-2xl"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderLeft: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--accent-muted)" }}
                >
                  <Coins size={18} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                    Billing & Credits
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Manage your subscription and credits
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: "var(--text-secondary)", background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
              {/* Error/Success Alerts */}
              {errorMsg && (
                <div
                  className="p-3.5 rounded-xl text-xs flex items-start gap-2.5"
                  style={{ background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.2)", color: "#EF4444" }}
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div
                  className="p-3.5 rounded-xl text-xs flex items-start gap-2.5"
                  style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#10B981" }}
                >
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Current Plan Summary Card */}
              <div
                className="rounded-2xl p-5 border flex flex-col gap-4 relative shrink-0 transition-all shadow-sm"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--accent)",
                  boxShadow: "0 4px 20px var(--accent-muted)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "var(--accent-muted)",
                        border: "1px solid var(--accent-glow)",
                      }}
                    >
                      <Zap size={20} style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: "var(--accent)" }}>
                        Current Active Plan
                      </span>
                      <h3 className="text-lg font-bold capitalize mt-0.5" style={{ color: "var(--text-primary)" }}>
                        {currentPlanId} Tier
                      </h3>
                    </div>
                  </div>

                  <div
                    className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-xs"
                    style={{ background: "var(--accent)", color: "#FFFFFF" }}
                  >
                    <Sparkles size={12} />
                    <span>Active</span>
                  </div>
                </div>

                {/* Expiry / renewal note */}
                {user?.planExpiresAt && currentPlanId !== "free" && (
                  <p className="text-xs" style={{ color: "var(--text-muted)", margin: 0 }}>
                    Renews on {new Date(user.planExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}

                {/* Progress Bar Track */}
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <Coins size={14} style={{ color: "var(--accent)" }} />
                      Credits Remaining
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      <strong>{currentCredits}</strong> / {totalCredits} credits
                    </span>
                  </div>
                  <div
                    className="w-full h-2.5 rounded-full overflow-hidden"
                    style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>

              {/* Plans Catalog */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    Available Plans
                  </h3>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Cancel or upgrade anytime
                  </span>
                </div>

                {loadingPlans ? (
                  <div className="flex flex-col gap-3">
                    {[120, 150, 130].map((height, n) => (
                      <div key={n} className="rounded-2xl skeleton-shimmer" style={{ height: `${height}px` }} />
                    ))}
                  </div>
                ) : (
                  plansData &&
                  Object.values(plansData).map((plan) => {
                    const isCurrent = plan.id === currentPlanId;
                    const isPopular = plan.id === "pro";
                    const priceFormatted = plan.price === 0 ? "Free" : `₹${plan.price / 100}/mo`;

                    return (
                      <div
                        key={plan.id}
                        className="rounded-2xl p-5 border flex flex-col gap-4 transition-all duration-200 relative overflow-hidden"
                        style={{
                          background: isCurrent
                            ? "var(--accent-muted)"
                            : isPopular
                            ? "var(--bg-elevated)"
                            : "var(--bg-surface)",
                          borderColor: isCurrent
                            ? "var(--accent)"
                            : isPopular
                            ? "var(--accent)"
                            : "var(--border-subtle)",
                          boxShadow: isPopular ? "0 4px 20px var(--accent-muted)" : "none",
                        }}
                      >
                        {isPopular && !isCurrent && (
                          <div
                            className="absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl flex items-center gap-1"
                            style={{ background: "var(--accent)", color: "#FFFFFF" }}
                          >
                            <Sparkles size={11} /> Popular
                          </div>
                        )}

                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                                {plan.name}
                              </h4>
                              {isCurrent && (
                                <span
                                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                                  style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                                >
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              {plan.description}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                              {priceFormatted}
                            </span>
                          </div>
                        </div>

                        {/* Features list */}
                        <div className="flex flex-col gap-1.5 my-1">
                          {plan.features?.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                              <Check size={13} className="shrink-0" style={{ color: "var(--accent)" }} />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={isCurrent || isProcessing}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                          style={{
                            background: isCurrent
                              ? "var(--bg-active)"
                              : isPopular
                              ? "var(--accent)"
                              : "var(--bg-hover)",
                            color: isCurrent
                              ? "var(--text-muted)"
                              : isPopular
                              ? "#FFFFFF"
                              : "var(--text-primary)",
                            border: isCurrent
                              ? "1px solid var(--border-subtle)"
                              : isPopular
                              ? "none"
                              : "1px solid var(--border-hover)",
                            opacity: isProcessing ? 0.7 : 1,
                          }}
                        >
                          {isCurrent ? (
                            "Current Plan"
                          ) : isProcessing ? (
                            "Processing..."
                          ) : (
                            <>
                              <Zap size={14} />
                              <span>Upgrade to {plan.name}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer Note */}
            <div
              className="px-6 py-4 text-center text-xs"
              style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
            >
              🔒 Payments secured by Razorpay 256-bit encryption
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BillingDrawer;
