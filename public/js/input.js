"use strict";

(() => {
  const sendLogoutBeacon = () => {
    const url = "/api/auth/logout";
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          credentials: "include",
          keepalive: true,
        }).catch(() => {});
      }
    } catch (_error) {
      // ignore
    }
  };

  const enforceReloadLogin = () => {
    const navigationEntries = window.performance?.getEntriesByType("navigation");
    const navigationType = navigationEntries && navigationEntries[0]?.type;

    if (navigationType === "reload") {
      sendLogoutBeacon();
      window.location.replace("/html/login.html");
      return true;
    }
    return false;
  };

  const registerNavbarEvents = () => {
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
        window.location.href = "/html/login.html";
      }
    });

    window.addEventListener("navbar:change-password", () => {
      window.location.href = "/html/lupapassword.html";
    });

    window.addEventListener("navbar:change-password", () => {
      alert("Fitur ubah password akan segera tersedia.");
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
        return;
      }
      if (key === "laporan") {
        alert("Menu laporan masih dalam pengembangan.");
      }
    });
  };

  const showAlert = (type, message) => {
    const alertBox = document.getElementById("formAlert");
    if (!alertBox) {
      return;
    }
    alertBox.className = "alert";
    alertBox.classList.add(`alert-${type}`);
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
  };

  const hideAlert = () => {
    const alertBox = document.getElementById("formAlert");
    if (!alertBox) {
      return;
    }
    alertBox.classList.add("d-none");
  };

  const setFieldValue = (id, value) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    if (element.tagName === "TEXTAREA") {
      element.value = value ? String(value) : "";
      return;
    }
    if (element.tagName === "SELECT") {
      element.value = value ? String(value) : "";
      return;
    }
    element.value = value ? String(value) : "";
  };

  const collectPayload = () => {
    const valueOf = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };

    return {
      fullName: valueOf("nama"),
      email: valueOf("email"),
      birthPlace: valueOf("birthPlace"),
      birthDate: valueOf("birthDate"),
      gender: valueOf("gender"),
      religion: valueOf("religion"),
      education: valueOf("education"),
      occupation: valueOf("occupation"),
      institution: valueOf("institution"),
      address: valueOf("address"),
      phone: valueOf("phone"),
    };
  };

  const fillForm = (payload) => {
    const user = payload?.user || {};
    const profile = payload?.profile || {};

    setFieldValue("nama", profile.fullName || user.fullName || "");
    setFieldValue("nik", user.nik || profile.nik || "");
    setFieldValue("birthPlace", profile.birthPlace || "");
    setFieldValue("birthDate", profile.birthDate || "");
    setFieldValue("gender", profile.gender || "");
    setFieldValue("religion", profile.religion || "");
    setFieldValue("education", profile.education || "");
    setFieldValue("occupation", profile.occupation || "");
    setFieldValue("institution", profile.institution || "");
    setFieldValue("address", profile.address || "");
    setFieldValue("email", profile.email || user.email || "");
    setFieldValue("phone", profile.phone || "");

    if (user.nik) {
      localStorage.setItem("nik", user.nik);
    }

    if (typeof window.updateNavbarUser === "function") {
      window.updateNavbarUser({
        fullName: user.fullName || profile.fullName || "Pengguna",
        avatarUrl: profile.photoPath || null,
      });
    }
  };

  const validateNikField = () => {
    const nikInput = document.getElementById("nik");
    const nikHelp = document.getElementById("nikHelp");
    if (!nikInput || !nikHelp) {
      return;
    }
    const nikValue = nikInput.value.trim();
    if (nikValue.length !== 16) {
      nikHelp.classList.remove("d-none");
      nikInput.classList.add("is-invalid");
      return false;
    }
    nikHelp.classList.add("d-none");
    nikInput.classList.remove("is-invalid");
    return true;
  };

  const setupPhotoPreview = () => {
    const photoFile = document.getElementById("photoFile");
    const fotoPreview = document.getElementById("fotoPreview");

    if (!photoFile || !fotoPreview) {
      return;
    }

    photoFile.addEventListener("change", () => {
      const file = photoFile.files?.[0];
      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        alert("File harus berupa gambar.");
        photoFile.value = "";
        return;
      }

      if (file.size > 1024 * 1024) {
        alert("Ukuran file terlalu besar. Maksimal 1MB.");
        photoFile.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        fotoPreview.src = event.target?.result || fotoPreview.src;
      };
      reader.readAsDataURL(file);
    });
  };

  const loadProfile = async () => {
    try {
      const response = await fetch("/api/profile", {
        credentials: "include",
      });

      if (response.status === 401) {
        window.location.href = "/html/login.html";
        return;
      }

      if (!response.ok) {
        throw new Error(`Gagal mengambil data profil: ${response.statusText}`);
      }

      const payload = await response.json();
      fillForm(payload);
      hideAlert();
    } catch (error) {
      console.error(error);
      showAlert("danger", "Gagal memuat data. Coba muat ulang halaman.");
    }
  };

  const handleSubmit = () => {
    const form = document.getElementById("formWarga");
    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideAlert();

      if (!validateNikField()) {
        showAlert("danger", "NIK tidak valid. Hubungi admin untuk koreksi.");
        return;
      }

      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        showAlert("warning", "Periksa kembali data yang wajib diisi.");
        return;
      }

      const payload = collectPayload();
      const submitButton = form.querySelector(".btn-submit");
      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          window.location.href = "/html/login.html";
          return;
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message = data.error || "Gagal menyimpan data.";
          showAlert("danger", message);
          return;
        }

        const updated = await response.json();
        fillForm(updated);
        showAlert("success", "Data berhasil disimpan. Dashboard akan menampilkan data terbaru.");
        setTimeout(() => {
          window.location.href = "/html/dashboard.html";
        }, 1200);
      } catch (error) {
        console.error("Gagal menyimpan data:", error);
        showAlert("danger", "Terjadi kendala saat menyimpan. Coba lagi.");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const redirected = enforceReloadLogin();
    if (redirected) {
      return;
    }
    registerNavbarEvents();
    setupPhotoPreview();
    handleSubmit();
    loadProfile();
  });
})();
