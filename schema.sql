-- Schema basis data untuk sistem keamanan & privasi warga.
-- Pastikan setiap perubahan juga diperbarui pada dokumentasi prosedur operasional.

BEGIN;

CREATE TABLE IF NOT EXISTS system_parameters (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS encryption_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_alias TEXT NOT NULL UNIQUE,
    public_material BLOB NOT NULL,
    checksum TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    retired_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nik TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'argon2id',
    password_salt TEXT,
    role TEXT NOT NULL DEFAULT 'operator',
    is_active INTEGER NOT NULL DEFAULT 1,
    must_reset_password INTEGER NOT NULL DEFAULT 0,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS user_password_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    ip_address TEXT,
    user_agent TEXT,
    is_success INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Data warga disimpan dalam bentuk terenkripsi.
-- Hash (nik_hash, kk_hash) digunakan sebagai indeks untuk pencarian tanpa membuka isi data.
CREATE TABLE IF NOT EXISTS citizen_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    nik_hash TEXT NOT NULL UNIQUE,
    kk_hash TEXT NOT NULL,
    payload_ciphertext BLOB NOT NULL,
    payload_nonce TEXT NOT NULL,
    payload_salt TEXT NOT NULL,
    payload_tag TEXT NOT NULL,
    encryption_key_alias TEXT NOT NULL,
    photo_path TEXT,
    photo_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (encryption_key_alias) REFERENCES encryption_keys(key_alias) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_citizen_records_owner ON citizen_records(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_citizen_records_kk_hash ON citizen_records(kk_hash);

CREATE TRIGGER IF NOT EXISTS trg_citizen_records_updated_at
AFTER UPDATE ON citizen_records
FOR EACH ROW
BEGIN
    UPDATE citizen_records
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    WHERE id = OLD.id;
END;

-- Metadata foto disimpan terpisah agar file dapat ditaruh di folder data/storage secara terenkripsi.
CREATE TABLE IF NOT EXISTS citizen_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_record_id INTEGER NOT NULL,
    asset_type TEXT NOT NULL, -- example: 'photo', 'document'
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (citizen_record_id) REFERENCES citizen_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    scope TEXT NOT NULL,
    target_identifier TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_scope ON audit_logs(scope);

CREATE TABLE IF NOT EXISTS data_sharing_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_record_id INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    consent_status TEXT NOT NULL CHECK (consent_status IN ('granted','revoked','expired')),
    valid_until TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (citizen_record_id) REFERENCES citizen_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citizen_profiles (
    user_id INTEGER PRIMARY KEY,
    full_name TEXT,
    nik TEXT,
    birth_place TEXT,
    birth_date TEXT,
    gender TEXT,
    religion TEXT,
    education TEXT,
    occupation TEXT,
    institution TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    ktp_path TEXT,
    kk_path TEXT,
    photo_path TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_citizen_profiles_updated_at
AFTER UPDATE ON citizen_profiles
FOR EACH ROW
BEGIN
    UPDATE citizen_profiles
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    WHERE user_id = OLD.user_id;
END;

COMMIT;
