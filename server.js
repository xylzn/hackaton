"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const argon2 = require("argon2");

const { initializeDatabase, getConnection } = require("./db");

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, "public");
const DATA_STORAGE_DIR = path.join(__dirname, "data", "storage");
const SESSION_COOKIE_NAME = "sid";
const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1000; // 5 menit
const PARSED_SESSION_TTL = Number(process.env.SESSION_TTL_MS);
const SESSION_TTL_MS =
  Number.isFinite(PARSED_SESSION_TTL) && PARSED_SESSION_TTL > 0
    ? PARSED_SESSION_TTL
    : DEFAULT_SESSION_TTL_MS;
const COOKIE_SECURE = process.env.NODE_ENV === "production";
const DEFAULT_RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 menit
const PARSED_RESET_TOKEN_TTL = Number(process.env.RESET_TOKEN_TTL_MS);
const RESET_TOKEN_TTL_MS =
  Number.isFinite(PARSED_RESET_TOKEN_TTL) && PARSED_RESET_TOKEN_TTL > 0
    ? PARSED_RESET_TOKEN_TTL
    : DEFAULT_RESET_TOKEN_TTL_MS;
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: Number(process.env.ARGON2_MEMORY_COST || 19456),
  timeCost: Number(process.env.ARGON2_TIME_COST || 3),
  parallelism: Number(process.env.ARGON2_PARALLELISM || 1),
};

const PROFILE_FIELD_DEFINITIONS = [
  { key: "fullName", column: "full_name" },
  { key: "nik", column: "nik" },
  { key: "birthPlace", column: "birth_place" },
  { key: "birthDate", column: "birth_date" },
  { key: "gender", column: "gender" },
  { key: "religion", column: "religion" },
  { key: "education", column: "education" },
  { key: "occupation", column: "occupation" },
  { key: "institution", column: "institution" },
  { key: "address", column: "address" },
  { key: "phone", column: "phone" },
  { key: "email", column: "email" },
  { key: "photoPath", column: "photo_path" },
  { key: "ktpPath", column: "ktp_path" },
  { key: "kkPath", column: "kk_path" },
];

const ADMIN_PROFILE_SELECT = `
  SELECT
    u.id AS user_id,
    u.nik AS user_nik,
    u.full_name AS user_full_name,
    u.email AS user_email,
    u.role AS user_role,
    u.is_active AS user_is_active,
    u.must_reset_password AS user_must_reset_password,
    u.last_login_at AS user_last_login_at,
    cp.full_name AS cp_full_name,
    cp.nik AS cp_nik,
    cp.birth_place AS cp_birth_place,
    cp.birth_date AS cp_birth_date,
    cp.gender AS cp_gender,
    cp.religion AS cp_religion,
    cp.education AS cp_education,
    cp.occupation AS cp_occupation,
    cp.institution AS cp_institution,
    cp.address AS cp_address,
    cp.phone AS cp_phone,
    cp.email AS cp_email,
    cp.ktp_path AS cp_ktp_path,
    cp.kk_path AS cp_kk_path,
    cp.photo_path AS cp_photo_path,
    cp.updated_at AS cp_updated_at
  FROM users u
  LEFT JOIN citizen_profiles cp ON cp.user_id = u.id
`;

const PROFILE_COMPLETION_FIELDS = [
  { key: "fullName", source: "user", label: "Nama Lengkap" },
  { key: "nik", source: "user", label: "NIK" },
  { key: "email", source: "user", label: "Email" },
  { key: "birthPlace", source: "profile", label: "Tempat Lahir" },
  { key: "birthDate", source: "profile", label: "Tanggal Lahir" },
  { key: "gender", source: "profile", label: "Jenis Kelamin" },
  { key: "religion", source: "profile", label: "Agama" },
  { key: "education", source: "profile", label: "Pendidikan" },
  { key: "occupation", source: "profile", label: "Pekerjaan" },
  { key: "institution", source: "profile", label: "Instansi" },
  { key: "address", source: "profile", label: "Alamat" },
  { key: "phone", source: "profile", label: "Nomor Telepon" },
];

