// ================================================================
// dictionary.api.js - لایه API عمومی برای جداول دیکشنری
// چون همه جداول دیکشنری CRUD یکسان دارند، این لایه متدهای
// عمومی می‌سازد که endpoint هر جدول را به‌صورت پارامتر می‌گیرد.
// ================================================================

import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

// مسیر پایه دیکشنری از تنظیمات مرکزی: /api/dictionary
const DICT_BASE = API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE;

export const dictionaryApi = {
  /**
   * دریافت لیست رکوردهای یک جدول دیکشنری
   * @param {string} endpoint - نام جدول (مثل /hall-types)
   * @param {Object} [params] - پارامترهای اضافی (مثل active=all)
   */
  async getData(endpoint, params = {}) {
    return apiService.get(`${DICT_BASE}/${endpoint}`, params);
  },

  /**
   * ایجاد رکورد جدید در جدول دیکشنری
   * @param {string} endpoint - نام جدول
   * @param {Object} data - داده‌های رکورد جدید
   */
  async create(endpoint, data) {
    return apiService.post(`${DICT_BASE}/${endpoint}`, data);
  },

  /**
   * بروزرسانی رکورد موجود
   * @param {string} endpoint - نام جدول
   * @param {number|string} id - شناسه رکورد
   * @param {Object} data - داده‌های جدید
   */
  async update(endpoint, id, data) {
    return apiService.put(`${DICT_BASE}/${endpoint}/${id}`, data);
  },

  /**
   * حذف رکورد
   * @param {string} endpoint - نام جدول
   * @param {number|string} id - شناسه رکورد
   */
  async delete(endpoint, id) {
    return apiService.delete(`${DICT_BASE}/${endpoint}/${id}`);
  },
};
