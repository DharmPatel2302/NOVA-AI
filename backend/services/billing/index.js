import "dotenv/config";
import express from "express";
import morgan from "morgan";
import connectDB from "./config/db.js";
import billingRoutes from "./route/billing.route.js";

const PORT = process.env.PORT || 8004;
const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ message: "Billing Service is running" });
});

app.use("/", billingRoutes);

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Billing service running on port ${PORT}`);
  });
};

startServer();

