"use strict";

(() => {
  const state = {
    items: [],
    filtered: [],
  };

  const alertBox = document.getElementById("adminAlert");
  const tableBody = document.getElementById("wargaTable");
  const searchInput = document.getElementById("searchInput");
  const detailModalElement = document.getElementById("detailModal");
  let detailModal = null;

  const setAlert = (variant, message) => {
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

  const formatDate = (isoString) => {
    if (!isoString) {
      return "-";
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const completionBadge = (percentage) => {
    const value = Math.max(0, Math.min(100, Number.isFinite(percentage) ? Math.round(percentage) : 0));
    let variant = "danger";
    let label = "Belum Lengkap";

    if (value >= 100) {
      variant = "safe";
      label = "Lengkap";
    } else if (value >= 70) {
      variant = "warn";
      label = "Perlu Lengkapi";
    }

    return `<span class="completion-badge ${variant}" title="Kelengkapan ${value}%">
      ${value}% · ${label}
    </span>`;
  };

  const renderTable = (items) => {
    if (!tableBody) {
      return;
    }

    if (!items || items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="py-4 text-center text-muted">Belum ada data yang cocok dengan pencarian.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = items
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td class="text-start">${item.fullName || "-"}</td>
            <td>${item.nik || "-"}</td>
            <td class="text-start">${item.email || "-"}</td>
            <td>${completionBadge(item.completion)}</td>
            <td>
              <button class="btn btn-sm btn-primary" data-profile-id="${item.id}">
                Lihat Detail
              </button>
            </td>
          </tr>
        `
      )
      .join("");

    tableBody.querySelectorAll("button[data-profile-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = Number.parseInt(button.getAttribute("data-profile-id"), 10);
        if (Number.isFinite(id)) {
          openDetail(id);
        }
      });
    });
  };

  const applyFilter = (keyword) => {
    if (!keyword) {
      state.filtered = [...state.items];
      renderTable(state.filtered);
      return;
    }

    const term = keyword.trim().toLowerCase();
    state.filtered = state.items.filter((item) => {
      return (
        (item.nik && item.nik.toLowerCase().includes(term)) ||
        (item.fullName && item.fullName.toLowerCase().includes(term))
      );
    });
    renderTable(state.filtered);
  };

  const fetchProfiles = async () => {
    setAlert(null, "");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="py-4 text-center text-muted">Memuat data warga...</td>
        </tr>
      `;
    }

    try {
      const response = await fetch("/api/admin/profiles", {
        credentials: "include",
      });

      if (response.status === 401) {
        window.location.replace("/html/login.html");
        return;
      }

      if (response.status === 403) {
        setAlert("danger", "Akses ditolak. Halaman ini hanya untuk administrator.");
        renderTable([]);
        return;
      }

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const payload = await response.json();
      state.items = Array.isArray(payload?.items) ? payload.items : [];
      state.filtered = [...state.items];
      renderTable(state.filtered);
      setAlert(null, "");
    } catch (error) {
      console.error("Gagal memuat data admin:", error);
      setAlert("danger", "Terjadi kesalahan saat memuat data warga.");
      renderTable([]);
    }
  };

  const openDetail = async (id) => {
    if (!detailModalElement) {
      return;
    }

    const modalContent = document.getElementById("modalContent");
    if (modalContent) {
      modalContent.innerHTML = `<p class="text-center text-muted mb-0">Memuat detail warga...</p>`;
    }

    detailModal = detailModal || new bootstrap.Modal(detailModalElement);

    try {
      const response = await fetch(`/api/admin/profiles/${encodeURIComponent(id)}`, {
        credentials: "include",
      });

      if (response.status === 401) {
        window.location.replace("/html/login.html");
        return;
      }

      if (response.status === 403) {
        setAlert("danger", "Akses ditolak. Halaman ini hanya untuk administrator.");
        return;
      }

      if (response.status === 404) {
        if (modalContent) {
          modalContent.innerHTML = `<p class="text-center text-danger mb-0">Data warga tidak ditemukan.</p>`;
        }
        detailModal.show();
        return;
      }

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const payload = await response.json();
      const user = payload.user || {};
      const profile = payload.profile || {};
      const completion = payload.completion || {};

      if (modalContent) {
        modalContent.innerHTML = `
          <div class="row g-4">
            <div class="col-md-4 text-center">
              <img
                src="${profile.photoPath || "https://i.imgur.com/UQ0Q3mU.png"}"
                alt="Foto Warga"
                class="detail-photo mb-3"
              >
              <p class="mb-1 fw-semibold">${user.fullName || profile.fullName || "-"}</p>
              <p class="text-muted mb-0">${user.role ? user.role.toUpperCase() : "OPERATOR"}</p>
            </div>
            <div class="col-md-8">
              <table class="table table-sm detail-table">
                <tbody>
                  <tr><td>NIK</td><td>${user.nik || profile.nik || "-"}</td></tr>
                  <tr><td>Email</td><td>${user.email || profile.email || "-"}</td></tr>
                  <tr><td>Nomor Telepon</td><td>${profile.phone || "-"}</td></tr>
                  <tr><td>Alamat</td><td>${profile.address || "-"}</td></tr>
                  <tr><td>Tempat, Tanggal Lahir</td><td>${profile.birthPlace || "-"}, ${profile.birthDate || "-"}</td></tr>
                  <tr><td>Jenis Kelamin</td><td>${profile.gender || "-"}</td></tr>
                  <tr><td>Agama</td><td>${profile.religion || "-"}</td></tr>
                  <tr><td>Pendidikan</td><td>${profile.education || "-"}</td></tr>
                  <tr><td>Pekerjaan</td><td>${profile.occupation || "-"}</td></tr>
                  <tr><td>Instansi</td><td>${profile.institution || "-"}</td></tr>
                  <tr><td>Terakhir Login</td><td>${formatDate(user.lastLoginAt)}</td></tr>
                  <tr><td>Pembaruan Profil</td><td>${formatDate(profile.updatedAt)}</td></tr>
                </tbody>
              </table>
              <div class="detail-grid mt-3">
                <div class="card p-3">
                  <h6>Kelengkapan Data</h6>
                  <div>${completionBadge(completion.percentage)}</div>
                </div>
                <div class="card p-3">
                  <h6>Catatan</h6>
                  <p class="mb-0 text-muted">
                    Admin hanya dapat memantau data. Minta warga melakukan pemutakhiran jika ada informasi yang belum lengkap.
                  </p>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      detailModal.show();
    } catch (error) {
      console.error("Gagal memuat detail warga:", error);
      if (modalContent) {
        modalContent.innerHTML = `<p class="text-center text-danger mb-0">Terjadi kesalahan saat memuat detail.</p>`;
      }
      detailModal.show();
    }
  };

  window.refreshTable = () => {
    const query = searchInput ? searchInput.value : "";
    applyFilter(query);
    fetchProfiles();
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        applyFilter(event.target.value);
      });
    }
    fetchProfiles();
  });
})();
