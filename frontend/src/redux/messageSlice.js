import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  messages: [],    // [{_id, role, content, createdAt, artifactTitle, artifactFiles, searchImages}]
  loading: true,   // true while fetching history for a newly-selected conversation
  sending: false,  // true while waiting for agent response after user hits send
  thinkingText: "Thinking...", // Dynamic thinking step label
  activeArtifact: null, // { title: string, files: [{filename, language, content}] }
  isArtifactPanelOpen: false, // Controls visibility of the panel
};

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    setMessages(state, action) {
      const incoming = action.payload || [];
      // Preserve local optimistic messages (no _id) that haven't landed in DB payload yet
      const optimisticInFlight = state.messages.filter(
        (localM) =>
          !localM._id &&
          !incoming.some(
            (incM) => incM.content === localM.content && incM.role === localM.role
          )
      );
      state.messages = [...incoming, ...optimisticInFlight];
      state.loading = false;
    },
    addMessage(state, action) {
      state.messages.push(action.payload);
    },
    setMessagesLoading(state, action) {
      state.loading = action.payload;
    },
    setSending(state, action) {
      state.sending = action.payload;
      if (!action.payload) {
        state.thinkingText = "Thinking..."; // Reset on completion
      }
    },
    setThinkingText(state, action) {
      state.thinkingText = action.payload;
    },
    clearMessages(state) {
      state.messages = [];
      state.loading = false;
      state.sending = false;
      state.thinkingText = "Thinking...";
      state.activeArtifact = null;
      state.isArtifactPanelOpen = false;
    },
    setActiveArtifact(state, action) {
      state.activeArtifact = action.payload;
      state.isArtifactPanelOpen = true; // Auto-opens on set
    },
    clearActiveArtifact(state) {
      state.activeArtifact = null;
      state.isArtifactPanelOpen = false;
    },
    closeArtifactPanel(state) {
      state.isArtifactPanelOpen = false;
    },
    toggleArtifactPanel(state) {
      state.isArtifactPanelOpen = !state.isArtifactPanelOpen;
    },
  },
});

export const {
  setMessages,
  addMessage,
  setMessagesLoading,
  setSending,
  setThinkingText,
  clearMessages,
  setActiveArtifact,
  clearActiveArtifact,
  closeArtifactPanel,
  toggleArtifactPanel,
} = messageSlice.actions;

export default messageSlice.reducer;
