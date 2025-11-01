"use strict";

(() => {
  const setAlert = (variant, message) => {
    const alertBox = document.getElementById("forgotAlert");
    if (!alertBox) {
      return;
    }
    if (!variant) {
      alertBox.className = "alert d-none";
      alertBox.textContent = "";
      return;
    }
    alertBox.className = "alert";
    alertBox.classList.add(`alert-${variant}`);
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
  };

  const showResult = ({ nik, fullName, resetLink, expiresAt }) => {
    const resultSection = document.getElementById("resetResult");
    const nikEl = document.getElementById("resultNik");
    const nameEl = document.getElementById("resultName");
    const expiryEl = document.getElementById("resultExpiry");
    const linkEl = document.getElementById("resetLink");

    if (!resultSection || !nikEl || !nameEl || !expiryEl || !linkEl) {
      return;
    }

    nikEl.textContent = nik || "-";
    nameEl.textContent = fullName || "-";

    if (expiresAt) {
      const date = new Date(expiresAt);
      if (!Number.isNaN(date.getTime())) {
        expiryEl.textContent = new Intl.DateTimeFormat("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
      } else {
        expiryEl.textContent = "-";
      }
    } else {
      expiryEl.textContent = "-";
    }

    linkEl.href = resetLink;
    linkEl.dataset.resetLink = resetLink;
    resultSection.classList.remove("d-none");
  };

  const hideResult = () => {
    const resultSection = document.getElementById("resetResult");
    if (resultSection) {
      resultSection.classList.add("d-none");
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("forgotForm");
    const nikInput = document.getElementById("forgotNik");
    const submitButton = document.getElementById("requestResetButton");
    const copyButton = document.getElementById("copyLinkButton");

    if (!form || !nikInput || !submitButton || !copyButton) {
      return;
    }

    copyButton.addEventListener("click", () => {
      const linkEl = document.getElementById("resetLink");
      const linkValue = linkEl?.dataset?.resetLink;
      if (!linkValue) {
        setAlert("warning", "Tidak ada tautan yang dapat disalin.");
        return;
      }
      navigator.clipboard
        .writeText(`${window.location.origin}${linkValue}`)
        .then(() => setAlert("success", "Tautan berhasil disalin ke papan klip."))
        .catch(() => setAlert("danger", "Tidak dapat menyalin tautan. Salin manual secara manual."));
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideResult();
      setAlert(null);

      const nik = (nikInput.value || "").trim();
      if (nik.length !== 16 || !/^\d{16}$/.test(nik)) {
        setAlert("danger", "NIK harus berisi 16 digit angka.");
        return;
      }

      submitButton.disabled = true;

      try {
        const response = await fetch("/api/auth/forgot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ nik }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = data.error || "Tidak dapat mencari akun. Coba lagi.";
          setAlert("danger", message);
          return;
        }

        const resetLink = data.resetLink || `/html/forgot-password.html?token=${encodeURIComponent(data.token)}`;

        showResult({
          nik: data.user?.nik || nik,
          fullName: data.user?.fullName || "-",
          resetLink,
          expiresAt: data.expiresAt,
        });

        setAlert("success", "Akun ditemukan. Gunakan tautan di bawah untuk ubah password.");
      } catch (error) {
        console.error("Gagal membuat tautan reset:", error);
        setAlert("danger", "Terjadi kesalahan di server. Coba beberapa saat lagi.");
      } finally {
        submitButton.disabled = false;
      }
    });
  });
})();
