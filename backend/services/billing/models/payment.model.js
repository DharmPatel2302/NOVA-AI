import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: String,
      default: null,
    },
    signature: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true, // In paise (e.g. 19900 = ₹199)
    },
    currency: {
      type: String,
      default: "INR",
    },
    credits: {
      type: Number,
      required: true,
    },
    plan: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
