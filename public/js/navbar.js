"use strict";

(() => {
  const NAVBAR_TEMPLATE = `
    <header class="app-navbar" role="banner">
      <div class="app-navbar__left">
        <button
          class="app-navbar__hamburger"
          id="appNavbarHamburger"
          type="button"
          aria-label="Buka menu navigasi"
          aria-expanded="false"
        >
          <span class="app-navbar__hamburger-lines">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        <span class="app-navbar__title">Portal Data Warga</span>
      </div>
      <div class="app-navbar__right">
        <button id="toggleTheme" class="btn btn-light btn-sm" type="button">Mode Gelap</button>
        <div class="app-navbar__profile">
          <button
            id="navbarProfileToggle"
            class="app-navbar__profile-btn"
            type="button"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <img
              src="https://i.pravatar.cc/150?img=12"
              alt="Foto profil"
              class="app-navbar__avatar"
              id="navbarProfileAvatar"
            >
            <span class="app-navbar__profile-name" id="navbarProfileName">Pengguna</span>
          </button>
          <div class="app-navbar__dropdown" id="navbarProfileDropdown" role="menu">
            <button type="button" data-navbar-action="change-password">Ubah Password</button>
            <button type="button" data-navbar-action="logout">Keluar</button>
          </div>
        </div>
      </div>
    </header>
    <nav class="app-sidebar" id="appSidebar" aria-label="Navigasi utama" aria-hidden="true">
      <div class="app-sidebar__header">
        <div class="app-sidebar__title">Navigasi</div>
      </div>
      <ul class="app-sidebar__menu">
        <li><a href="/html/dashboard.html" data-sidebar-link="dashboard">Beranda</a></li>
        <li><a href="/html/input.html" data-sidebar-link="update">Pemutakhiran Data</a></li>
        <li><a href="#" data-sidebar-link="laporan">Laporan</a></li>
      </ul>
    </nav>
    <div class="app-sidebar__scrim" id="appSidebarScrim" hidden></div>
  `;

  const state = {
    rendered: false,
    dropdownOpen: false,
    sidebarOpen: false,
  };

  const THEME_STORAGE_KEY = "dashboard-theme";

  function renderNavbar() {
    if (state.rendered) {
      return;
    }

    document.body.insertAdjacentHTML("afterbegin", NAVBAR_TEMPLATE);
    attachEventHandlers();
    setupThemeControl();
    state.rendered = true;
  }

  function attachEventHandlers() {
    const hamburger = document.getElementById("appNavbarHamburger");
    const profileToggle = document.getElementById("navbarProfileToggle");
    const dropdown = document.getElementById("navbarProfileDropdown");
    const scrim = document.getElementById("appSidebarScrim");
    const sidebar = document.getElementById("appSidebar");

    if (!hamburger || !profileToggle || !dropdown || !scrim || !sidebar) {
      return;
    }

    hamburger.addEventListener("click", () => {
      toggleSidebar(!state.sidebarOpen);
    });

    profileToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown(!state.dropdownOpen);
    });

    document.addEventListener("click", (event) => {
      if (!state.dropdownOpen) {
        return;
      }
      const clickedInsideDropdown = dropdown.contains(event.target);
      const clickedToggle = profileToggle.contains(event.target);
      if (!clickedInsideDropdown && !clickedToggle) {
        toggleDropdown(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (state.dropdownOpen) {
          toggleDropdown(false);
        }
        if (state.sidebarOpen) {
          toggleSidebar(false);
        }
      }
    });

    scrim.addEventListener("click", () => toggleSidebar(false));

    dropdown.addEventListener("click", (event) => {
      const action = event.target?.getAttribute("data-navbar-action");
      if (!action) {
        return;
      }
      event.preventDefault();
      toggleDropdown(false);
      window.dispatchEvent(new CustomEvent(`navbar:${action}`));
    });

    sidebar.addEventListener("click", (event) => {
      const link = event.target?.closest("[data-sidebar-link]");
      if (!link) {
        return;
      }
      window.dispatchEvent(
        new CustomEvent("navbar:sidebar-select", {
          detail: { key: link.getAttribute("data-sidebar-link") },
        })
      );
      toggleSidebar(false);
    });
  }

  function toggleDropdown(forceState) {
    const dropdown = document.getElementById("navbarProfileDropdown");
    const profileToggle = document.getElementById("navbarProfileToggle");
    if (!dropdown || !profileToggle) {
      return;
    }

    const nextState =
      typeof forceState === "boolean" ? forceState : !state.dropdownOpen;

    dropdown.classList.toggle("is-open", nextState);
    profileToggle.setAttribute("aria-expanded", String(nextState));
    state.dropdownOpen = nextState;
  }

  function toggleSidebar(forceState) {
    const hamburger = document.getElementById("appNavbarHamburger");
    const sidebar = document.getElementById("appSidebar");
    const scrim = document.getElementById("appSidebarScrim");

    if (!hamburger || !sidebar || !scrim) {
      return;
    }

    const nextState =
      typeof forceState === "boolean" ? forceState : !state.sidebarOpen;

    document.body.classList.toggle("sidebar-open", nextState);
    hamburger.setAttribute("aria-expanded", String(nextState));
    sidebar.setAttribute("aria-hidden", String(!nextState));
    if (nextState) {
      scrim.removeAttribute("hidden");
    } else {
      scrim.setAttribute("hidden", "hidden");
    }

    state.sidebarOpen = nextState;
  }

  function setupThemeControl() {
    const button = document.getElementById("toggleTheme");
    if (!button) {
      return;
    }

    const applyTheme = (mode) => {
      const nextMode = mode === "dark" ? "dark" : "light";
      const isDark = nextMode === "dark";
      document.body.classList.toggle("dark", isDark);
      button.textContent = isDark ? "Mode Terang" : "Mode Gelap";
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      window.dispatchEvent(
        new CustomEvent("navbar:theme-change", { detail: { mode: nextMode } })
      );
    };

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
    applyTheme(savedTheme);

    button.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark")
        ? "light"
        : "dark";
      applyTheme(nextTheme);
    });
  }

  function updateNavbarUser({ fullName, avatarUrl } = {}) {
    const nameEl = document.getElementById("navbarProfileName");
    const avatarEl = document.getElementById("navbarProfileAvatar");

    if (nameEl) {
      nameEl.textContent = fullName && fullName.trim() ? fullName : "Pengguna";
    }

    if (avatarEl && avatarUrl && avatarUrl.trim()) {
      avatarEl.src = avatarUrl;
    }
  }

  window.renderNavbar = renderNavbar;
  window.updateNavbarUser = updateNavbarUser;

  window.addEventListener("DOMContentLoaded", renderNavbar);
})();
