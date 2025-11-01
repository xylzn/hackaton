"use strict";

(() => {
  const ADMIN_ENDPOINT = "/api/admin/login";

  const setAlert = (variant, message) => {
    const alertBox = document.getElementById("adminLoginAlert");
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
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("adminLoginForm");
    const passwordInput = document.getElementById("adminPassword");
    const togglePasswordButton = document.getElementById("toggleAdminPassword");
    const submitButton = document.getElementById("adminLoginButton");

    if (!form || !passwordInput || !togglePasswordButton || !submitButton) {
      return;
    }

    togglePasswordButton.addEventListener("click", () => {
      const isHidden = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isHidden ? "text" : "password");
      togglePasswordButton.textContent = isHidden ? "Sembunyikan" : "Lihat";
      togglePasswordButton.setAttribute(
        "aria-label",
        isHidden ? "Sembunyikan password" : "Tampilkan password"
      );
      togglePasswordButton.setAttribute("aria-pressed", String(isHidden));
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setAlert(null, "");

      const password = passwordInput.value.trim();
      if (!password) {
        setAlert("danger", "Password admin wajib diisi.");
        return;
      }

      submitButton.disabled = true;
      try {
        const response = await fetch(ADMIN_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = data.error || "Password admin tidak valid.";
          setAlert("danger", message);
          submitButton.disabled = false;
          return;
        }

        setAlert("success", data.message || "Login admin berhasil. Mengalihkan...");
        setTimeout(() => {
          window.location.href = data.redirect || "/html/dashboard_admin.html";
        }, 800);
      } catch (error) {
        console.error("Gagal login admin:", error);
        setAlert("danger", "Terjadi kesalahan di server. Coba beberapa saat lagi.");
        submitButton.disabled = false;
      } finally {
        passwordInput.value = "";
      }
    });
  });
})();
