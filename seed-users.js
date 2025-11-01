"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const argon2 = require("argon2");
const { initializeDatabase, getConnection, closeConnection } = require("./db");

const DATA_DIRECTORY = path.resolve(__dirname, "data");
const DATASET_FILENAME = process.env.SEED_DATASET || "seed-users.json";
const DATASET_PATH = path.join(DATA_DIRECTORY, DATASET_FILENAME);
const SAMPLE_DATASET_PATH = path.join(DATA_DIRECTORY, "seed-users.example.json");

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || "19456", 10), // ~19 MB
  timeCost: parseInt(process.env.ARGON2_TIME_COST || "3", 10),
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || "1", 10),
};

function resolveDatasetPath() {
  if (fs.existsSync(DATASET_PATH)) {
    return { path: DATASET_PATH, isSample: false };
  }

  if (process.env.SEED_DATASET) {
    throw new Error(`Berkas seed sesuai SEED_DATASET tidak ditemukan: ${DATASET_PATH}`);
  }

  if (fs.existsSync(SAMPLE_DATASET_PATH)) {
    console.warn(
      `Berkas ${DATASET_FILENAME} tidak ditemukan. Menggunakan contoh: ${SAMPLE_DATASET_PATH}. ` +
        "Salin contoh tersebut ke seed-users.json lalu sesuaikan dengan data sebenarnya."
    );
    return { path: SAMPLE_DATASET_PATH, isSample: true };
  }

  throw new Error(
    `Berkas seed tidak ditemukan. Harap buat ${DATASET_PATH} ` +
      "atau siapkan variabel lingkungan SEED_DATASET yang valid."
  );
}

function readSeedDataset() {
  const { path: datasetPath } = resolveDatasetPath();

  const raw = fs.readFileSync(datasetPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Format berkas seed harus berupa array objek.");
  }

  return parsed;
}

function runStatement(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

async function seedUsers() {
  initializeDatabase();
  const db = getConnection();

  const dataset = readSeedDataset();
  const results = [];

  for (const entry of dataset) {
    if (!entry || !entry.nik || !entry.fullName || !entry.password) {
      console.warn("Lewati entri karena data tidak lengkap:", entry);
      continue;
    }

    const nik = String(entry.nik).trim();
    const fullName = String(entry.fullName).trim();
    const email = entry.email ? String(entry.email).trim() : null;
    const username = entry.username ? String(entry.username).trim() : nik;
    const password = String(entry.password);

    if (!nik || !fullName || !password) {
      console.warn("Lewati entri karena nilai kosong setelah normalisasi:", entry);
      continue;
    }

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

    const statement = `
      INSERT INTO users (nik, full_name, email, username, password_hash, password_algo, is_active, must_reset_password)
      VALUES ($nik, $fullName, $email, $username, $passwordHash, 'argon2id', 1, $mustReset)
      ON CONFLICT(nik) DO UPDATE SET
        full_name = excluded.full_name,
        email = excluded.email,
        username = excluded.username,
        password_hash = excluded.password_hash,
        password_algo = excluded.password_algo,
        is_active = excluded.is_active,
        must_reset_password = excluded.must_reset_password,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    `;

    await runStatement(db, statement, {
      $nik: nik,
      $fullName: fullName,
      $email: email,
      $username: username,
      $passwordHash: passwordHash,
      $mustReset: entry.mustResetPassword ? 1 : 0,
    });

    results.push({ nik, fullName });
    console.info(`Seed akun berhasil untuk NIK ${nik} (${fullName}).`);
  }

  console.info(`Total akun berhasil diproses: ${results.length}`);
}

seedUsers()
  .catch((err) => {
    console.error("Gagal melakukan seed data pengguna:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => closeConnection(), 200);
  });
