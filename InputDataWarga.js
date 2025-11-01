document.addEventListener("DOMContentLoaded", () => {
  const addForm = document.getElementById("addForm");
  const nikInput = document.getElementById("nik");
  const namaInput = document.getElementById("nama");
  const tableBody = document.querySelector("#dataTable tbody");
  const alertBox = document.getElementById("alertBox");
  const logoutBtn = document.getElementById("logoutBtn");

  let dataWarga = JSON.parse(localStorage.getItem("dataWarga")) || [];

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = type;
    setTimeout(() => (alertBox.textContent = ""), 2000);
  }

  function renderTable() {
    tableBody.innerHTML = "";
    if (dataWarga.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4">Belum ada data</td></tr>`;
      return;
    }

    dataWarga.forEach((w, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${w.nik}</td>
        <td>${w.nama}</td>
        <td><button class="delete" data-index="${index}">Hapus</button></td>
      `;
      tableBody.appendChild(row);
    });
  }

  // Tambah Data
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nik = nikInput.value.trim();
    const nama = namaInput.value.trim();

    if (!/^\d{16}$/.test(nik)) {
      showAlert("❌ NIK harus 16 digit angka!", "error");
      return;
    }

    if (nama === "") {
      showAlert("❌ Nama tidak boleh kosong!", "error");
      return;
    }

    if (dataWarga.some((w) => w.nik === nik)) {
      showAlert("⚠️ NIK sudah terdaftar!", "error");
      return;
    }

    dataWarga.push({ nik, nama, password: "Password@123" });
    localStorage.setItem("dataWarga", JSON.stringify(dataWarga));
    renderTable();
    addForm.reset();
    showAlert("✅ Data berhasil disimpan!", "success");
  });

  // Hapus Data
  tableBody.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete")) {
      const index = e.target.getAttribute("data-index");
      dataWarga.splice(index, 1);
      localStorage.setItem("dataWarga", JSON.stringify(dataWarga));
      renderTable();
      showAlert("🗑️ Data berhasil dihapus!", "success");
    }
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
  });

  renderTable();
});
