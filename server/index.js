import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import tenantRoutes from "./routes/tenants.js";
import chargeRoutes from "./routes/charges.js";
import paymentRoutes from "./routes/payments.js";
import regulationRoutes from "./routes/regulations.js";
import settingsRoutes from "./routes/settings.js";
import reportsRoutes from "./routes/reports.js";
import seedRoutes from "./routes/seed.js";
import superadminRoutes from "./routes/superadmin.js";

import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../dist");

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(o => o.trim())
  : ["http://localhost:5173"];

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes("*") || 
      allowedOrigins.includes(origin) || 
      origin.endsWith(".netlify.app") || 
      origin.includes("localhost")
    ) {
      return callback(null, true);
    }
    callback(null, true); // Allow all web clients in production
  },
  credentials: true,
}));
app.use(express.json());
app.use(morgan("dev"));

// ─── Static files (Vite build) ────────────────────────────────────────────────
app.use(express.static(distPath));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/charges", chargeRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/regulations", regulationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/superadmin", superadminRoutes);

// ─── SPA Fallback for client-side routing ─────────────────────────────────────
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log("DwellBase API running on http://localhost:" + PORT);
});

