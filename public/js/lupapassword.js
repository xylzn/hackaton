// ====== LOGIN PAGE ======
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const nikInput = document.getElementById("nik");
  const nikError = document.getElementById("nikError");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nik = nikInput.value.trim();

    if (nik.length !== 16) {
      nikError.style.display = "block";
      return;
    }

    nikError.style.display = "none";
    localStorage.setItem("nim", nik);
    alert("Login berhasil (simulasi).");
  });
}

// ====== RESET PASSWORD PAGE ======
const resetForm = document.getElementById("resetForm");
if (resetForm) {
  const nimField = document.getElementById("nim");
  const newPass = document.getElementById("newPassword");
  const confirmPass = document.getElementById("confirmPassword");
  const saveBtn = document.getElementById("saveBtn");

  // Ambil NIM dari localStorage
  nimField.value = localStorage.getItem("nim") || "";

  const checks = {
    length: (v) => v.length >= 8,
    upper: (v) => /[A-Z]/.test(v),
    lower: (v) => /[a-z]/.test(v),
    number: (v) => /[0-9]/.test(v),
    special: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v),
  };

  function validate() {
    const val = newPass.value;
    let allValid = true;

    for (let key in checks) {
      const el = document.getElementById(key);
      if (checks[key](val)) {
        el.classList.add("valid");
      } else {
        el.classList.remove("valid");
        allValid = false;
      }
    }

    const match = document.getElementById("match");
    if (val && confirmPass.value && val === confirmPass.value) {
      match.classList.add("valid");
    } else {
      match.classList.remove("valid");
      allValid = false;
    }

    saveBtn.disabled = !allValid;
  }

  newPass.addEventListener("input", validate);
  confirmPass.addEventListener("input", validate);

  resetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    alert("Password berhasil diperbarui!");
    localStorage.setItem("password", newPass.value);
    window.location.href = "login.html";
  });
}