function ensureStorageDir() {
  if (!fs.existsSync(DATA_STORAGE_DIR)) {
    fs.mkdirSync(DATA_STORAGE_DIR, { recursive: true });
  }
}

initializeDatabase();
ensureStorageDir();
const db = getConnection();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function sanitizeNik(rawNik = "") {
  return String(rawNik).replace(/\D/g, "");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashSessionToken(token);
  const expiresAtDate = new Date(Date.now() + SESSION_TTL_MS);
  const expiresAtIso = expiresAtDate.toISOString();

  await dbRun(
    `
      INSERT INTO sessions (user_id, session_hash, expires_at, revoked_at)
      VALUES (?, ?, ?, NULL)
    `,
    [userId, hashedToken, expiresAtIso]
  );

  return {
    token,
    hashedToken,
    expiresAt: expiresAtIso,
  };
}

async function pruneResetTokens(userId) {
  await dbRun(
    `
      DELETE FROM password_reset_tokens
      WHERE user_id = ?
        AND (
          used_at IS NOT NULL
          OR datetime(expires_at) <= datetime('now')
        )
    `,
    [userId]
  );
}

async function createPasswordResetToken(userId) {
  await pruneResetTokens(userId);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAtIso = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  await dbRun(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at)
      VALUES (?, ?, ?, NULL)
    `,
    [userId, tokenHash, expiresAtIso]
  );

  return {
    token,
    tokenHash,
    expiresAt: expiresAtIso,
  };
}

async function getPasswordResetToken(rawToken) {
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);

  return dbGet(
    `
      SELECT
        prt.id AS reset_id,
        prt.user_id AS reset_user_id,
        prt.token_hash,
        prt.expires_at,
        prt.used_at,
        prt.created_at AS reset_created_at,
        u.id AS user_id,
        u.nik,
        u.full_name,
        u.email,
        u.password_hash,
        u.is_active
      FROM password_reset_tokens prt
      INNER JOIN users u ON u.id = prt.user_id
      WHERE prt.token_hash = ?
    `,
    [tokenHash]
  );
}

async function markResetTokenUsed(resetId) {
  const usedAt = new Date().toISOString();
  await dbRun(
    `
      UPDATE password_reset_tokens
      SET used_at = ?
      WHERE id = ?
    `,
    [usedAt, resetId]
  );
  return usedAt;
}

function isResetTokenValid(record) {
  if (!record) {
    return { valid: false, reason: "Token tidak ditemukan." };
  }
  if (record.used_at) {
    return { valid: false, reason: "Token sudah digunakan." };
  }
  const expiresAt = new Date(record.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: "Token sudah kedaluwarsa." };
  }
  if (record.is_active !== 1) {
    return { valid: false, reason: "Akun dalam keadaan tidak aktif." };
  }
  return { valid: true };
}

async function recordLoginAttempt({
  userId,
  nik,
  ipAddress,
  userAgent,
  isSuccess,
}) {
  try {
    await dbRun(
      `
        INSERT INTO login_attempts (user_id, username, ip_address, user_agent, is_success)
        VALUES ($userId, $username, $ipAddress, $userAgent, $isSuccess)
      `,
      {
        $userId: userId || null,
        $username: nik || null,
        $ipAddress: ipAddress || null,
        $userAgent: userAgent || null,
        $isSuccess: isSuccess ? 1 : 0,
      }
    );
  } catch (error) {
    console.error("Gagal mencatat login attempt:", error.message);
  }
}

function setSessionCookie(res, token, expiresAtIso) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    expires: new Date(expiresAtIso),
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
  });
}

function extractSessionToken(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === SESSION_COOKIE_NAME) {
      return value;
    }
  }

  return null;
}

async function findActiveSession(token) {
  if (!token) {
    return null;
  }

  const hashedToken = hashSessionToken(token);
  const row = await dbGet(
    `
      SELECT
        s.id AS session_id,
        s.user_id,
        s.expires_at,
        u.nik,
        u.full_name,
        u.email,
        u.role,
        u.is_active,
        u.must_reset_password,
        u.last_login_at
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.session_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
    `,
    [hashedToken]
  );

  if (!row) {
    return null;
  }

  return {
    session: {
      id: row.session_id,
      userId: row.user_id,
      expiresAt: row.expires_at,
    },
    user: {
      id: row.user_id,
      nik: row.nik,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      isActive: row.is_active === 1,
      mustResetPassword: row.must_reset_password === 1,
      lastLoginAt: row.last_login_at,
    },
  };
}

async function hydrateSessionContext(req, res) {
  if (!req.path.startsWith("/api/")) {
    return;
  }

  const token = extractSessionToken(req);
  if (!token) {
    return;
  }

  const activeSession = await findActiveSession(token);
  if (!activeSession) {
    clearSessionCookie(res);
    return;
  }

  req.auth = activeSession;
}

function requireAuth(req, res, next) {
  if (!req.auth || !req.auth.user || !req.auth.session) {
    res.status(401).json({ error: "Sesi login tidak ditemukan atau sudah kedaluwarsa." });
    return;
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.user || req.auth.user.role !== role) {
      res.status(403).json({ error: "Akses ditolak. Hak akses tidak mencukupi." });
      return;
    }
    next();
  };
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function mapUserResponse(user = {}) {
  return {
    nik: user.nik || null,
    fullName: user.fullName || null,
    email: user.email || null,
    role: user.role || null,
    isActive: Boolean(user.isActive),
    mustResetPassword: Boolean(user.mustResetPassword),
    lastLoginAt: user.lastLoginAt || null,
  };
}

function mapProfileRow(row) {
  const mapped = {};
  for (const field of PROFILE_FIELD_DEFINITIONS) {
    mapped[field.key] = row && field.column in row ? row[field.column] : null;
  }
  mapped.updatedAt = row ? row.updated_at || null : null;
  return mapped;
}

function computeProfileCompletion(user, profile) {
  if (!Array.isArray(PROFILE_COMPLETION_FIELDS) || PROFILE_COMPLETION_FIELDS.length === 0) {
    return {
      percentage: 0,
      totalFields: 0,
      filledFields: 0,
      details: [],
    };
  }

  const details = [];
  let filledFields = 0;

  for (const field of PROFILE_COMPLETION_FIELDS) {
    let value = null;
    if (field.source === "profile") {
      value = profile[field.key];
    } else if (field.source === "user") {
      value = user[field.key];
    }

    const isFilled = value != null && String(value).trim() !== "";
    if (isFilled) {
      filledFields += 1;
    }

    details.push({
      key: field.key,
      label: field.label,
      filled: isFilled,
    });
  }

  const totalFields = PROFILE_COMPLETION_FIELDS.length;
  const percentage = totalFields === 0 ? 0 : (filledFields / totalFields) * 100;

  return {
    percentage,
    totalFields,
    filledFields,
    details,
  };
}

async function getUserRowById(userId) {
  return dbGet(
    `
      SELECT id, nik, full_name, email, role, is_active, must_reset_password, last_login_at
      FROM users
      WHERE id = ?
    `,
    [userId]
  );
}

async function getProfilePayload(userId) {
  const userRow = await getUserRowById(userId);

  if (!userRow) {
    return null;
  }

  const user = mapUserResponse({
    nik: userRow.nik,
    fullName: userRow.full_name,
    email: userRow.email,
    role: userRow.role,
    isActive: userRow.is_active === 1,
    mustResetPassword: userRow.must_reset_password === 1,
    lastLoginAt: userRow.last_login_at,
  });

  const profileRow = await dbGet(
    `
      SELECT *
      FROM citizen_profiles
      WHERE user_id = ?
    `,
    [userId]
  );

  const profile = mapProfileRow(profileRow);
  const completion = computeProfileCompletion(user, profile);

  return { user, profile, completion };
}

function mapProfileFromJoinedRow(row) {
  if (!row) {
    return mapProfileRow(null);
  }
  const profileRow = {};
  for (const definition of PROFILE_FIELD_DEFINITIONS) {
    const aliasKey = `cp_${definition.column}`;
    profileRow[definition.column] = Object.prototype.hasOwnProperty.call(row, aliasKey)
      ? row[aliasKey]
      : null;
  }
  profileRow.updated_at = row.cp_updated_at || null;
  return mapProfileRow(profileRow);
}

function mapJoinedRowToPayload(row) {
  if (!row) {
    return null;
  }

  const user = mapUserResponse({
    nik: row.user_nik,
    fullName: row.user_full_name || row.cp_full_name,
    email: row.user_email,
    role: row.user_role,
    isActive: row.user_is_active === 1,
    mustResetPassword: row.user_must_reset_password === 1,
    lastLoginAt: row.user_last_login_at,
  });

  const profile = mapProfileFromJoinedRow(row);
  const completion = computeProfileCompletion(user, profile);

  return { user, profile, completion };
}

const PASSWORD_REQUIREMENTS = [
  {
    key: "length",
    message: "Minimal 8 karakter.",
    test: (pwd) => pwd.length >= 8,
  },
  {
    key: "upper",
    message: "Minimal 1 huruf kapital.",
    test: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    key: "lower",
    message: "Minimal 1 huruf kecil.",
    test: (pwd) => /[a-z]/.test(pwd),
  },
  {
    key: "number",
    message: "Minimal 1 angka.",
    test: (pwd) => /[0-9]/.test(pwd),
  },
  {
    key: "special",
    message: "Minimal 1 karakter spesial.",
    test: (pwd) => /[!@#$%^&*(),.?\":{}|<>]/.test(pwd),
  },
];

function validatePasswordStrength(password) {
  if (typeof password !== "string") {
    return {
      isValid: false,
      failed: PASSWORD_REQUIREMENTS.map((requirement) => requirement.key),
      messages: PASSWORD_REQUIREMENTS.map((requirement) => requirement.message),
    };
  }

  const failed = PASSWORD_REQUIREMENTS.filter(
    (requirement) => !requirement.test(password)
  ).map((requirement) => requirement.key);

  return {
    isValid: failed.length === 0,
    failed,
    messages: PASSWORD_REQUIREMENTS.filter((requirement) =>
      failed.includes(requirement.key)
    ).map((requirement) => requirement.message),
  };
}

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
app.use((req, res, next) => {
  hydrateSessionContext(req, res)
    .then(() => next())
    .catch(next);
});
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

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const rawNik = req.body?.nik;
    const password = req.body?.password;

    if (!rawNik || typeof rawNik !== "string" || !password) {
      res.status(400).json({ error: "NIK dan kata sandi wajib diisi." });
      return;
    }

    const nik = sanitizeNik(rawNik);

    if (nik.length !== 16) {
      res.status(400).json({ error: "Format NIK tidak valid. Pastikan terdiri dari 16 digit." });
      return;
    }

    const userRow = await dbGet(
      `
        SELECT id, nik, full_name, email, role, is_active, must_reset_password, password_hash, last_login_at
        FROM users
        WHERE nik = ?
      `,
      [nik]
    );

    const ipForwarded = req.headers["x-forwarded-for"];
    const ipAddress = Array.isArray(ipForwarded)
      ? ipForwarded[0]
      : (ipForwarded || "").split(",")[0].trim() || req.ip;
    const userAgentRaw = req.headers["user-agent"] || "";
    const userAgent = userAgentRaw.slice(0, 255);

    if (!userRow || userRow.is_active !== 1) {
      await recordLoginAttempt({
        userId: userRow ? userRow.id : null,
        nik,
        ipAddress,
        userAgent,
        isSuccess: false,
      });
      res.status(401).json({ error: "NIK atau kata sandi tidak sesuai." });
      return;
    }

    const isPasswordValid = await argon2.verify(userRow.password_hash, password);

    if (!isPasswordValid) {
      await recordLoginAttempt({
        userId: userRow.id,
        nik,
        ipAddress,
        userAgent,
        isSuccess: false,
      });
      res.status(401).json({ error: "NIK atau kata sandi tidak sesuai." });
      return;
    }

    const loginTimestamp = new Date().toISOString();
    const session = await createSession(userRow.id);

    await Promise.all([
      dbRun("UPDATE users SET last_login_at = ? WHERE id = ?", [
        loginTimestamp,
        userRow.id,
      ]),
      recordLoginAttempt({
        userId: userRow.id,
        nik,
        ipAddress,
        userAgent,
        isSuccess: true,
      }),
    ]);

    setSessionCookie(res, session.token, session.expiresAt);

    const responseUser = mapUserResponse({
      nik: userRow.nik,
      fullName: userRow.full_name,
      email: userRow.email,
      role: userRow.role,
      isActive: userRow.is_active === 1,
      mustResetPassword: userRow.must_reset_password === 1,
      lastLoginAt: loginTimestamp,
    });

    res.json({
      message: "Login berhasil.",
      user: responseUser,
      session: {
        expiresAt: session.expiresAt,
      },
    });
  })
);

app.post(
  "/api/admin/login",
  asyncHandler(async (req, res) => {
    const password = req.body?.password;
    const expected = process.env.ADMIN_DASHBOARD_PASSWORD || "Admin123!";

    if (!password) {
      res.status(400).json({ error: "Password wajib diisi." });
      return;
    }

    if (password !== expected) {
      res.status(401).json({ error: "Password admin tidak sesuai." });
      return;
    }

    const adminRow = await dbGet(
      `
        SELECT id
        FROM users
        WHERE role = 'admin'
        ORDER BY created_at ASC
        LIMIT 1
      `
    );

    if (!adminRow) {
      res.status(500).json({ error: "Belum ada akun admin terdaftar. Tambahkan pengguna dengan role 'admin' terlebih dahulu." });
      return;
    }

    const session = await createSession(adminRow.id);
    setSessionCookie(res, session.token, session.expiresAt);

    res.json({
      message: "Login admin berhasil.",
      redirect: "/html/dashboard_admin.html",
    });
  })
);

app.post(
  "/api/auth/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const logoutTimestamp = new Date().toISOString();
    await dbRun(
      "UPDATE sessions SET revoked_at = ? WHERE id = ?",
      [logoutTimestamp, req.auth.session.id]
    );
    clearSessionCookie(res);
    res.json({ message: "Logout berhasil." });
  })
);

app.post(
  "/api/auth/forgot",
  asyncHandler(async (req, res) => {
    const rawNik = req.body?.nik;
    if (!rawNik || typeof rawNik !== "string") {
      res.status(400).json({ error: "NIK wajib diisi." });
      return;
    }

    const nik = sanitizeNik(rawNik);
    if (nik.length !== 16) {
      res.status(400).json({ error: "Format NIK tidak valid. Pastikan terdiri dari 16 digit." });
      return;
    }

    const userRow = await dbGet(
      `
        SELECT id, full_name, is_active
        FROM users
        WHERE nik = ?
      `,
      [nik]
    );

    if (!userRow) {
      res.status(404).json({ error: "NIK tidak ditemukan atau belum terdaftar." });
      return;
    }

    if (userRow.is_active !== 1) {
      res.status(403).json({ error: "Akun dalam keadaan tidak aktif." });
      return;
    }

    const tokenInfo = await createPasswordResetToken(userRow.id);
    const resetPath = `/html/lupapassword.html?token=${tokenInfo.token}`;

    res.json({
      message: "Link reset password berhasil dibuat.",
      resetLink: resetPath,
      token: tokenInfo.token,
      expiresAt: tokenInfo.expiresAt,
      user: {
        nik,
        fullName: userRow.full_name,
      },
    });
  })
);

app.get(
  "/api/auth/reset-password/validate",
  asyncHandler(async (req, res) => {
    const token = req.query?.token;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Token reset tidak ditemukan." });
      return;
    }

    const record = await getPasswordResetToken(token);
    const validation = isResetTokenValid(record);

    if (!validation.valid) {
      res.status(400).json({ error: validation.reason || "Token tidak valid." });
      return;
    }

    res.json({
      valid: true,
      nik: record.nik,
      fullName: record.full_name,
      expiresAt: record.expires_at,
    });
  })
);

app.post(
  "/api/auth/reset-password",
  asyncHandler(async (req, res) => {
    const token = req.body?.token;
    const newPassword = req.body?.newPassword;

    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Token reset wajib disertakan." });
      return;
    }

    if (!newPassword) {
      res.status(400).json({ error: "Password baru wajib diisi." });
      return;
    }

    const record = await getPasswordResetToken(token);
    const validation = isResetTokenValid(record);

    if (!validation.valid) {
      res.status(400).json({ error: validation.reason || "Token tidak valid." });
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      res.status(400).json({
        error: "Password baru belum memenuhi ketentuan.",
        failed: strength.failed,
        messages: strength.messages,
      });
      return;
    }

    const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await dbRun(
      `
        INSERT INTO user_password_history (user_id, password_hash)
        VALUES (?, ?)
      `,
      [record.user_id, record.password_hash]
    );

    await dbRun(
      `
        UPDATE users
        SET password_hash = ?, password_algo = 'argon2id', must_reset_password = 0
        WHERE id = ?
      `,
      [newHash, record.user_id]
    );

    await dbRun(
      `
        UPDATE sessions
        SET revoked_at = datetime('now')
        WHERE user_id = ? AND revoked_at IS NULL
      `,
      [record.user_id]
    );

    await markResetTokenUsed(record.reset_id);

    res.json({
      message: "Password berhasil diubah. Silakan login dengan password baru Anda.",
    });
  })
);

app.post(
  "/api/auth/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.user.id;
    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Password saat ini dan password baru wajib diisi." });
      return;
    }

    const userRow = await dbGet(
      `
        SELECT id, password_hash
        FROM users
        WHERE id = ?
      `,
      [userId]
    );

    if (!userRow) {
      res.status(404).json({ error: "Data pengguna tidak ditemukan." });
      return;
    }

    const isCurrentValid = await argon2.verify(userRow.password_hash, currentPassword);
    if (!isCurrentValid) {
      res.status(401).json({ error: "Password saat ini tidak sesuai." });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ error: "Password baru tidak boleh sama dengan password saat ini." });
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      res.status(400).json({
        error: "Password baru belum memenuhi ketentuan.",
        failed: strength.failed,
        messages: strength.messages,
      });
      return;
    }

    const isSameAsCurrent = await argon2.verify(userRow.password_hash, newPassword).catch(() => false);
    if (isSameAsCurrent) {
      res.status(400).json({ error: "Password baru tidak boleh sama dengan password saat ini." });
      return;
    }

    const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await dbRun(
      `
        INSERT INTO user_password_history (user_id, password_hash)
        VALUES (?, ?)
      `,
      [userId, userRow.password_hash]
    );

    await dbRun(
      `
        UPDATE users
        SET password_hash = ?, password_algo = 'argon2id', must_reset_password = 0
        WHERE id = ?
      `,
      [newHash, userId]
    );

    res.json({
      message: "Password berhasil diubah.",
    });
  })
);

app.get(
  "/api/admin/profiles",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const searchRaw = req.query?.q ? String(req.query.q).trim().toLowerCase() : "";
    const params = [];
    let whereClause = "";

    if (searchRaw) {
      const like = `%${searchRaw}%`;
      whereClause = `
        WHERE
          LOWER(u.nik) LIKE ?
          OR LOWER(u.full_name) LIKE ?
          OR LOWER(COALESCE(cp.full_name, '')) LIKE ?
      `;
      params.push(like, like, like);
    }

    const rows = await dbAll(`${ADMIN_PROFILE_SELECT} ${whereClause} ORDER BY u.created_at DESC`, params);

    const items = rows.map((row) => {
      const payload = mapJoinedRowToPayload(row);
      return {
        id: row.user_id,
        nik: payload.user.nik,
        fullName: payload.user.fullName || payload.profile.fullName || "-",
        email: payload.user.email || payload.profile.email || "-",
        role: payload.user.role,
        isActive: payload.user.isActive,
        lastLoginAt: payload.user.lastLoginAt,
        completion: Math.round(payload.completion.percentage || 0),
        updatedAt: payload.profile.updatedAt,
      };
    });

    res.json({ items });
  })
);

app.get(
  "/api/admin/profiles/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "ID pengguna tidak valid." });
      return;
    }

    const row = await dbGet(`${ADMIN_PROFILE_SELECT} WHERE u.id = ?`, [userId]);
    if (!row) {
      res.status(404).json({ error: "Data pengguna tidak ditemukan." });
      return;
    }

    const payload = mapJoinedRowToPayload(row);
    res.json(payload);
  })
);

app.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = await getProfilePayload(req.auth.user.id);

    if (!payload) {
      res.status(404).json({ error: "Data pengguna tidak ditemukan." });
      return;
    }

    res.json({
      user: payload.user,
      profile: payload.profile,
      completion: payload.completion,
      session: {
        expiresAt: req.auth.session.expiresAt,
      },
    });
  })
);

app.get(
  "/api/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = await getProfilePayload(req.auth.user.id);
    if (!payload) {
      res.status(404).json({ error: "Data pengguna tidak ditemukan." });
      return;
    }
    res.json(payload);
  })
);

app.post(
  "/api/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth.user.id;
    const {
      fullName,
      email,
      birthPlace = null,
      birthDate = null,
      gender = null,
      religion = null,
      education = null,
      occupation = null,
      institution = null,
      address = null,
      phone = null,
    } = req.body || {};

    if (!fullName || !email) {
      res.status(400).json({ error: "Nama lengkap dan email wajib diisi." });
      return;
    }

    const trimmedFullName = String(fullName).trim();
    const trimmedEmail = String(email).trim();

    if (!trimmedFullName) {
      res.status(400).json({ error: "Nama lengkap tidak boleh kosong." });
      return;
    }

    if (!trimmedEmail) {
      res.status(400).json({ error: "Email tidak boleh kosong." });
      return;
    }

    const userRow = await getUserRowById(userId);
    if (!userRow) {
      res.status(404).json({ error: "Data pengguna tidak ditemukan." });
      return;
    }

    const nik = userRow.nik;

    await dbRun(
      `
        UPDATE users
        SET full_name = ?, email = ?
        WHERE id = ?
      `,
      [trimmedFullName, trimmedEmail, userId]
    );

    await dbRun(
      `
        INSERT INTO citizen_profiles (
          user_id,
          full_name,
          nik,
          email,
          birth_place,
          birth_date,
          gender,
          religion,
          education,
          occupation,
          institution,
          address,
          phone
        )
        VALUES (
          $userId,
          $fullName,
          $nik,
          $email,
          $birthPlace,
          $birthDate,
          $gender,
          $religion,
          $education,
          $occupation,
          $institution,
          $address,
          $phone
        )
        ON CONFLICT(user_id) DO UPDATE SET
          full_name = excluded.full_name,
          nik = excluded.nik,
          email = excluded.email,
          birth_place = excluded.birth_place,
          birth_date = excluded.birth_date,
          gender = excluded.gender,
          religion = excluded.religion,
          education = excluded.education,
          occupation = excluded.occupation,
          institution = excluded.institution,
          address = excluded.address,
          phone = excluded.phone
      `,
      {
        $userId: userId,
        $fullName: trimmedFullName,
        $nik: nik,
        $email: trimmedEmail,
        $birthPlace: birthPlace ? String(birthPlace).trim() : null,
        $birthDate: birthDate ? String(birthDate).trim() : null,
        $gender: gender ? String(gender).trim() : null,
        $religion: religion ? String(religion).trim() : null,
        $education: education ? String(education).trim() : null,
        $occupation: occupation ? String(occupation).trim() : null,
        $institution: institution ? String(institution).trim() : null,
        $address: address ? String(address).trim() : null,
        $phone: phone ? String(phone).trim() : null,
      }
    );

    const payload = await getProfilePayload(userId);
    res.json(payload);
  })
);

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
