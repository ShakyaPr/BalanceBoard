import cors from "cors";
import express from "express";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import cardRoutes from "./routes/cardRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import statementRoutes from "./routes/statementRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/analytics", analyticsRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/statements", statementRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(errorHandler);
