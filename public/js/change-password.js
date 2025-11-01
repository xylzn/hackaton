"use strict";

(() => {
  const requirements = [
    {
      key: "length",
      elementId: "criteria-length",
      test: (value) => value.length >= 8,
      message: "Minimal 8 karakter.",
    },
    {
      key: "upper",
      elementId: "criteria-upper",
      test: (value) => /[A-Z]/.test(value),
      message: "Minimal 1 huruf kapital.",
    },
    {
      key: "lower",
      elementId: "criteria-lower",
      test: (value) => /[a-z]/.test(value),
      message: "Minimal 1 huruf kecil.",
    },
    {
      key: "number",
      elementId: "criteria-number",
      test: (value) => /[0-9]/.test(value),
      message: "Minimal 1 angka.",
    },
    {
      key: "special",
      elementId: "criteria-special",
      test: (value) => /[!@#$%^&*(),.?\":{}|<>]/.test(value),
      message: "Minimal 1 karakter spesial.",
    },
  ];

  const showAlert = (variant, message) => {
    const alertBox = document.getElementById("changePasswordAlert");
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

  const validateNewPassword = (newPassword, confirmPassword) => {
    let allValid = true;

    for (const requirement of requirements) {
      const element = document.getElementById(requirement.elementId);
      if (!element) {
        continue;
      }
      if (requirement.test(newPassword)) {
        element.classList.add("valid");
      } else {
        element.classList.remove("valid");
        allValid = false;
      }
    }

    const matchElement = document.getElementById("criteria-match");
    const isMatch =
      newPassword.length > 0 &&
      confirmPassword.length > 0 &&
      newPassword === confirmPassword;
    if (matchElement) {
      matchElement.classList.toggle("valid", isMatch);
    }

    return allValid && isMatch;
  };

  const togglePasswordVisibility = (button, input) => {
    const isHidden = input.getAttribute("type") === "password";
    input.setAttribute("type", isHidden ? "text" : "password");
    button.textContent = isHidden ? "Sembunyikan" : "Lihat";
    button.setAttribute(
      "aria-label",
      isHidden ? "Sembunyikan password" : "Tampilkan password"
    );
    button.setAttribute("aria-pressed", String(isHidden));
  };

  const setupPasswordToggles = () => {
    document.querySelectorAll(".toggle-password").forEach((button) => {
      const targetId = button.getAttribute("data-target");
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) {
        return;
      }
      button.addEventListener("click", () => togglePasswordVisibility(button, input));
    });
  };

  const attachNavbarEvents = () => {
    window.addEventListener("navbar:logout", async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("Gagal melakukan logout:", error);
      } finally {
        localStorage.removeItem("nik");
        window.location.replace("/html/login.html");
      }
    });

    window.addEventListener("navbar:change-password", () => {
      // sudah berada di halaman ini
    });

    window.addEventListener("navbar:sidebar-select", (event) => {
      const key = event?.detail?.key;
      if (!key) {
        return;
      }
      if (key === "dashboard") {
        window.location.href = "/html/dashboard.html";
        return;
      }
      if (key === "update") {
        window.location.href = "/html/input.html";
        return;
      }
      if (key === "laporan") {
        alert("Menu laporan masih dalam pengembangan.");
      }
    });
  };

  const getNavigationType = () => {
    const entries = window.performance?.getEntriesByType("navigation");
    if (entries && entries.length > 0 && entries[0]) {
      return entries[0].type;
    }
    return null;
  };

  const enforceReloadGuard = () => {
    if (getNavigationType() === "reload") {
      window.location.replace("/html/login.html");
      return true;
    }
    return false;
  };

  const populateUserNik = async () => {
    const nikField = document.getElementById("currentNik");
    if (!nikField) {
      return;
    }
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.status === 401) {
        window.location.replace("/html/login.html");
        return;
      }
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const payload = await response.json();
      const nik = payload?.user?.nik || payload?.profile?.nik || "";
      nikField.value = nik || "";
    } catch (error) {
      console.error("Gagal memuat data pengguna:", error);
      showAlert("danger", "Tidak dapat memuat data akun. Silakan coba lagi.");
    }
  };

  const validateResetToken = async (token) => {
    const response = await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || "Token reset tidak valid atau sudah kedaluwarsa.";
      throw new Error(message);
    }
    return data;
  };

  const submitResetPassword = async (token, newPassword) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.messages?.join(" ") || data.error || "Gagal mengatur ulang password.";
      throw new Error(message);
    }
    return data;
  };

  const submitAuthenticatedChange = async (currentPassword, newPassword) => {
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.messages?.join(" ") || data.error || "Gagal memperbarui password.";
      throw new Error(message);
    }
    return data;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("changePasswordForm");
    const nikField = document.getElementById("currentNik");
    const currentPasswordGroup = document.querySelector("[data-role=\"current-password-group\"]");
    const currentPasswordInput = document.getElementById("currentPassword");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const submitButton = document.getElementById("savePasswordButton");
    const secondaryLink = document.getElementById("secondaryActionLink");
    const leadText = document.querySelector(".change-password-header .lead");

    if (!form || !nikField || !newPasswordInput || !confirmPasswordInput || !submitButton) {
      return;
    }

    setupPasswordToggles();
    attachNavbarEvents();

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const mode = token ? "reset" : "auth";

    const recomputeValidity = () => {
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      const meetsCriteria = validateNewPassword(newPassword, confirmPassword);
      const hasCurrentPassword =
        mode === "auth"
          ? (currentPasswordInput?.value || "").trim().length > 0
          : true;
      submitButton.disabled = !meetsCriteria || !hasCurrentPassword;
    };

    const registerInputListeners = () => {
      newPasswordInput.addEventListener("input", recomputeValidity);
      confirmPasswordInput.addEventListener("input", recomputeValidity);
      if (currentPasswordInput) {
        currentPasswordInput.addEventListener("input", recomputeValidity);
      }
    };

    if (mode === "reset") {
      if (currentPasswordGroup) {
        currentPasswordGroup.classList.add("d-none");
      }
      if (currentPasswordInput) {
        currentPasswordInput.required = false;
      }
      if (secondaryLink) {
        secondaryLink.textContent = "Kembali ke Login";
        secondaryLink.href = "/html/login.html";
      }
      if (leadText) {
        leadText.textContent =
          "Password saat ini tidak diperlukan. Gunakan token reset yang berlaku sementara ini untuk menetapkan password baru.";
      }

      registerInputListeners();

      if (!token) {
        showAlert("danger", "Token reset tidak ditemukan. Mulai ulang proses lupa password.");
        submitButton.disabled = true;
        return;
      }

      validateResetToken(token)
        .then((payload) => {
          nikField.value = payload?.nik || "";
          showAlert("success", "Token valid. Silakan tetapkan password baru Anda.");
          recomputeValidity();
        })
        .catch((error) => {
          showAlert("danger", error.message || "Token reset tidak valid. Mulai ulang proses lupa password.");
          submitButton.disabled = true;
        });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        showAlert(null, "");

        if (submitButton.disabled) {
          return;
        }

        submitButton.disabled = true;
        try {
          const data = await submitResetPassword(token, newPasswordInput.value);
          showAlert("success", data.message || "Password berhasil diubah. Silakan login dengan password baru.");
          submitButton.disabled = true;
          newPasswordInput.value = "";
          confirmPasswordInput.value = "";
          recomputeValidity();
        } catch (error) {
          showAlert("danger", error.message || "Gagal mengatur ulang password. Coba lagi.");
          submitButton.disabled = false;
        }
      });
    } else {
      if (secondaryLink) {
        secondaryLink.textContent = "Kembali ke Dashboard";
        secondaryLink.href = "/html/dashboard.html";
      }
      registerInputListeners();

      if (enforceReloadGuard()) {
        return;
      }

      populateUserNik();
      recomputeValidity();

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        showAlert(null, "");

        if (submitButton.disabled) {
          return;
        }

        submitButton.disabled = true;

        try {
          const data = await submitAuthenticatedChange(
            currentPasswordInput.value,
            newPasswordInput.value
          );
          showAlert("success", data.message || "Password berhasil diubah. Mengalihkan ke dashboard...");
          setTimeout(() => {
            window.location.href = "/html/dashboard.html";
          }, 1200);
        } catch (error) {
          showAlert("danger", error.message || "Gagal memperbarui password. Coba lagi.");
          submitButton.disabled = false;
        } finally {
          if (currentPasswordInput) {
            currentPasswordInput.value = "";
          }
          newPasswordInput.value = "";
          confirmPasswordInput.value = "";
          recomputeValidity();
        }
      });
    }
  });
})();
