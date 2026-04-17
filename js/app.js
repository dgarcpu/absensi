/**
 * App Module - Handles all UI logic, camera, GPS, and user interactions
 * @module App
 */
const App = (() => {
  'use strict';

  // ============================================================
  // State
  // ============================================================
  let currentUser = null;
  let cameraStream = null;
  let capturedPhoto = null;
  let currentLocation = null;
  let currentAbsenType = null;
  let clockInterval = null;

  // ============================================================
  // Session Management
  // ============================================================

  function saveSession(user) {
    sessionStorage.setItem('absensi_user', JSON.stringify(user));
  }

  function getSession() {
    const data = sessionStorage.getItem('absensi_user');
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  }

  function clearSession() {
    sessionStorage.removeItem('absensi_user');
  }

  function isAdmin(user) {
    if (!user || !user.jabatan) return false;
    const jab = user.jabatan.toLowerCase().trim();
    return jab === 'admin' || jab === 'administrator' || jab === 'superadmin';
  }

  // ============================================================
  // Notification System
  // ============================================================

  function showNotification(type, title, message) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const icons = {
      success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      error: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      info: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    };

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `
      <div class="notification-icon">${icons[type] || icons.info}</div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" aria-label="Tutup">
        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
      <div class="notification-progress"></div>
    `;

    const closeBtn = notif.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => dismissNotification(notif));

    container.appendChild(notif);

    // Auto dismiss after 4 seconds
    setTimeout(() => dismissNotification(notif), 4000);
  }

  function dismissNotification(notif) {
    if (!notif || notif.classList.contains('hide')) return;
    notif.classList.add('hide');
    setTimeout(() => notif.remove(), 300);
  }

  // ============================================================
  // Loading Overlay
  // ============================================================

  function showLoading(text, subText) {
    const overlay = document.getElementById('loadingOverlay');
    const textEl = document.getElementById('loadingText');
    const subEl = document.getElementById('loadingSubText');

    if (textEl) textEl.textContent = text || 'Memproses...';
    if (subEl) subEl.textContent = subText || 'Mohon tunggu sebentar';
    if (overlay) overlay.classList.add('active');
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  // ============================================================
  // LOGIN PAGE
  // ============================================================

  function initLogin() {
    // Check if already logged in
    const user = getSession();
    if (user) {
      window.location.href = isAdmin(user) ? 'admin.html' : 'dashboard.html';
      return;
    }

    const form = document.getElementById('loginForm');
    const passwordToggle = document.getElementById('passwordToggle');

    if (form) {
      form.addEventListener('submit', handleLogin);
    }

    if (passwordToggle) {
      passwordToggle.addEventListener('click', togglePasswordVisibility);
    }
  }

  function togglePasswordVisibility() {
    const input = document.getElementById('passwordInput');
    const icon = document.getElementById('eyeIcon');
    
    if (input.type === 'password') {
      input.type = 'text';
      icon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
    } else {
      input.type = 'password';
      icon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    const nikInput = document.getElementById('nikInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');

    const nik = nikInput.value.trim();
    const password = passwordInput.value;

    if (!nik || !password) {
      showNotification('warning', 'Peringatan', 'NIK dan Password wajib diisi');
      return;
    }

    loginBtn.disabled = true;
    showLoading('Memproses login...', 'Memverifikasi data karyawan');

    try {
      const result = await Api.login(nik, password);

      if (result.status === 'success') {
        saveSession(result.data);
        showNotification('success', 'Berhasil', 'Login berhasil! Mengalihkan...');
        
        const target = isAdmin(result.data) ? 'admin.html' : 'dashboard.html';
        setTimeout(() => {
          window.location.href = target;
        }, 1000);
      } else {
        showNotification('error', 'Gagal Login', result.message || 'NIK atau password salah');
        loginBtn.disabled = false;
        hideLoading();
      }
    } catch (error) {
      console.error('Login error:', error);
      showNotification('error', 'Error', error.message || 'Terjadi kesalahan saat login');
      loginBtn.disabled = false;
      hideLoading();
    }
  }

  // ============================================================
  // DASHBOARD PAGE
  // ============================================================

  function initDashboard() {
    // Check session
    currentUser = getSession();
    if (!currentUser) {
      window.location.href = 'index.html';
      return;
    }

    // Set user info
    populateUserInfo();

    // Start clock
    updateClock();
    clockInterval = setInterval(updateClock, 1000);

    // Check attendance status
    checkAttendanceStatus();

    // Bind events
    bindDashboardEvents();
  }

  function populateUserInfo() {
    if (!currentUser) return;

    const elements = {
      navUserName: currentUser.nama,
      navUserRole: currentUser.jabatan,
      welcomeName: currentUser.nama,
      welcomeRole: currentUser.jabatan,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '-';
    });
  }

  function updateClock() {
    const now = new Date();

    const dateOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const dateStr = now.toLocaleDateString('id-ID', dateOptions);

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const dateEl = document.getElementById('clockDate');
    const hoursEl = document.getElementById('clockHours');
    const minutesEl = document.getElementById('clockMinutes');
    const secondsEl = document.getElementById('clockSeconds');

    if (dateEl) dateEl.textContent = dateStr;
    if (hoursEl) hoursEl.textContent = hours;
    if (minutesEl) minutesEl.textContent = minutes;
    if (secondsEl) secondsEl.textContent = seconds;
  }

  async function checkAttendanceStatus() {
    if (!currentUser) return;

    try {
      const result = await Api.checkStatus(currentUser.nik);

      if (result.status === 'success') {
        updateStatusUI(result.data);
      }
    } catch (error) {
      console.error('Status check error:', error);
      // Default state - belum absen
      updateStatusUI({ masuk: false, keluar: false });
    }
  }

  function updateStatusUI(data) {
    const statusMasuk = document.getElementById('statusMasuk');
    const statusKeluar = document.getElementById('statusKeluar');
    const statusMasukValue = document.getElementById('statusMasukValue');
    const statusKeluarValue = document.getElementById('statusKeluarValue');
    const btnMasuk = document.getElementById('btnAbsenMasuk');
    const btnKeluar = document.getElementById('btnAbsenKeluar');

    if (data.masuk) {
      statusMasuk.className = 'status-item active';
      statusMasukValue.textContent = data.jam_masuk || 'Sudah Absen';
      btnMasuk.disabled = true;
      btnKeluar.disabled = false;
    } else {
      statusMasuk.className = 'status-item pending';
      statusMasukValue.textContent = 'Belum Absen';
      btnMasuk.disabled = false;
      btnKeluar.disabled = true;
    }

    if (data.keluar) {
      statusKeluar.className = 'status-item active';
      statusKeluarValue.textContent = data.jam_keluar || 'Sudah Absen';
      btnKeluar.disabled = true;
    } else {
      statusKeluar.className = 'status-item inactive';
      statusKeluarValue.textContent = 'Belum Absen';
    }

    // If both done
    if (data.masuk && data.keluar) {
      btnMasuk.disabled = true;
      btnKeluar.disabled = true;
    }
  }

  function bindDashboardEvents() {
    const btnMasuk = document.getElementById('btnAbsenMasuk');
    const btnKeluar = document.getElementById('btnAbsenKeluar');
    const logoutBtn = document.getElementById('logoutBtn');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancelBtn');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const submitBtn = document.getElementById('modalSubmitBtn');

    if (btnMasuk) btnMasuk.addEventListener('click', () => openAbsenModal('masuk'));
    if (btnKeluar) btnKeluar.addEventListener('click', () => openAbsenModal('keluar'));
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (modalClose) modalClose.addEventListener('click', closeAbsenModal);
    if (modalCancel) modalCancel.addEventListener('click', closeAbsenModal);
    if (captureBtn) captureBtn.addEventListener('click', capturePhoto);
    if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);
    if (submitBtn) submitBtn.addEventListener('click', submitAbsensi);
  }

  function handleLogout() {
    stopCamera();
    clearSession();
    if (clockInterval) clearInterval(clockInterval);
    window.location.href = 'index.html';
  }

  // ============================================================
  // CAMERA & MODAL
  // ============================================================

  async function openAbsenModal(type) {
    currentAbsenType = type;
    capturedPhoto = null;
    currentLocation = null;

    const modal = document.getElementById('cameraModal');
    const title = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const cameraSection = document.getElementById('cameraSection');
    const photoPreview = document.getElementById('photoPreview');

    if (title) title.textContent = type === 'masuk' ? 'Absen Masuk' : 'Absen Keluar';
    if (submitBtn) submitBtn.disabled = true;
    
    // Reset UI
    if (cameraSection) cameraSection.style.display = 'block';
    if (photoPreview) photoPreview.style.display = 'none';

    if (modal) modal.classList.add('active');

    // Start camera and get GPS simultaneously
    startCamera();
    getLocation();
  }

  function closeAbsenModal() {
    const modal = document.getElementById('cameraModal');
    if (modal) modal.classList.remove('active');

    stopCamera();
    capturedPhoto = null;
    currentLocation = null;
    currentAbsenType = null;
    
    // Reset location info
    const locationAddress = document.getElementById('locationAddress');
    if (locationAddress) locationAddress.textContent = '';
  }

  async function startCamera() {
    const video = document.getElementById('cameraVideo');
    const placeholder = document.getElementById('cameraPlaceholder');

    if (!video) return;

    try {
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = cameraStream;
      
      if (placeholder) placeholder.style.display = 'none';

      showNotification('success', 'Kamera Aktif', 'Kamera berhasil diaktifkan');
    } catch (error) {
      console.error('Camera error:', error);
      
      let errorMsg = 'Tidak dapat mengakses kamera.';
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Akses kamera ditolak. Berikan izin kamera di pengaturan browser.';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'Kamera tidak ditemukan pada perangkat ini.';
      } else if (error.name === 'NotReadableError') {
        errorMsg = 'Kamera sedang digunakan oleh aplikasi lain.';
      }

      if (placeholder) {
        placeholder.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>
          <span>${errorMsg}</span>
        `;
      }

      showNotification('error', 'Kamera Error', errorMsg);
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }

    const video = document.getElementById('cameraVideo');
    if (video) video.srcObject = null;
  }

  function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const photoPreview = document.getElementById('photoPreview');
    const photoImage = document.getElementById('photoImage');
    const cameraSection = document.getElementById('cameraSection');

    if (!video || !canvas || !video.srcObject) {
      showNotification('warning', 'Peringatan', 'Kamera belum aktif');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    // Mirror the image horizontally (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    // Reset transformation
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Convert to base64 JPEG
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.7);

    // Show preview
    if (photoImage) photoImage.src = capturedPhoto;
    if (photoPreview) photoPreview.style.display = 'block';
    if (cameraSection) cameraSection.style.display = 'none';

    // Stop camera to save resources
    stopCamera();

    // Update submit button state
    updateSubmitButtonState();

    showNotification('info', 'Foto Diambil', 'Preview foto ditampilkan. Klik "Ulangi Foto" jika ingin mengulang.');
  }

  function retakePhoto() {
    capturedPhoto = null;

    const cameraSection = document.getElementById('cameraSection');
    const photoPreview = document.getElementById('photoPreview');

    if (cameraSection) cameraSection.style.display = 'block';
    if (photoPreview) photoPreview.style.display = 'none';

    updateSubmitButtonState();
    startCamera();
  }

  // ============================================================
  // GPS LOCATION
  // ============================================================

  function getLocation() {
    const locationInfo = document.getElementById('locationInfo');
    const locationCoords = document.getElementById('locationCoords');

    if (!navigator.geolocation) {
      if (locationInfo) locationInfo.className = 'location-info error';
      if (locationCoords) locationCoords.textContent = 'GPS tidak didukung pada browser ini';
      showNotification('error', 'GPS Error', 'Browser tidak mendukung GPS');
      return;
    }

    // Set loading state
    if (locationInfo) locationInfo.className = 'location-info loading';
    if (locationCoords) locationCoords.textContent = 'Mengambil lokasi...';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        if (locationInfo) locationInfo.className = 'location-info';
        if (locationCoords) {
          locationCoords.textContent = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)} (±${Math.round(currentLocation.accuracy)}m)`;
        }

        // Fetch address from backend
        fetchAddress(currentLocation.latitude, currentLocation.longitude);

        updateSubmitButtonState();
      },
      (error) => {
        let errorMsg = 'Gagal mendapatkan lokasi';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Akses lokasi ditolak. Berikan izin lokasi di pengaturan browser.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Informasi lokasi tidak tersedia';
            break;
          case error.TIMEOUT:
            errorMsg = 'Permintaan lokasi timeout';
            break;
        }

        if (locationInfo) locationInfo.className = 'location-info error';
        if (locationCoords) locationCoords.textContent = errorMsg;

        showNotification('error', 'GPS Error', errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function fetchAddress(lat, lng) {
    const locationAddress = document.getElementById('locationAddress');
    if (!locationAddress) return;

    locationAddress.textContent = 'Mencari alamat...';

    try {
      const result = await Api.getAddress(lat, lng);
      if (result.status === 'success' && result.data.alamat) {
        locationAddress.textContent = result.data.alamat;
      } else {
        locationAddress.textContent = 'Alamat tidak ditemukan';
      }
    } catch (error) {
      console.error('Fetch address error:', error);
      locationAddress.textContent = 'Gagal memuat alamat';
    }
  }

  // ============================================================
  // SUBMIT ABSENSI
  // ============================================================

  function updateSubmitButtonState() {
    const submitBtn = document.getElementById('modalSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = !(capturedPhoto && currentLocation);
    }
  }

  async function submitAbsensi() {
    if (!capturedPhoto || !currentLocation || !currentUser || !currentAbsenType) {
      showNotification('warning', 'Peringatan', 'Pastikan foto dan lokasi sudah tersedia');
      return;
    }

    const submitBtn = document.getElementById('modalSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;

    const jenisLabel = currentAbsenType === 'masuk' ? 'Masuk' : 'Keluar';
    showLoading(`Mengirim absen ${jenisLabel}...`, 'Mengupload foto dan data lokasi');

    try {
      const now = new Date();

      const result = await Api.submitAbsensi({
        nik: currentUser.nik,
        jenis: currentAbsenType,
        timestamp: now.toISOString(),
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        foto: capturedPhoto,
      });

      hideLoading();

      if (result.status === 'success') {
        showNotification('success', 'Berhasil', result.message || `Absen ${jenisLabel} berhasil dicatat`);
        closeAbsenModal();
        
        // Refresh status
        checkAttendanceStatus();
      } else {
        showNotification('error', 'Gagal', result.message || `Gagal mencatat absen ${jenisLabel}`);
        if (submitBtn) submitBtn.disabled = false;
      }
    } catch (error) {
      hideLoading();
      console.error('Submit error:', error);
      showNotification('error', 'Error', error.message || 'Terjadi kesalahan saat mengirim data');
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // ============================================================
  // Public API
  // ============================================================
  return {
    initLogin,
    initDashboard,
  };
})();
