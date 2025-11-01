"use strict";

(() => {
  const COMPLETION_THRESHOLD_SAFE = 100;
  const COMPLETION_THRESHOLD_WARNING = 70;

  const PROFILE_PLACEHOLDERS = {
    birthPlace: "-",
    birthDate: "-",
    gender: "-",
    religion: "-",
    education: "-",
    occupation: "-",
    institution: "-",
    address: "-",
    email: null,
    phone: "-",
  };

  const setTextContent = (elementId, value, fallback = "-") => {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value && String(value).trim() ? value : fallback;
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) {
      return null;
    }
    try {
      const date = new Date(isoString);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch (_error) {
      return null;
    }
  };

  const computeStatusLabel = (percentage) => {
    if (percentage >= COMPLETION_THRESHOLD_SAFE) {
      return { security: "Aman", verification: "Terverifikasi" };
    }
    if (percentage >= COMPLETION_THRESHOLD_WARNING) {
      return { security: "Perlu Review", verification: "Perlu Lengkapi" };
    }
    return { security: "Perlu Update", verification: "Belum Lengkap" };
  };

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
      // best effort only
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

    window.addEventListener("navbar:sidebar-select", (event) => {
      const key = event?.detail?.key;
      if (!key) {
        return;
      }
      if (key === "dashboard") {
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

  const renderProfile = (payload) => {
    const user = payload?.user || {};
    const profile = { ...PROFILE_PLACEHOLDERS, ...(payload?.profile || {}) };

    const birthDateFormatted = formatDate(profile.birthDate);
    const birthText = profile.birthPlace && birthDateFormatted
      ? `${profile.birthPlace}, ${birthDateFormatted}`
      : profile.birthPlace || birthDateFormatted || "-";

    setTextContent("welcomeName", user.fullName, "Pengguna");
    setTextContent("profileName", user.fullName);
    setTextContent("profileNik", user.nik);
    setTextContent("profileEmail", profile.email || user.email);
    setTextContent("profileBirth", birthText);
    setTextContent("profileGender", profile.gender);
    setTextContent("profileAddress", profile.address);
    setTextContent("profilePhone", profile.phone);
    setTextContent("profileReligion", profile.religion);
    setTextContent("profileEducation", profile.education);
    setTextContent("profileOccupation", profile.occupation);
    setTextContent("profileInstitution", profile.institution);

    if (typeof window.updateNavbarUser === "function") {
      window.updateNavbarUser({
        fullName: user.fullName,
        avatarUrl: profile.photoPath || null,
      });
    }

    const completion = payload?.completion || { percentage: 0 };
    const percentage = Math.max(0, Math.min(100, Math.round(completion.percentage || 0)));
    const statusLabel = computeStatusLabel(percentage);

    setTextContent("securityStatus", statusLabel.security);
    setTextContent("profileStatus", statusLabel.verification);
    setTextContent("verificationLevel", `${percentage}%`);
    setTextContent("lastLoginAt", formatDate(payload?.user?.lastLoginAt) || "-");
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
        throw new Error(`Gagal mengambil profil: ${response.statusText}`);
      }

      const payload = await response.json();
      renderProfile(payload);
    } catch (error) {
      console.error("Gagal memuat data profil:", error);
      setTextContent("securityStatus", "Tidak tersedia");
      setTextContent("verificationLevel", "-");
      setTextContent("lastLoginAt", "-");
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const redirected = enforceReloadLogin();
    if (redirected) {
      return;
    }
    registerNavbarEvents();
    loadProfile();
  });
})();
