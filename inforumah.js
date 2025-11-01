    // Sidebar
    function openSidebar() {
      document.getElementById("sidebar").style.width = "250px";
      document.getElementById("mainContent").style.marginLeft = "250px";
    }

    function closeSidebar() {
      document.getElementById("sidebar").style.width = "0";
      document.getElementById("mainContent").style.marginLeft = "0";
    }

    document.querySelector(".dropdown-btn").addEventListener("click", function() {
      const dropdown = this.nextElementSibling;
      dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    });

    // Dropdown akun
    function toggleDropdown() {
      const menu = document.getElementById("accountDropdown");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    }

    window.onclick = function(e) {
      if (!e.target.closest("#accountButton")) {
        document.getElementById("accountDropdown").style.display = "none";
      }
    };

    // Mode toggle (di dalam dropdown)
    const modeToggle = document.getElementById("modeToggle");
    modeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      if (document.body.classList.contains("dark-mode")) {
        modeToggle.textContent = "☀️ Light Mode";
      } else {
        modeToggle.textContent = "🌙 Night Mode";
      }
    });