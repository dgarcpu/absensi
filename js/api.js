/**
 * API Module - Handles all communication with Google Apps Script backend
 * @module Api
 */
const Api = (() => {
  'use strict';

  // ============================================================
  // CONFIGURATION - Ganti URL ini dengan URL Web App GAS Anda
  // ============================================================
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbxJCVg2miHs9dduHptYrAgcCQ8FRvsnj5otMtfsa0NYTBZL7JWdyLoV0tL5nnvQnwet/exec';

  // ============================================================
  // HTTP Methods
  // ============================================================

  /**
   * Send POST request to GAS backend
   * @param {Object} payload - Request body
   * @returns {Promise<Object>} JSON response
   */
  async function post(payload) {
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error('Response parse error:', text);
        throw new Error('Format response tidak valid dari server');
      }
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
      }
      throw error;
    }
  }

  // ============================================================
  // API Actions
  // ============================================================

  /**
   * Login with NIK and password
   * @param {string} nik - Employee NIK
   * @param {string} password - Employee password
   * @returns {Promise<Object>} Login result with employee data
   */
  async function login(nik, password) {
    if (!nik || !password) {
      throw new Error('NIK dan password wajib diisi');
    }

    const result = await post({
      action: 'login',
      nik: nik.trim(),
      password: password,
    });

    return result;
  }

  /**
   * Submit attendance (masuk/keluar)
   * @param {Object} params - Attendance parameters
   * @param {string} params.nik - Employee NIK
   * @param {string} params.jenis - Type: 'masuk' or 'keluar'
   * @param {string} params.timestamp - ISO timestamp
   * @param {number} params.latitude - GPS latitude
   * @param {number} params.longitude - GPS longitude
   * @param {string} params.foto - Base64 photo string
   * @returns {Promise<Object>} Attendance result
   */
  async function submitAbsensi(params) {
    const { nik, jenis, timestamp, latitude, longitude, foto } = params;

    if (!nik) throw new Error('NIK tidak ditemukan');
    if (!jenis) throw new Error('Jenis absensi tidak valid');
    if (!timestamp) throw new Error('Timestamp tidak ditemukan');
    if (latitude === undefined || longitude === undefined) {
      throw new Error('Lokasi GPS diperlukan');
    }
    if (!foto) throw new Error('Foto absensi diperlukan');

    const action = jenis === 'masuk' ? 'absen_masuk' : 'absen_keluar';

    const result = await post({
      action: action,
      nik: nik,
      jenis: jenis,
      timestamp: timestamp,
      latitude: latitude,
      longitude: longitude,
      foto: foto,
    });

    return result;
  }

  /**
   * Check today's attendance status
   * @param {string} nik - Employee NIK
   * @returns {Promise<Object>} Status result
   */
  async function checkStatus(nik) {
    if (!nik) throw new Error('NIK tidak ditemukan');

    const result = await post({
      action: 'check_status',
      nik: nik,
    });

    return result;
  }

  /**
   * Admin action - generic admin API call
   * @param {string} action - Admin action name
   * @param {Object} data - Action data payload
   * @returns {Promise<Object>} Action result
   */
  async function adminAction(action, data) {
    if (!action) throw new Error('Action tidak valid');

    const payload = Object.assign({ action: action }, data || {});
    const result = await post(payload);
    return result;
  }

  // ============================================================
  // Public API
  // ============================================================
  return {
    login,
    submitAbsensi,
    checkStatus,
    adminAction,
    BASE_URL,
  };
})();
