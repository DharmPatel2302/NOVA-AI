import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    default: "",
  },
  photoURL: {
    type: String,
    default: "",
  },
  plan: {
    type: String,
    enum: ["free", "starter", "pro"],
    default: "free",
  },
  credits: {
    type: Number,
    default: 100,
  },
  totalCredits: {
    type: Number,
    default: 100,
  },
  planExpiresAt: {
    type: Date,
    default: null,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);

export default User;
