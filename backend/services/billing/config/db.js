import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[Billing Service] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Billing Service] MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
