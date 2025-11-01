"use strict";

(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    if (!form) {
      return;
    }

    const nikInput = document.getElementById("nik");
    const passInput = document.getElementById("password");
    const nikError = document.getElementById("nikError");
    const passError = document.getElementById("passError");
    const submitButton = form.querySelector('input[type="submit"]');

    const savedNik = localStorage.getItem("nik");
    if (savedNik) {
      nikInput.value = savedNik;
    }

    const setNikError = (message) => {
      nikError.textContent = message;
      nikError.style.display = "block";
      nikInput.style.borderColor = "red";
    };

    const clearNikError = () => {
      nikError.style.display = "none";
      nikInput.style.borderColor = "#ccc";
    };

    const setPasswordError = (message) => {
      passError.textContent = message;
      passError.style.display = "block";
      passInput.style.borderColor = "red";
    };

    const clearPasswordError = () => {
      passError.style.display = "none";
      passInput.style.borderColor = "#ccc";
    };

    const setLoading = (isLoading) => {
      if (!submitButton) {
        return;
      }
      submitButton.disabled = isLoading;
    };

    nikInput.addEventListener("input", () => {
      const numericValue = nikInput.value.replace(/\D/g, "");
      nikInput.value = numericValue;
      localStorage.setItem("nik", numericValue);

      if (numericValue.length > 0 && numericValue.length < 16) {
        setNikError("NIK harus terdiri dari 16 digit angka.");
      } else {
        clearNikError();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearNikError();
      clearPasswordError();

      const nik = nikInput.value.trim();
      const password = passInput.value.trim();

      let hasError = false;

      if (nik.length !== 16 || !/^\d{16}$/.test(nik)) {
        setNikError("NIK harus berisi 16 digit angka.");
        localStorage.removeItem("nik");
        hasError = true;
      }

      if (!password) {
        setPasswordError("Kata sandi wajib diisi.");
        hasError = true;
      }

      if (hasError) {
        passInput.value = "";
        return;
      }

      setLoading(true);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ nik, password }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = data.error || "Terjadi kesalahan saat login.";
          if (response.status === 400) {
            setNikError(message);
          } else if (response.status === 401) {
            setNikError(message);
            setPasswordError(message);
          } else {
            setPasswordError(message);
          }
          passInput.value = "";
          return;
        }

        localStorage.setItem("nik", nik);
        window.location.href = "/html/dashboard.html";
      } catch (error) {
        setPasswordError("Tidak dapat terhubung ke server. Coba lagi.");
        console.error("Login error:", error);
      } finally {
        setLoading(false);
        passInput.value = "";
      }
    });
  });
})();
