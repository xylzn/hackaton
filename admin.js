    const tableBody = document.getElementById("dataWargaTable");

  function renderData() {
    const data = JSON.parse(localStorage.getItem("dataWarga")) || [];
    tableBody.innerHTML = "";

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-muted">Belum ada data warga.</td></tr>`;
      return;
    }

    data.forEach((w, i) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${i + 1}</td>
        <td>${w.nik}</td>
        <td>${w.nama}</td>
        <td>${w.email}</td>
        <td>${w.password}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="hapusData(${i})">Hapus</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  function hapusData(index) {
    const data = JSON.parse(localStorage.getItem("dataWarga")) || [];
    if (confirm("Apakah yakin ingin menghapus data ini?")) {
      data.splice(index, 1);
      localStorage.setItem("dataWarga", JSON.stringify(data));
      renderData();
    }
  }

  function logout() {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "login.html";
  }

  document.addEventListener("DOMContentLoaded", renderData);