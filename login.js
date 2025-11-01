    const form = document.getElementById('loginForm');
    const nikInput = document.getElementById('nik');
    const passInput = document.getElementById('password');
    const nikError = document.getElementById('nikError');
    const passError = document.getElementById('passError');

    // ======= Simpan & tampilkan NIK dari localStorage =======
    window.addEventListener('DOMContentLoaded', () => {
      const savedNIK = localStorage.getItem('nik');
      if (savedNIK) nikInput.value = savedNIK;
    });

    nikInput.addEventListener('input', () => {
      nikInput.value = nikInput.value.replace(/\D/g, ''); // hanya angka
      localStorage.setItem('nik', nikInput.value);

      if (nikInput.value.length < 16 && nikInput.value.length > 0) {
        nikError.style.display = 'block';
        nikInput.style.borderColor = 'red';
      } else {
        nikError.style.display = 'none';
        nikInput.style.borderColor = '#ccc';
      }
    });

    // ======= Validasi saat submit =======
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let isValid = true;
      const nik = nikInput.value.trim();
      const password = passInput.value.trim();

      // Validasi NIK
      if (nik.length !== 16 || !/^\d+$/.test(nik)) {
        nikError.style.display = 'block';
        nikInput.style.borderColor = 'red';
        isValid = false;
        localStorage.removeItem('nik'); // hapus dari penyimpanan
      } else {
        nikError.style.display = 'none';
      }

      // Validasi Password
      if (password === '') {
        passError.style.display = 'block';
        passInput.style.borderColor = 'red';
        isValid = false;
      } else {
        passError.style.display = 'none';
      }

      // Jika ada kesalahan, reset form kecuali NIK tersimpan
      if (!isValid) {
        passInput.value = ''; // kosongkan password
        passInput.style.borderColor = '#ccc';
        form.reset(); // reset form
        const savedNIK = localStorage.getItem('nik');
        if (savedNIK) nikInput.value = savedNIK; // isi ulang NIK
        return;
      }

      // Jika valid
      alert(`Login berhasil!\nNIK: ${nik}\nPassword: ${password}`);
      passInput.value = ''; // kosongkan password
    });