"use strict";

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_DIRECTORY = path.resolve(__dirname, "data");
const DB_FILE = path.join(DB_DIRECTORY, process.env.DB_FILE || "citizen_security.db");
const SCHEMA_PATH = path.resolve(__dirname, "schema.sql");

let connection;

function ensureDataDirectory() {
  if (!fs.existsSync(DB_DIRECTORY)) {
    fs.mkdirSync(DB_DIRECTORY, { recursive: true });
  }
}

function getConnection() {
  if (connection) {
    return connection;
  }

  ensureDataDirectory();

  connection = new sqlite3.Database(
    DB_FILE,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
      if (err) {
        console.error("Gagal membuka basis data:", err.message);
        process.exit(1);
      }
    }
  );

  // Aktifkan fitur keamanan & integritas dasar.
  connection.serialize(() => {
    connection.run("PRAGMA journal_mode = WAL;");
    connection.run("PRAGMA foreign_keys = ON;");
    connection.run("PRAGMA secure_delete = TRUE;");
  });

  return connection;
}

function initializeDatabase() {
  const db = getConnection();
  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf8");

  db.serialize(() => {
    db.exec(schemaSql, (err) => {
      if (err) {
        console.error("Gagal menjalankan schema.sql:", err.message);
        process.exit(1);
      }
      console.info("Schema database berhasil diterapkan.");
    });
  });
}

function closeConnection() {
  if (!connection) {
    return;
  }

  connection.close((err) => {
    if (err) {
      console.error("Gagal menutup koneksi basis data:", err.message);
    }
  });
}

module.exports = {
  getConnection,
  initializeDatabase,
  closeConnection,
};

if (require.main === module) {
  const arg = process.argv.slice(2)[0];

  if (arg === "--init") {
    initializeDatabase();
    // Waktu singkat untuk memastikan log sempat tercetak.
    setTimeout(() => closeConnection(), 200);
  } else {
    console.info('Tidak ada perintah yang dijalankan. Gunakan "node db.js --init" untuk membuat skema.');
  }
}
