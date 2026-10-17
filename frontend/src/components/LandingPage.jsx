import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  MessageSquare,
  Search,
  Code2,
  FileText,
  Presentation,
  ImageIcon,
  Eye,
  Zap,
  Database,
  Mic,
  ArrowRight,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Cpu,
  ChevronRight,
  Star,
  Check,
} from "lucide-react";
import GoogleSignInButton from "./GoogleSignInButton";

const AGENT_SHOWCASE = [
  {
    id: "chat",
    name: "Chat Agent",
    icon: MessageSquare,
    badge: "General AI",
    color: "#6C5CE7",
    headline: "Conversational Reasoning & Instant Answers",
    description:
      "Powered by ultra-fast LLMs for intelligent, nuanced conversations, brainstorming, content writing, and complex problem-solving.",
    prompt: "Explain quantum computing in simple terms with an everyday analogy.",
    output:
      "Think of classical computers like a light switch — either completely ON (1) or OFF (0). Quantum computing uses qubits, which are like spinning coins that can be both heads AND tails simultaneously (superposition). This lets quantum AI solve complex problems millions of times faster!",
    tags: ["Instant Stream", "Context Memory", "Multilingual"],
  },
  {
    id: "search",
    name: "Search Agent",
    icon: Search,
    badge: "Live Web",
    color: "#2ED573",
    headline: "Real-Time Web Search & Citation Synthesis",
    description:
      "Fetches real-time web results, live news, stock data, and market research with verified inline citations and image carousels.",
    prompt: "What are the key breakthroughs in AI models announced this week?",
    output:
      "1. Google Gemini 2.5 Flash updates released with reduced latency.\n2. Open-source multimodal vision benchmarks reach new state-of-the-art accuracy.\n3. Real-time web search integrations expand for autonomous agent workflows.",
    tags: ["Live Web Search", "Verified Citations", "Image Extraction"],
  },
  {
    id: "coding",
    name: "Coding Agent",
    icon: Code2,
    badge: "Full-Stack",
    color: "#70A1FF",
    headline: "Full-Stack Code Generation & Instant Artifact Execution",
    description:
      "Generates clean, production-grade code in React, Python, Node.js, and HTML/CSS. Live interactive artifact panel displays live code splits and rendered previews.",
    prompt: "Write a reusable React custom hook for debouncing input state.",
    output: `import { useState, useEffect } from 'react';\n\nexport function useDebounce(value, delay = 300) {\n  const [debouncedValue, setDebouncedValue] = useState(value);\n  useEffect(() => {\n    const timer = setTimeout(() => setDebouncedValue(value), delay);\n    return () => clearTimeout(timer);\n  }, [value, delay]);\n  return debouncedValue;\n}`,
    tags: ["Llama 3.3 70B", "Live Artifact Panel", "One-Click Copy"],
  },
  {
    id: "pdf",
    name: "PDF RAG Agent",
    icon: FileText,
    badge: "Qdrant Vector",
    color: "#FFA502",
    headline: "Vector DB Document Intelligence & Q&A",
    description:
      "Upload PDFs of any length. Our Qdrant vector database parses, embeds, and indexes your document chunks for precise, hallucination-free document answering.",
    prompt: "Extract the financial growth highlights from page 14 of Q3_report.pdf",
    output:
      "📊 **Q3 Financial Highlights (Page 14)**:\n- **Quarterly Revenue**: $4.2M (+28% YoY growth)\n- **Gross Margin**: Expanded to 74% (vs 68% in Q2)\n- **Recurring ARR**: Subscriptions account for 82% of total revenue stream.",
    tags: ["Qdrant Vector DB", "1M Token Window", "Exact Citations"],
  },
  {
    id: "ppt",
    name: "PPT Deck Agent",
    icon: Presentation,
    badge: "Slide Generation",
    color: "#FF6B81",
    headline: "Structured Slide Deck Creation & PPTX Export",
    description:
      "Transform any topic or outline into a beautifully formatted presentation deck. Exports directly to `.pptx` for instant editing in PowerPoint or Google Slides.",
    prompt: "Generate a 5-slide pitch deck for an autonomous AI platform.",
    output:
      "Generated presentation deck: **'NOVA_AI_Pitch_Deck.pptx'**\n\n- **Slide 1**: Title & Vision Statement\n- **Slide 2**: The Fragmented AI Tooling Problem\n- **Slide 3**: NOVA Multi-Agent Architecture\n- **Slide 4**: Traction & Financial Growth\n- **Slide 5**: Investment Ask & Roadmap",
    tags: ["PowerPoint Export", "Structured Content", "Instant Download"],
  },
  {
    id: "image",
    name: "Image Agent",
    icon: ImageIcon,
    badge: "Generative Art",
    color: "#A55EEA",
    headline: "Generative AI Art & Creative Visual Studio",
    description:
      "Turn text prompts into high-resolution images and artwork using state-of-the-art generative diffusion models.",
    prompt: "A high-tech cyberpunk workstation with neon violet and cyan lights",
    output: "🎨 Generated high-resolution digital artwork with instant full-screen lightbox preview and one-click image download.",
    tags: ["HD Generative Art", "Instant Download", "Lightbox Preview"],
  },
  {
    id: "vision",
    name: "Vision Analyzer",
    icon: Eye,
    badge: "Multimodal",
    color: "#26DE81",
    headline: "Multimodal Image Analysis & Visual Understanding",
    description:
      "Attach any image or diagram. Gemini Vision analyzes objects, visible text, layout composition, and hidden patterns to answer detailed questions.",
    prompt: "Analyze this system architecture diagram and identify single points of failure.",
    output:
      "👁️ **Visual Analysis**:\n- **Architecture**: 3-Tier cloud application with single load balancer entry.\n- **Risk Detected**: The single API Gateway node at `10.0.1.5` lacks redundancy and represents a potential single point of failure.",
    tags: ["Gemini Vision", "Base64 Analysis", "Diagram Reading"],
  },
];

