document.getElementById("addForm").addEventListener("submit", function(e) {
      e.preventDefault();

      const nik = document.getElementById("nik").value.trim();
      const nama = document.getElementById("nama").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      if (nik.length !== 16) {
        showAlert("❌ NIK harus 16 digit!", "danger");
        return;
      }

      const dataWarga = JSON.parse(localStorage.getItem("dataWarga")) || [];

      if (dataWarga.some(w => w.nik === nik)) {
        showAlert("⚠️ NIK sudah terdaftar!", "warning");
        return;
      }

      // Simpan ke localStorage
      dataWarga.push({ nik, nama, email, password });
      localStorage.setItem("dataWarga", JSON.stringify(dataWarga));

      showAlert("✅ Data berhasil disimpan!", "success");

      // Pindah ke dashboard setelah 1 detik
      setTimeout(() => {
        window.location.href = "dashboard_admin.html";
      }, 1000);
    });

    function showAlert(message, type) {
      const alertBox = document.getElementById("alertBox");
      alertBox.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
    }

    // Fungsi pencarian nama/NIK
    function filterData() {
        const searchValue = searchInput.value.toLowerCase();
        const allData = JSON.parse(localStorage.getItem("dataWarga")) || [];
        const filtered = allData.filter(w =>
        w.nama.toLowerCase().includes(searchValue) ||
        w.nik.toLowerCase().includes(searchValue)
        );
        renderData(filtered);
    }

    // Fungsi refresh tabel
    function refreshTable() {
        searchInput.value = "";
        renderData();
    }

    // Logout
    function logout() {
        localStorage.removeItem("isLoggedIn");
        window.location.href = "login.html";
    }

    // Render saat halaman dibuka
    document.addEventListener("DOMContentLoaded", renderData);