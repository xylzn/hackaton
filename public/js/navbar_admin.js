(function () {
  /**
   * renderAdminNavbar(targetSelector = 'body', options = {})
   * - targetSelector: tempat menyisipkan navbar (default: 'body' -> di atas)
   * - options.brand: { title, href }
   * - options.links: [{ text, href }]
   */
  function renderAdminNavbar(targetSelector = 'body', options = {}) {
    const target = document.querySelector(targetSelector);
    if (!target) return;

    const brand = options.brand || { title: 'Portal Data Warga', href: 'dashboard_admin.html' };
    const links = options.links || [
      { text: 'Beranda', href: 'dashboard_admin.html' },
      { text: 'Laporan Masuk', href: 'terima_lapor.html' }
    ];

    const navId = 'admin-navbar-root';
    if (document.getElementById(navId)) return; // already rendered

    const navHtml = `
<nav id="${navId}" class="navbar-admin navbar navbar-expand-lg">
  <div class="container-fluid">
    <a class="navbar-brand d-flex align-items-center gap-2" href="${brand.href}">
      <img src="https://cdn-icons-png.flaticon.com/512/942/942751.png" alt="logo" class="navbar-brand-icon">
      <span class="navbar-brand-title">${brand.title}</span>
    </a>

    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#adminNavbarCollapse" aria-controls="adminNavbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="adminNavbarCollapse">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">
        ${links.map(l => `<li class="nav-item"><a class="nav-link" href="${l.href}">${l.text}</a></li>`).join('')}
      </ul>

      <div class="d-flex align-items-center gap-3 ms-auto">
        <a class="btn btn-outline-secondary btn-sm d-none d-lg-inline" href="dashboard_admin.html">Dashboard</a>
        <div class="dropdown">
          <a class="d-flex align-items-center text-decoration-none dropdown-toggle" href="#" id="adminProfileDropdown" data-bs-toggle="dropdown" aria-expanded="false">
            <img src="https://i.pravatar.cc/40" alt="profile" class="navbar-profile">
          </a>
          <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="adminProfileDropdown">
            <li><a class="dropdown-item" href="#">Profil Saya</a></li>
            <li><a class="dropdown-item" href="#">Keluar</a></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</nav>
`;

    target.insertAdjacentHTML('afterbegin', navHtml);

    // set active link based on current file
    const path = location.pathname.split('/').pop() || 'dashboard_admin.html';
    document.querySelectorAll(`#${navId} .nav-link`).forEach(link => {
      const hrefFile = link.getAttribute('href').split('/').pop();
      if (hrefFile === path) link.classList.add('active');
      link.addEventListener('click', () => {
        document.querySelectorAll(`#${navId} .nav-link`).forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });
  }

  // expose
  window.renderAdminNavbar = renderAdminNavbar;
})();