const PLATFORM_FEATURES = [
  {
    icon: Cpu,
    title: "Autonomous Router Engine",
    description:
      "NOVA automatically classifies your prompt and delegates it to the specialized agent best equipped to handle it — no manual configuration required.",
  },
  {
    icon: Layers,
    title: "Split-Screen Artifact Panel",
    description:
      "Code, HTML prototypes, React components, and markdown reports render side-by-side in an interactive preview panel with live code execution.",
  },
  {
    icon: Database,
    title: "Persistent Qdrant Vector DB",
    description:
      "Uploaded documents are chunked and embedded in dedicated vector storage, ensuring accurate document retrieval across long conversations.",
  },
  {
    icon: Mic,
    title: "Voice & Speech Input",
    description:
      "Hands-free voice prompting powered by the Web Speech API with real-time interim transcript streaming directly into your chat area.",
  },
  {
    icon: Zap,
    title: "Credit-Based Execution",
    description:
      "Fair and transparent credit system. Simple conversational prompts cost minimal credits while heavy generation tasks are clearly priced.",
  },
  {
    icon: ShieldCheck,
    title: "Isolated Conversation Storage",
    description:
      "Every conversation maintains independent context, S3 asset storage, and vector indexes. Deleting a chat cleans up all associated resources.",
  },
];

const SAMPLE_SANDBOX_PROMPTS = [
  {
    agent: "Coding Agent",
    prompt: "Create a glassmorphic card component with Tailwind CSS",
    response: "Here's a production-ready glassmorphic card with backdrop-blur, subtle borders, and smooth hover glow...",
  },
  {
    agent: "Search Agent",
    prompt: "What is the current stock price and recent news for NVDA?",
    response: "NVIDIA (NVDA) is trading at $128.40 (+3.2%). Recent news highlights expanded data center chip shipments...",
  },
  {
    agent: "PDF RAG Agent",
    prompt: "Summarize section 4 of the uploaded contract document",
    response: "Section 4 specifies confidentiality obligations: both parties must preserve trade secrets for 5 years post-termination...",
  },
];

