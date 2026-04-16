/**
 * Admin Module - Handles admin panel logic
 * @module Admin
 */
const Admin = (() => {
  'use strict';

  let currentUser = null;
  let deleteCallback = null;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    currentUser = getSession();
    if (!currentUser) {
      window.location.href = 'index.html';
      return;
    }

    // Check if user is admin
    if (!isAdmin(currentUser)) {
      showNotification('error', 'Akses Ditolak', 'Anda tidak memiliki akses admin');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
      return;
    }

    document.getElementById('topbarUserName').textContent = currentUser.nama;

    bindNavigation();
    bindModals();
    loadDashboard();
  }

  function isAdmin(user) {
    if (!user || !user.jabatan) return false;
    var jab = user.jabatan.toLowerCase().trim();
    return jab === 'admin' || jab === 'administrator' || jab === 'superadmin';
  }

  function getSession() {
    var data = sessionStorage.getItem('absensi_user');
    if (data) { try { return JSON.parse(data); } catch (e) { return null; } }
    return null;
  }

  // ============================================================
  // NOTIFICATIONS (reuse from App module if loaded, else standalone)
  // ============================================================

  function showNotification(type, title, message) {
    var container = document.getElementById('notificationContainer');
    if (!container) return;

    var icons = {
      success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      error: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      info: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    };

    var notif = document.createElement('div');
    notif.className = 'notification ' + type;
    notif.innerHTML = '<div class="notification-icon">' + (icons[type] || icons.info) + '</div>' +
      '<div class="notification-content"><div class="notification-title">' + title + '</div>' +
      '<div class="notification-message">' + message + '</div></div>' +
      '<button class="notification-close" aria-label="Tutup"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' +
      '<div class="notification-progress"></div>';

    notif.querySelector('.notification-close').addEventListener('click', function () {
      notif.classList.add('hide');
      setTimeout(function () { notif.remove(); }, 300);
    });

    container.appendChild(notif);
    setTimeout(function () { if (notif.parentNode) { notif.classList.add('hide'); setTimeout(function () { notif.remove(); }, 300); } }, 4000);
  }

  function showLoading(text, sub) {
    var o = document.getElementById('loadingOverlay');
    var t = document.getElementById('loadingText');
    var s = document.getElementById('loadingSubText');
    if (t) t.textContent = text || 'Memproses...';
    if (s) s.textContent = sub || 'Mohon tunggu sebentar';
    if (o) o.classList.add('active');
  }

  function hideLoading() {
    var o = document.getElementById('loadingOverlay');
    if (o) o.classList.remove('active');
  }

  // ============================================================
  // SIDEBAR NAVIGATION
  // ============================================================

  function bindNavigation() {
    var links = document.querySelectorAll('.sidebar-link[data-page]');
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        var page = this.getAttribute('data-page');
        switchPage(page);
      });
    });

    // Sidebar toggle (mobile)
    var toggle = document.getElementById('sidebarToggle');
    var overlay = document.getElementById('sidebarOverlay');
    var sidebar = document.getElementById('adminSidebar');

    if (toggle) toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });

    if (overlay) overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });

    // Logout
    var logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      sessionStorage.removeItem('absensi_user');
      window.location.href = 'index.html';
    });
  }

  function switchPage(page) {
    // Update active nav
    document.querySelectorAll('.sidebar-link[data-page]').forEach(function (l) {
      l.classList.remove('active');
    });
    var activeLink = document.querySelector('.sidebar-link[data-page="' + page + '"]');
    if (activeLink) activeLink.classList.add('active');

    // Update content
    document.querySelectorAll('.admin-content').forEach(function (c) {
      c.classList.remove('active');
    });

    var targetPage = document.getElementById('page' + capitalize(page));
    if (targetPage) targetPage.classList.add('active');

    // Close mobile sidebar
    document.getElementById('adminSidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    // Load data
    if (page === 'dashboard') loadDashboard();
    else if (page === 'karyawan') loadKaryawan();
    else if (page === 'absensi') { /* wait for filter */ }
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ============================================================
  // MODALS
  // ============================================================

  function bindModals() {
    // Karyawan Modal
    var addBtn = document.getElementById('addKaryawanBtn');
    if (addBtn) addBtn.addEventListener('click', function () { openKaryawanModal('add'); });

    var closeK = document.getElementById('karyawanModalClose');
    var cancelK = document.getElementById('karyawanCancelBtn');
    if (closeK) closeK.addEventListener('click', closeKaryawanModal);
    if (cancelK) cancelK.addEventListener('click', closeKaryawanModal);

    var saveK = document.getElementById('karyawanSaveBtn');
    if (saveK) saveK.addEventListener('click', saveKaryawan);

    // Delete Modal
    var closeD = document.getElementById('deleteModalClose');
    var cancelD = document.getElementById('deleteCancelBtn');
    var confirmD = document.getElementById('deleteConfirmBtn');
    if (closeD) closeD.addEventListener('click', closeDeleteModal);
    if (cancelD) cancelD.addEventListener('click', closeDeleteModal);
    if (confirmD) confirmD.addEventListener('click', function () {
      if (deleteCallback) deleteCallback();
      closeDeleteModal();
    });

    // Photo Viewer
    var closeP = document.getElementById('photoViewerClose');
    if (closeP) closeP.addEventListener('click', function () {
      document.getElementById('photoViewerModal').classList.remove('active');
    });

    // Refresh buttons
    var refDash = document.getElementById('refreshDashboardBtn');
    if (refDash) refDash.addEventListener('click', loadDashboard);

    var refKar = document.getElementById('refreshKaryawanBtn');
    if (refKar) refKar.addEventListener('click', loadKaryawan);

    // Absensi filter
    var filterBtn = document.getElementById('filterAbsenBtn');
    if (filterBtn) filterBtn.addEventListener('click', loadAbsensi);

    var resetBtn = document.getElementById('resetFilterBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      document.getElementById('filterTanggalDari').value = '';
      document.getElementById('filterTanggalSampai').value = '';
      document.getElementById('filterNik').value = '';
      document.getElementById('absensiBody').innerHTML = '<tr><td colspan="8" class="table-empty">Gunakan filter untuk menampilkan data</td></tr>';
      document.getElementById('recordCount').textContent = '0 data';
    });

    // Set default date filter to today
    var today = new Date().toISOString().split('T')[0];
    document.getElementById('filterTanggalDari').value = today;
    document.getElementById('filterTanggalSampai').value = today;
  }

  // ============================================================
  // KARYAWAN MODAL
  // ============================================================

  function openKaryawanModal(mode, data) {
    var modal = document.getElementById('karyawanModal');
    var title = document.getElementById('karyawanModalTitle');
    var editMode = document.getElementById('karyawanEditMode');
    var nikInput = document.getElementById('karyawanNik');
    var namaInput = document.getElementById('karyawanNama');
    var passInput = document.getElementById('karyawanPassword');
    var jabInput = document.getElementById('karyawanJabatan');
    var statusInput = document.getElementById('karyawanStatus');
    var passHint = document.getElementById('passwordHint');

    if (mode === 'edit' && data) {
      title.textContent = 'Edit Karyawan';
      editMode.value = 'edit';
      nikInput.value = data.nik;
      nikInput.readOnly = true;
      nikInput.style.opacity = '0.6';
      namaInput.value = data.nama;
      passInput.value = '';
      passInput.placeholder = 'Kosongkan jika tidak diubah';
      passHint.textContent = 'Kosongkan jika tidak ingin mengubah password';
      jabInput.value = data.jabatan;
      statusInput.value = data.status ? data.status.toLowerCase() : 'aktif';
    } else {
      title.textContent = 'Tambah Karyawan';
      editMode.value = 'add';
      nikInput.value = '';
      nikInput.readOnly = false;
      nikInput.style.opacity = '1';
      namaInput.value = '';
      passInput.value = '';
      passInput.placeholder = 'Masukkan password';
      passHint.textContent = 'Password akan di-hash otomatis oleh sistem';
      jabInput.value = '';
      statusInput.value = 'aktif';
    }

    modal.classList.add('active');
  }

  function closeKaryawanModal() {
    document.getElementById('karyawanModal').classList.remove('active');
  }

  function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteCallback = null;
  }

  function openDeleteModal(message, callback) {
    document.getElementById('deleteMessage').textContent = message;
    deleteCallback = callback;
    document.getElementById('deleteModal').classList.add('active');
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  async function loadDashboard() {
    showLoading('Memuat dashboard...', 'Mengambil data ringkasan');

    try {
      var result = await Api.adminAction('admin_dashboard', {});
      hideLoading();

      if (result.status === 'success') {
        var d = result.data;

        document.getElementById('statTotalKaryawan').textContent = d.total_karyawan || 0;
        document.getElementById('statHadirMasuk').textContent = d.hadir_masuk || 0;
        document.getElementById('statHadirKeluar').textContent = d.hadir_keluar || 0;
        document.getElementById('statBelumAbsen').textContent = d.belum_absen || 0;

        renderTodayAbsen(d.today_data || []);
      } else {
        showNotification('error', 'Error', result.message);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  function renderTodayAbsen(data) {
    var tbody = document.getElementById('todayAbsenBody');
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Belum ada data absensi hari ini</td></tr>';
      return;
    }

    // Group by NIK
    var grouped = {};
    data.forEach(function (row) {
      if (!grouped[row.nik]) {
        grouped[row.nik] = { nik: row.nik, nama: row.nama, masuk: '-', keluar: '-' };
      }
      if (row.jenis === 'masuk') grouped[row.nik].masuk = row.jam;
      if (row.jenis === 'keluar') grouped[row.nik].keluar = row.jam;
    });

    var html = '';
    Object.values(grouped).forEach(function (row) {
      var statusClass = 'badge-warning';
      var statusText = 'Belum Lengkap';
      if (row.masuk !== '-' && row.keluar !== '-') {
        statusClass = 'badge-success';
        statusText = 'Lengkap';
      } else if (row.masuk !== '-') {
        statusClass = 'badge-info';
        statusText = 'Sudah Masuk';
      }
      html += '<tr>' +
        '<td>' + row.nik + '</td>' +
        '<td><strong>' + row.nama + '</strong></td>' +
        '<td>' + row.masuk + '</td>' +
        '<td>' + row.keluar + '</td>' +
        '<td><span class="table-badge ' + statusClass + '">' + statusText + '</span></td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
  }

  // ============================================================
  // KARYAWAN CRUD
  // ============================================================

  async function loadKaryawan() {
    showLoading('Memuat data karyawan...', 'Mengambil daftar karyawan');

    try {
      var result = await Api.adminAction('admin_get_karyawan', {});
      hideLoading();

      if (result.status === 'success') {
        renderKaryawan(result.data.karyawan || []);
      } else {
        showNotification('error', 'Error', result.message);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  function renderKaryawan(list) {
    var tbody = document.getElementById('karyawanBody');

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Belum ada data karyawan</td></tr>';
      return;
    }

    var html = '';
    list.forEach(function (k) {
      var statusClass = (k.status && k.status.toLowerCase() === 'aktif') ? 'badge-success' : 'badge-danger';
      html += '<tr>' +
        '<td><strong>' + k.nik + '</strong></td>' +
        '<td>' + k.nama + '</td>' +
        '<td>' + k.jabatan + '</td>' +
        '<td><span class="table-badge ' + statusClass + '">' + (k.status || '-') + '</span></td>' +
        '<td class="table-actions">' +
        '<button class="btn-table btn-table-edit" data-nik="' + k.nik + '" title="Edit">' +
        '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' +
        '</button>' +
        '<button class="btn-table btn-table-delete" data-nik="' + k.nik + '" title="Hapus">' +
        '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>' +
        '</button>' +
        '</td></tr>';
    });

    tbody.innerHTML = html;

    // Bind edit buttons
    tbody.querySelectorAll('.btn-table-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nik = this.getAttribute('data-nik');
        var kary = list.find(function (k) { return k.nik === nik; });
        if (kary) openKaryawanModal('edit', kary);
      });
    });

    // Bind delete buttons
    tbody.querySelectorAll('.btn-table-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nik = this.getAttribute('data-nik');
        var kary = list.find(function (k) { return k.nik === nik; });
        var nama = kary ? kary.nama : nik;
        openDeleteModal('Yakin ingin menghapus karyawan "' + nama + '" (NIK: ' + nik + ')?', function () {
          deleteKaryawan(nik);
        });
      });
    });
  }

  async function saveKaryawan() {
    var mode = document.getElementById('karyawanEditMode').value;
    var nik = document.getElementById('karyawanNik').value.trim();
    var nama = document.getElementById('karyawanNama').value.trim();
    var password = document.getElementById('karyawanPassword').value;
    var jabatan = document.getElementById('karyawanJabatan').value.trim();
    var status = document.getElementById('karyawanStatus').value;

    if (!nik || !nama || !jabatan) {
      showNotification('warning', 'Peringatan', 'NIK, Nama, dan Jabatan wajib diisi');
      return;
    }

    if (mode === 'add' && !password) {
      showNotification('warning', 'Peringatan', 'Password wajib diisi untuk karyawan baru');
      return;
    }

    showLoading('Menyimpan karyawan...', '');
    closeKaryawanModal();

    try {
      var action = mode === 'add' ? 'admin_add_karyawan' : 'admin_edit_karyawan';
      var payload = { nik: nik, nama: nama, jabatan: jabatan, status: status };
      if (password) payload.password = password;

      var result = await Api.adminAction(action, payload);
      hideLoading();

      if (result.status === 'success') {
        showNotification('success', 'Berhasil', result.message);
        loadKaryawan();
      } else {
        showNotification('error', 'Gagal', result.message);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  async function deleteKaryawan(nik) {
    showLoading('Menghapus karyawan...', '');

    try {
      var result = await Api.adminAction('admin_delete_karyawan', { nik: nik });
      hideLoading();

      if (result.status === 'success') {
        showNotification('success', 'Berhasil', result.message);
        loadKaryawan();
      } else {
        showNotification('error', 'Gagal', result.message);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  // ============================================================
  // REKAP ABSENSI
  // ============================================================

  async function loadAbsensi() {
    var dari = document.getElementById('filterTanggalDari').value;
    var sampai = document.getElementById('filterTanggalSampai').value;
    var search = document.getElementById('filterNik').value.trim();

    if (!dari || !sampai) {
      showNotification('warning', 'Peringatan', 'Pilih rentang tanggal');
      return;
    }

    showLoading('Memuat data absensi...', 'Mengambil rekap absensi');

    try {
      var result = await Api.adminAction('admin_get_absensi', {
        dari: dari,
        sampai: sampai,
        search: search,
      });
      hideLoading();

      if (result.status === 'success') {
        renderAbsensi(result.data.absensi || []);
      } else {
        showNotification('error', 'Error', result.message);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  function renderAbsensi(list) {
    var tbody = document.getElementById('absensiBody');
    var countEl = document.getElementById('recordCount');

    countEl.textContent = list.length + ' data';

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Tidak ada data absensi ditemukan</td></tr>';
      return;
    }

    var html = '';
    list.forEach(function (a) {
      var jenisClass = a.jenis === 'masuk' ? 'badge-success' : 'badge-info';
      var fotoBtn = a.foto_url
        ? '<button class="btn-table btn-table-view" data-url="' + a.foto_url + '" data-info="' + a.nama + ' - ' + a.tanggal + ' ' + a.jam + '" title="Lihat Foto"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></button>'
        : '<span style="color:var(--text-light);font-size:0.8rem">-</span>';

      html += '<tr>' +
        '<td>' + a.tanggal + '</td>' +
        '<td><strong>' + a.nik + '</strong></td>' +
        '<td>' + a.nama + '</td>' +
        '<td>' + a.jam + '</td>' +
        '<td><span class="table-badge ' + jenisClass + '">' + a.jenis + '</span></td>' +
        '<td style="font-size:0.75rem;color:var(--text-muted)">' + (a.latitude ? a.latitude.toFixed(5) + ', ' + a.longitude.toFixed(5) : '-') + '</td>' +
        '<td style="font-size:0.75rem;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis" title="' + (a.alamat || '-') + '">' + (a.alamat || '-') + '</td>' +
        '<td>' + fotoBtn + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;

    // Bind photo view buttons
    tbody.querySelectorAll('.btn-table-view').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = this.getAttribute('data-url');
        var info = this.getAttribute('data-info');
        
        // Use thumbnail URL for more reliable display if it's a drive bit
        var displayUrl = url;
        if (url.includes('drive.google.com')) {
          var fileId = url.split('id=')[1];
          displayUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
        }

        document.getElementById('photoViewerImg').src = displayUrl;
        document.getElementById('photoViewerInfo').textContent = info;
        document.getElementById('photoViewerModal').classList.add('active');
      });
    });
  }

  // ============================================================
  // Public API
  // ============================================================
  return { init: init };
})();
