"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { initializeDatabase, getConnection } = require("./db");

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, "public");
const DATA_STORAGE_DIR = path.join(__dirname, "data", "storage");

function ensureStorageDir() {
  if (!fs.existsSync(DATA_STORAGE_DIR)) {
    fs.mkdirSync(DATA_STORAGE_DIR, { recursive: true });
  }
}

initializeDatabase();
ensureStorageDir();
const db = getConnection();

const app = express();

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        // Hilangkan informasi sensitif yang mungkin masuk ke log.
        process.stdout.write(message);
      },
    },
  })
);

app.use(
  express.static(STATIC_DIR, {
    index: "index.html",
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Endpoint placeholder agar arsitektur auth jelas namun belum diimplementasikan.
app.post("/api/auth/login", (_req, res) => {
  res.status(501).json({
    error: "Login belum diimplementasikan. Validasi NIK + kata sandi (hash argon2id), aktifkan rate limiting, dan catat audit.",
  });
});

app.get("/api/guidelines/auth", (_req, res) => {
  res.json({
    login: [
      "Gunakan NIK sebagai kredensial utama; normalisasi format sebelum pencarian akun.",
      "Hash kata sandi dengan algoritma argon2id atau bcrypt lagi sebelum disimpan.",
      "Batasi percobaan login dan catat setiap kegagalan ke tabel login_attempts untuk audit.",
      "Validasi kredensial terhadap akun aktif saja, serta cek flag must_reset_password.",
    ],
    provisioning: [
      "Signup publik dimatikan. Gunakan seed internal (contoh: script seed-users.js) untuk membuat akun warga.",
      "Pastikan NIK unik dan cocokkan dengan daftar resmi sebelum dirilis ke pengguna.",
      "Simpan data diri yang dikirim dalam bentuk terenkripsi ke tabel citizen_records.",
      "Minta persetujuan eksplisit (consent) untuk setiap tujuan pemrosesan data dan catat ke tabel data_sharing_consents.",
    ],
  });
});

app.use((req, res, next) => {
  res.locals.requestId = crypto.randomUUID();
  next();
});

app.use((err, _req, res, _next) => {
  console.error("Terjadi kesalahan tidak terduga:", err);
  res.status(500).json({
    error: "Terjadi kesalahan di server.",
    requestId: res.locals.requestId || null,
  });
});

app.listen(PORT, () => {
  console.log(`Server berjalan pada http://localhost:${PORT}`);
});