const LandingPage = () => {
  const [activeTabId, setActiveTabId] = useState("chat");
  const [sandboxPrompt, setSandboxPrompt] = useState(SAMPLE_SANDBOX_PROMPTS[0]);

  const activeAgent = AGENT_SHOWCASE.find((a) => a.id === activeTabId) || AGENT_SHOWCASE[0];

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col font-sans selection:bg-indigo-500 selection:text-white"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ─── 1. NAVBAR ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-xl transition-all shadow-lg"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid rgba(108, 92, 231, 0.25)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-lg transition-transform group-hover:scale-105"
              style={{ background: "linear-gradient(135deg, #6C5CE7 0%, #7C6FF7 100%)" }}
            >
              N
            </div>
            <span className="font-extrabold text-xl tracking-tight" style={{ color: "var(--text-primary)" }}>
              NOVA <span style={{ color: "var(--accent)" }}>AI</span>
            </span>
          </div>

          {/* Navigation Anchors */}
          <nav className="hidden md:flex items-center gap-9 text-[15px] font-semibold">
            <button
              onClick={() => scrollToSection("features")}
              className="transition-colors cursor-pointer hover:text-indigo-400"
              style={{ color: "var(--text-primary)" }}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("agents")}
              className="transition-colors cursor-pointer hover:text-indigo-400"
              style={{ color: "var(--text-primary)" }}
            >
              Specialist Agents
            </button>
            <button
              onClick={() => scrollToSection("sandbox")}
              className="transition-colors cursor-pointer hover:text-indigo-400"
              style={{ color: "var(--text-primary)" }}
            >
              Live Demo
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="transition-colors cursor-pointer hover:text-indigo-400"
              style={{ color: "var(--text-primary)" }}
            >
              Pricing
            </button>
          </nav>

          {/* Auth Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollToSection("auth-hero")}
              className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all hover:scale-105 shadow-md"
              style={{
                background: "var(--accent)",
                color: "#FFFFFF",
                boxShadow: "0 0 20px var(--accent-glow)",
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION ───────────────────────────────────────── */}
      <section id="auth-hero" className="relative pt-12 pb-20 overflow-hidden">
        {/* Ambient Gradient Glow Backdrop */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-30"
          style={{ background: "radial-gradient(circle, #6C5CE7 0%, rgba(108, 92, 231, 0) 70%)" }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-6 flex flex-col items-start gap-6 text-left">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border"
                style={{
                  background: "var(--accent-muted)",
                  borderColor: "var(--accent-glow)",
                  color: "var(--accent)",
                }}
              >
                <Sparkles size={14} />
                <span>Next-Gen Autonomous Multi-Agent Workspace</span>
              </div>

              {/* Main Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                One Platform. <br />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Every AI Specialist.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg leading-relaxed max-w-xl" style={{ color: "var(--text-secondary)" }}>
                Seamlessly orchestrate specialized agents for real-time web search, full-stack code generation, Qdrant document RAG, presentation decks, and visual AI image synthesis.
              </p>

              {/* Google Sign-in Card CTA */}
              <div
                className="w-full max-w-md p-6 rounded-2xl border flex flex-col gap-4 shadow-xl"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      Instant Workspace Access
                    </h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Sign in with Google to start chatting with NOVA AI
                    </p>
                  </div>
                </div>

                <GoogleSignInButton />
              </div>
            </div>

            {/* Right Hero Interactive Preview Mockup */}
            <div className="lg:col-span-6 relative">
              <div
                className="rounded-2xl border p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
                }}
              >
                {/* Mockup Header Bar */}
                <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    <span className="text-xs font-mono ml-2 opacity-60">nova-ai-workspace</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300">
                    <Cpu size={12} />
                    <span>Auto-Routing Active</span>
                  </div>
                </div>

                {/* Mockup Active Agent Selector Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-3 custom-scrollbar text-xs">
                  {AGENT_SHOWCASE.slice(0, 4).map((agent) => {
                    const Icon = agent.icon;
                    const isSel = agent.id === activeTabId;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setActiveTabId(agent.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-all whitespace-nowrap"
                        style={{
                          background: isSel ? "var(--accent)" : "var(--bg-hover)",
                          color: isSel ? "#FFFFFF" : "var(--text-secondary)",
                        }}
                      >
                        <Icon size={13} />
                        <span>{agent.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Mockup Chat Bubble Window */}
                <div className="flex flex-col gap-3 my-2 text-xs">
                  <div className="self-end max-w-[80%] p-3 rounded-2xl rounded-tr-none bg-indigo-600 text-white font-medium">
                    {activeAgent.prompt}
                  </div>

                  <div className="self-start max-w-[90%] p-3.5 rounded-2xl rounded-tl-none border flex flex-col gap-2" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-400">
                      <span className="flex items-center gap-1">
                        <Sparkles size={12} /> {activeAgent.name} Response
                      </span>
                      <span className="opacity-60 font-mono">0.4s</span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed text-slate-300">
                      {activeAgent.output}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. AGENT SHOWCASE SECTION ───────────────────────────── */}
      <section id="agents" className="py-20 border-t relative" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs uppercase tracking-widest font-bold text-indigo-400">
              Specialist Intelligence
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
              7 Purpose-Built AI Agents. Zero Friction.
            </h2>
            <p className="text-sm sm:text-base mt-3" style={{ color: "var(--text-muted)" }}>
              Explore how each specialized agent handles dedicated tasks with unmatched speed and accuracy.
            </p>
          </div>

          {/* Agent Selector Tabs */}
          <div className="flex items-center justify-center flex-wrap gap-2 mb-10">
            {AGENT_SHOWCASE.map((agent) => {
              const Icon = agent.icon;
              const isSelected = agent.id === activeTabId;
              return (
                <button
                  key={agent.id}
                  onClick={() => setActiveTabId(agent.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  style={{
                    background: isSelected ? "var(--accent)" : "var(--bg-elevated)",
                    color: isSelected ? "#FFFFFF" : "var(--text-secondary)",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                    boxShadow: isSelected ? "0 4px 16px var(--accent-glow)" : "none",
                  }}
                >
                  <Icon size={16} style={{ color: isSelected ? "#FFFFFF" : agent.color }} />
                  <span>{agent.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Agent Demo Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeAgent.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl mx-auto rounded-3xl border p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between flex-wrap gap-4 border-b pb-6" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: `${activeAgent.color}20`, border: `1px solid ${activeAgent.color}40` }}
                  >
                    <activeAgent.icon size={24} style={{ color: activeAgent.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold">{activeAgent.name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400">
                        {activeAgent.badge}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {activeAgent.headline}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {activeAgent.description}
              </p>

              {/* Prompt & Output Preview Box */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border flex flex-col gap-2" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Sample User Query</span>
                  <p className="text-xs font-mono leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    "{activeAgent.prompt}"
                  </p>
                </div>
                <div className="p-4 rounded-xl border flex flex-col gap-2" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Agent Output Result</span>
                  <p className="text-xs whitespace-pre-line leading-relaxed font-mono" style={{ color: "var(--text-secondary)" }}>
                    {activeAgent.output}
                  </p>
                </div>
              </div>

              {/* Feature Tags */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {activeAgent.tags.map((tag, idx) => (
                  <span key={idx} className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-semibold bg-white/5 border border-white/10 text-slate-300">
                    <Check size={12} className="text-indigo-400" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ─── 4. FEATURE GRID SECTION ────────────────────────────────── */}
      <section id="features" className="py-20 border-t relative" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs uppercase tracking-widest font-bold text-indigo-400">
              Architecture & Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
              Engineered for Speed, Precision & Power
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORM_FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl border flex flex-col gap-3 transition-all hover:border-indigo-500/50 hover:shadow-xl group"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-bold text-base mt-1">{feat.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 5. INTERACTIVE SANDBOX SECTION ─────────────────────────── */}
      <section id="sandbox" className="py-20 border-t relative" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs uppercase tracking-widest font-bold text-indigo-400">
              Interactive Preview
            </span>
            <h2 className="text-3xl font-extrabold mt-2">Test Sample Prompts</h2>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Click any sample prompt below to preview real agent responses.
            </p>
          </div>

          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {SAMPLE_SANDBOX_PROMPTS.map((item, idx) => {
              const isSelected = sandboxPrompt.prompt === item.prompt;
              return (
                <div
                  key={idx}
                  onClick={() => setSandboxPrompt(item)}
                  className="p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2"
                  style={{
                    background: isSelected ? "var(--bg-elevated)" : "var(--bg-base)",
                    borderColor: isSelected ? "var(--accent)" : "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span style={{ color: "var(--accent)" }}>{item.agent}</span>
                    <ChevronRight size={14} className={`transition-transform ${isSelected ? "rotate-90 text-indigo-400" : "opacity-40"}`} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    "{item.prompt}"
                  </p>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-2 pt-2 border-t text-xs font-mono leading-relaxed"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                    >
                      ⚡ {item.response}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 6. CALL TO ACTION BANNER ───────────────────────────────── */}
      <section className="py-20 border-t relative overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-4xl mx-auto px-4 text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Experience Autonomous AI Workflows?
          </h2>
          <p className="text-sm max-w-lg" style={{ color: "var(--text-secondary)" }}>
            Join NOVA AI today. Sign in with Google to start building, searching, and creating with specialized multi-agent intelligence.
          </p>

          <div className="w-full max-w-sm mt-2">
            <GoogleSignInButton />
          </div>
        </div>
      </section>

      {/* ─── 7. FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t py-8 text-center text-xs" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">N</div>
            <span className="font-semibold text-slate-300">NOVA AI Platform</span>
          </div>
          <p>© {new Date().getFullYear()} NOVA AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
