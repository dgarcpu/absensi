/**
 * Admin Module - Handles admin panel logic
 * @module Admin
 */
const Admin = (() => {
  'use strict';

  let currentUser = null;
  let deleteCallback = null;
  let attendanceChart = null;
  let currentAbsensiData = []; // Store for export

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

    var settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveSettings();
      });
    }

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

  function switchPage(pageId) {
    document.querySelectorAll('.admin-content').forEach(function (page) {
      page.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-link').forEach(function (link) {
      link.classList.remove('active');
    });

    var targetPage = document.getElementById('page' + capitalize(pageId));
    if (targetPage) targetPage.classList.add('active');

    var targetLink = document.querySelector('.sidebar-link[data-page="' + pageId + '"]');
    if (targetLink) targetLink.classList.add('active');

    if (pageId === 'dashboard') loadDashboard();
    if (pageId === 'karyawan') loadKaryawan();
    if (pageId === 'jadwal') loadJadwalList();
    if (pageId === 'settings') loadSettings();

    // Close sidebar on mobile after navigation
    document.getElementById('adminSidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  }

  function capitalize(s) {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * Pembersihan waktu dari string 1899 jika ada
   */
  function cleanTime(s) {
    if (!s || s === '-') return '-';
    var match = String(s).match(/(\d{1,2}:\d{1,2}:\d{1,2})/);
    return match ? match[1] : s;
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

    var refJad = document.getElementById('refreshJadwalBtn');
    if (refJad) refJad.addEventListener('click', loadJadwalList);

    // Schedule Modal
    var closeS = document.getElementById('scheduleModalClose');
    if (closeS) closeS.addEventListener('click', closeScheduleModal);

    // Tabs logic
    var tabs = document.querySelectorAll('.tab-link');
    tabs.forEach(function(tab) {
       tab.addEventListener('click', function() {
          var t = this.getAttribute('data-tab');
          document.querySelectorAll('.tab-link').forEach(function(l) { l.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
          this.classList.add('active');
          document.getElementById(t).classList.add('active');
       });
    });

    // Form Submits
    document.getElementById('weeklyScheduleForm').addEventListener('submit', function(e) {
       e.preventDefault();
       saveWeeklySchedule();
    });

    document.getElementById('specialScheduleForm').addEventListener('submit', function(e) {
       e.preventDefault();
       saveSpecialSchedule();
    });

    // Absensi filter
    var filterBtn = document.getElementById('filterAbsenBtn');
    if (filterBtn) filterBtn.addEventListener('click', loadAbsensi);

    var resetBtn = document.getElementById('resetFilterBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetAbsensiFilter);

    var exExcel = document.getElementById('exportExcelBtn');
    if (exExcel) exExcel.addEventListener('click', exportToExcel);

    var exPdf = document.getElementById('exportPdfBtn');
    if (exPdf) exPdf.addEventListener('click', exportToPdf);

    // ID Card
    var closeId = document.getElementById('idCardModalClose');
    if (closeId) closeId.addEventListener('click', function() {
        document.getElementById('idCardModal').classList.remove('active');
    });

    var printId = document.getElementById('printIdCardBtn');
    if (printId) printId.addEventListener('click', function() {
        window.print();
    });
  }

  function resetAbsensiFilter() {
      document.getElementById('filterTanggalDari').value = '';
      document.getElementById('filterTanggalSampai').value = '';
      document.getElementById('filterNik').value = '';
      document.getElementById('absensiBody').innerHTML = '<tr><td colspan="8" class="table-empty">Gunakan filter untuk menampilkan data</td></tr>';
      document.getElementById('recordCount').textContent = '0 data';

    // Set default date filter to today
    var today = new Date().toISOString().split('T')[0];
    document.getElementById('filterTanggalDari').value = today;
    document.getElementById('filterTanggalSampai').value = today;
    
    // Initialize empty data
    currentAbsensiData = [];
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

    if (mode === 'add') {
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
      document.getElementById('karyawanTglLahir').value = '';
      document.getElementById('karyawanFoto').value = '';
    } else if (mode === 'edit' && data) {
      title.textContent = 'Edit Karyawan';
      editMode.value = 'edit';
      nikInput.value = data.nik;
      nikInput.readOnly = true;
      nikInput.style.opacity = '0.7';
      namaInput.value = data.nama;
      passInput.value = '';
      passInput.placeholder = '(Kosongkan jika tidak diubah)';
      passHint.textContent = 'Isi hanya jika ingin mengganti password';
      jabInput.value = data.jabatan;
      statusInput.value = data.status || 'aktif';
      document.getElementById('karyawanTglLahir').value = data.tgl_lahir || '';
      document.getElementById('karyawanFoto').value = '';
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
        var data = result.data;
        document.getElementById('statTotalKaryawan').textContent = data.total_karyawan || 0;
        document.getElementById('statHadirMasuk').textContent = data.hadir_masuk || 0;
        document.getElementById('statHadirKeluar').textContent = data.hadir_keluar || 0;
        document.getElementById('statBelumAbsen').textContent = data.belum_absen || 0;
        document.getElementById('statTerlambat').textContent = data.terlambat_count || 0;

        renderTodayAbsen(data.today_data || []);
        renderAttendanceChart(data);
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
        grouped[row.nik] = { nik: row.nik, nama: row.nama, masuk: '-', keluar: '-', status: '-' };
      }
      var jam = cleanTime(row.jam);
      if (row.jenis === 'masuk') {
        grouped[row.nik].masuk = jam;
        grouped[row.nik].status = row.status || 'Hadir';
      }
      if (row.jenis === 'keluar') grouped[row.nik].keluar = jam;
    });

    var html = '';
    Object.values(grouped).forEach(function (row) {
      var statusClass = 'badge-warning';
      var statusText = row.status !== '-' ? row.status : 'Belum Lengkap';
      
      if (row.status.toLowerCase().indexOf('terlambat') > -1) {
        statusClass = 'badge-danger';
      } else if (row.masuk !== '-' && row.keluar !== '-') {
        statusClass = 'badge-success';
        if (row.status === '-') statusText = 'Lengkap';
      } else if (row.masuk !== '-') {
        statusClass = 'badge-info';
        if (row.status === '-') statusText = 'Sudah Masuk';
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

  function renderAttendanceChart(data) {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;

    if (attendanceChart) {
      attendanceChart.destroy();
    }

    const presentCount = data.hadir_masuk || 0;
    const absentCount = data.belum_absen || 0;
    const lateCount = data.terlambat_count || 0;
    const goneHomeCount = data.hadir_keluar || 0;

    attendanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Hadir', 'Sudah Pulang', 'Terlambat', 'Tidak Masuk'],
        datasets: [{
          label: 'Jumlah Karyawan',
          data: [presentCount, goneHomeCount, lateCount, absentCount],
          backgroundColor: [
            'rgba(34, 197, 94, 0.6)',
            'rgba(249, 115, 22, 0.6)',
            'rgba(168, 85, 247, 0.6)',
            'rgba(239, 68, 68, 0.6)'
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(249, 115, 22)',
            'rgb(168, 85, 247)',
            'rgb(239, 68, 68)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
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
      var profilImg = k.foto ? '<img src="' + k.foto + '" class="table-img-mini">' : '<div class="table-img-mini-empty">' + k.nama.charAt(0) + '</div>';
      
      html += '<tr>' +
        '<td><div style="display:flex;align-items:center;gap:10px">' + profilImg + '<strong>' + k.nik + '</strong></div></td>' +
        '<td>' + k.nama + '</td>' +
        '<td>' + k.jabatan + '</td>' +
        '<td><span class="table-badge ' + statusClass + '">' + (k.status || '-') + '</span></td>' +
        '<td class="table-actions">' +
        '<button class="btn-table btn-table-id" data-nik="' + k.nik + '" title="ID Card">' +
        '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' +
        '</button>' +
        '<button class="btn-table btn-table-edit" data-nik="' + k.nik + '" title="Edit">' +
        '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' +
        '</button>' +
        '<button class="btn-table btn-table-delete" data-nik="' + k.nik + '" title="Hapus">' +
        '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>' +
        '</button>' +
        '</td></tr>';
    });

    tbody.innerHTML = html;

    // Bind ID Card buttons
    tbody.querySelectorAll('.btn-table-id').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nik = this.getAttribute('data-nik');
        var kary = list.find(function (k) { return k.nik === nik; });
        if (kary) openIDCardModal(kary);
      });
    });

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
    var tglLahir = document.getElementById('karyawanTglLahir').value;
    var fotoFile = document.getElementById('karyawanFoto').files[0];

    if (!nik || !nama || !jabatan) {
      showNotification('warning', 'Peringatan', 'NIK, Nama, dan Jabatan wajib diisi');
      return;
    }

    if (mode === 'add' && !password) {
      showNotification('warning', 'Peringatan', 'Password wajib diisi untuk karyawan baru');
      return;
    }

    showLoading('Menyimpan karyawan...', '');
    
    // Process Photo if exists
    let fotoBase64 = null;
    if (fotoFile) {
      fotoBase64 = await fileToBase64(fotoFile);
    }

    closeKaryawanModal();

    try {
      var action = mode === 'add' ? 'admin_add_karyawan' : 'admin_edit_karyawan';
      var payload = { 
        nik: nik, 
        nama: nama, 
        jabatan: jabatan, 
        status: status,
        tgl_lahir: tglLahir 
      };
      if (password) payload.password = password;
      if (fotoBase64) payload.foto_base64 = fotoBase64;

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

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  function openIDCardModal(data) {
    document.getElementById('idCardNama').textContent = data.nama;
    document.getElementById('idCardNik').textContent = data.nik;
    document.getElementById('idCardJabatan').textContent = data.jabatan;
    
    const photoEl = document.getElementById('idCardPhoto');
    if (data.foto) {
        photoEl.src = data.foto;
    } else {
        photoEl.src = 'https://via.placeholder.com/120x150?text=No+Photo';
    }
    
    document.getElementById('idCardModal').classList.add('active');
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
        currentAbsensiData = result.data.absensi || [];
        renderAbsensi(currentAbsensiData);
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
      try {
        var jenisClass = a.jenis === 'masuk' ? 'badge-success' : 'badge-info';
        var jam = cleanTime(a.jam);
        
        // Pastikan foto_url adalah URL, bukan alamat tersasar
        var url = a.foto_url || '';
        var isRealUrl = String(url).startsWith('http');
        
        var fotoBtn = isRealUrl
          ? '<button class="btn-table btn-table-view" data-url="' + url + '" data-info="' + a.nama + ' - ' + a.tanggal + ' ' + jam + '" title="Lihat Foto"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></button>'
          : '<span style="color:var(--text-light);font-size:0.8rem">-</span>';

        var lat = (a.latitude !== undefined && !isNaN(a.latitude)) ? Number(a.latitude).toFixed(5) : '-';
        var lng = (a.longitude !== undefined && !isNaN(a.longitude)) ? Number(a.longitude).toFixed(5) : '-';
        var displayAlamat = a.alamat && a.alamat !== '-' ? a.alamat : (isRealUrl ? '-' : url);
        
        var statusBadgeClass = '';
        if (a.status && a.status.toLowerCase().indexOf('terlambat') > -1) {
          statusBadgeClass = 'badge-danger';
        } else if (a.status === 'Hadir') {
          statusBadgeClass = 'badge-success';
        } else if (a.status === 'Pulang') {
          statusBadgeClass = 'badge-info';
        }

        html += '<tr>' +
          '<td>' + (a.tanggal || '-') + '</td>' +
          '<td><strong>' + (a.nik || '-') + '</strong></td>' +
          '<td>' + (a.nama || '-') + '</td>' +
          '<td>' + jam + '</td>' +
          '<td><span class="table-badge ' + jenisClass + '">' + (a.jenis || '-') + '</span></td>' +
          '<td><span class="table-badge ' + statusBadgeClass + '">' + (a.status || '-') + '</span></td>' +
          '<td style="font-size:0.75rem;color:var(--text-muted)">' + (lat !== '-' ? lat + ', ' + lng : '-') + '</td>' +
          '<td style="font-size:0.75rem;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis" title="' + displayAlamat + '">' + displayAlamat + '</td>' +
          '<td>' + fotoBtn + '</td>' +
          '</tr>';
      } catch (err) {
        console.error('Row render error:', err, a);
      }
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

  function exportToExcel() {
    console.log('Exporting to Excel...', currentAbsensiData);
    if (!window.XLSX) {
      showNotification('error', 'Error', 'Library Excel (SheetJS) tidak termuat. Periksa koneksi internet Anda.');
      return;
    }
    
    if (currentAbsensiData.length === 0) {
      showNotification('warning', 'Peringatan', 'Tidak ada data untuk diekspor. Silakan filter data terlebih dahulu.');
      return;
    }

    const data = currentAbsensiData.map(row => ({
      'Tanggal': row.tanggal,
      'NIK': row.nik,
      'Nama': row.nama,
      'Jam': row.jam,
      'Jenis': row.jenis,
      'Status': row.status,
      'Lokasi': `${row.latitude}, ${row.longitude}`,
      'Alamat': row.alamat
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `Rekap_Absensi_${new Date().getTime()}.xlsx`);
  }

  function exportToPdf() {
    console.log('Exporting to PDF...', currentAbsensiData);
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showNotification('error', 'Error', 'Library PDF (jsPDF) tidak termuat. Periksa koneksi internet Anda.');
      return;
    }

    if (currentAbsensiData.length === 0) {
      showNotification('warning', 'Peringatan', 'Tidak ada data untuk diekspor. Silakan filter data terlebih dahulu.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFontSize(16);
    doc.text('Laporan Rekap Absensi Karyawan', 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const tableData = currentAbsensiData.map(row => [
      row.tanggal,
      row.nik,
      row.nama,
      row.jam,
      row.jenis,
      row.status,
      row.alamat
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Tanggal', 'NIK', 'Nama', 'Jam', 'Jenis', 'Status', 'Alamat']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [26, 74, 138] }
    });

    doc.save(`Rekap_Absensi_${new Date().getTime()}.pdf`);
  }

  // ============================================================
  // SETTINGS
  // ============================================================

  async function loadSettings() {
    showLoading('Memuat pengaturan...');
    try {
      const result = await Api.adminAction('admin_get_settings');
      hideLoading();

      if (result.status === 'success') {
        document.getElementById('setJadwalMasuk').value = result.data.jadwal_masuk || '08:00:00';
        document.getElementById('setToleransi').value = result.data.toleransi_menit || 0;
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  async function saveSettings() {
    const jadwal = document.getElementById('setJadwalMasuk').value;
    const toleransi = document.getElementById('setToleransi').value;

    showLoading('Menyimpan pengaturan...');
    try {
      const result = await Api.adminAction('admin_save_settings', {
        jadwal_masuk: jadwal,
        toleransi_menit: parseInt(toleransi) || 0
      });
      hideLoading();

      if (result.status === 'success') {
        showNotification('success', 'Berhasil', 'Pengaturan berhasil disimpan');
      } else {
        showNotification('error', 'Gagal', result.message);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  // ============================================================
  // ADVANCED SCHEDULES
  // ============================================================

  let currentScheduleNik = '';
  let currentScheduleNama = '';

  async function loadJadwalList() {
    showLoading('Memuat daftar karyawan...');
    try {
      const result = await Api.adminAction('admin_get_karyawan');
      hideLoading();

      if (result.status === 'success') {
        renderJadwalTable(result.data.karyawan || []);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  function renderJadwalTable(karyawan) {
    var tbody = document.getElementById('jadwalBody');
    if (!tbody) return;

    if (karyawan.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Belum ada data karyawan</td></tr>';
      return;
    }

    var html = '';
    karyawan.forEach(function (k) {
      html += '<tr>' +
        '<td>' + k.nik + '</td>' +
        '<td><strong>' + k.nama + '</strong></td>' +
        '<td>' + k.jabatan + '</td>' +
        '<td><span class="table-badge badge-info">Cek via Atur</span></td>' +
        '<td>' +
        '<button class="btn btn-primary btn-sm btn-sched" data-nik="' + k.nik + '" data-nama="' + k.nama + '">Atur Jadwal</button>' +
        '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;

    // Bind buttons
    tbody.querySelectorAll('.btn-sched').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nik = this.getAttribute('data-nik');
        var nama = this.getAttribute('data-nama');
        openScheduleModal(nik, nama);
      });
    });
  }

  async function openScheduleModal(nik, nama) {
    currentScheduleNik = nik;
    currentScheduleNama = nama;
    document.getElementById('scheduleModalTitle').textContent = 'Atur Jadwal: ' + nama;
    document.getElementById('scheduleModalSubtitle').textContent = 'NIK: ' + nik;

    // Clear forms
    document.getElementById('weeklyScheduleForm').reset();
    document.getElementById('specialSchedBody').innerHTML = '<tr><td colspan="3" class="table-empty">Memuat...</td></tr>';
    
    document.getElementById('scheduleModal').classList.add('active');

    // Load data
    try {
      showLoading('Memuat jadwal...');
      const result = await Api.adminAction('admin_get_sched_data', { nik: nik });
      hideLoading();

      if (result.status === 'success') {
        var d = result.data;
        // Fill weekly
        if (d.weekly) {
          var form = document.getElementById('weeklyScheduleForm');
          for (var day in d.weekly) {
             var input = form.querySelector('[name="' + day + '"]');
             if (input) input.value = cleanTime(d.weekly[day]);
          }
        }
        // Fill special
        renderSpecialSched(d.special || []);
      }
    } catch (err) {
      hideLoading();
      showNotification('error', 'Error', err.message);
    }
  }

  function closeScheduleModal() {
    document.getElementById('scheduleModal').classList.remove('active');
  }

  function renderSpecialSched(data) {
    var tbody = document.getElementById('specialSchedBody');
    if (!tbody) return;
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="table-empty">Tujuan belum ada jadwal khusus</td></tr>';
      return;
    }
    var html = '';
    data.forEach(function(s) {
       html += '<tr><td>' + s.tanggal + '</td><td>' + s.jam_masuk + '</td><td>' + (s.keterangan || '-') + '</td></tr>';
    });
    tbody.innerHTML = html;
  }

  async function saveWeeklySchedule() {
     var form = document.getElementById('weeklyScheduleForm');
     var inputs = form.querySelectorAll('input[type="time"]');
     var schedule = {};
     inputs.forEach(input => {
        schedule[input.name] = input.value || 'OFF';
     });

     showLoading('Menyimpan jadwal rutin...');
     try {
        const res = await Api.adminAction('admin_save_weekly', {
           nik: currentScheduleNik,
           nama: currentScheduleNama,
           schedule: schedule
        });
        hideLoading();
        if (res.status === 'success') showNotification('success', 'Berhasil', 'Jadwal rutin diperbarui');
     } catch (err) {
        hideLoading();
        showNotification('error', 'Error', err.message);
     }
  }

  async function saveSpecialSchedule() {
     var tanggal = document.getElementById('specDate').value;
     var jam = document.getElementById('specTime').value;
     if (!tanggal || !jam) return;

     showLoading('Menambah jadwal khusus...');
     try {
        const res = await Api.adminAction('admin_save_special', {
           nik: currentScheduleNik,
           nama: currentScheduleNama,
           tanggal: tanggal,
           jam_masuk: jam
        });
        hideLoading();
        if (res.status === 'success') {
           showNotification('success', 'Berhasil', 'Jadwal khusus ditambahkan');
           // Reload
           openScheduleModal(currentScheduleNik, currentScheduleNama);
        }
     } catch (err) {
        hideLoading();
        showNotification('error', 'Error', err.message);
     }
  }

  // ============================================================
  // Public API
  // ============================================================
  return { init: init };
})();
