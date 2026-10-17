import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Frequent query: "all conversations for this user"
    },
    title: {
      type: String,
      default: "New Conversation",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now, // Updated whenever a new message is saved
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
