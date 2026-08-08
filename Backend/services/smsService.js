require("dotenv").config();
const axios = require("axios");

class SmsService {
  constructor() {
    // دریافت تنظیمات از محیط
    this.apiKey = process.env.SMS_API_KEY;
    this.sandboxKey = process.env.SMS_API_KEY_SANDBOX;
    this.mode = process.env.SMS_MODE || "production";
    this.defaultLine = process.env.SMS_DEFAULT_LINE;

    // انتخاب baseURL بر اساس محیط
    this.baseURL =
      this.mode === "sandbox"
        ? "https://sandbox-api.sms.ir/v1"
        : "https://api.sms.ir/v1";

    // انتخاب API Key بر اساس محیط
    this.activeApiKey = this.mode === "sandbox" ? this.sandboxKey : this.apiKey;

    console.log(`📡 سرویس SMS در حالت ${this.mode} راه‌اندازی شد`);
    console.log(`📡 Base URL: ${this.baseURL}`);
  }

  // ============================================
  // هدرهای درخواست
  // ============================================
  getHeaders() {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": this.activeApiKey,
    };
  }

  // ============================================
  // دریافت خطوط ارسالی
  // ============================================
  async getLines() {
    try {
      const response = await axios.get(`${this.baseURL}/line`, {
        headers: this.getHeaders(),
      });

      if (response.data.status === 1) {
        return response.data.data;
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error(
        "❌ خطا در دریافت خطوط:",
        error.response?.data || error.message,
      );
      return [];
    }
  }

  // ============================================
  // دریافت اعتبار فعلی
  // ============================================
  async getCredit() {
    try {
      const response = await axios.get(`${this.baseURL}/credit`, {
        headers: this.getHeaders(),
      });

      if (response.data.status === 1) {
        return response.data.data;
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error(
        "❌ خطا در دریافت اعتبار:",
        error.response?.data || error.message,
      );
      return 0;
    }
  }

  // ============================================
  // ارسال پیامک گروهی (حداکثر ۱۰۰ شماره)
  // ============================================
  async sendBulk(lineNumber, messageText, mobiles, sendDateTime = null) {
    try {
      const response = await axios.post(
        `${this.baseURL}/send/bulk`,
        {
          lineNumber: lineNumber || this.defaultLine,
          messageText,
          mobiles: this.normalizeMobiles(mobiles),
          sendDateTime,
        },
        { headers: this.getHeaders() },
      );

      if (response.data.status === 1) {
        return {
          success: true,
          packId: response.data.data.packId,
          messageIds: response.data.data.messageIds,
          cost: response.data.data.cost,
        };
      }
      throw new Error(response.data.message);
    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      console.error("❌ خطا در ارسال گروهی:", errorMsg);
      return {
        success: false,
        error: errorMsg.message || errorMsg,
        code: errorMsg.status || null,
      };
    }
  }

  // ============================================
  // ارسال پیامک تکی
  // ============================================
  async sendSingle(lineNumber, messageText, mobile, sendDateTime = null) {
    const result = await this.sendBulk(
      lineNumber,
      messageText,
      [mobile],
      sendDateTime,
    );

    return {
      success: result.success,
      messageId: result.messageIds?.[0],
      cost: result.cost,
      error: result.error,
      code: result.code,
    };
  }

  // ============================================
  // ارسال Verify (کد تایید / OTP)
  // ============================================
  async sendVerify(mobile, templateId, parameters) {
    try {
      const response = await axios.post(
        `${this.baseURL}/send/verify`,
        {
          mobile: this.normalizeMobile(mobile),
          templateId,
          parameters,
        },
        { headers: this.getHeaders() },
      );

      if (response.data.status === 1) {
        return {
          success: true,
          messageId: response.data.data.messageId,
          cost: response.data.data.cost,
        };
      }
      throw new Error(response.data.message);
    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      console.error("❌ خطا در ارسال Verify:", errorMsg);
      return {
        success: false,
        error: errorMsg.message || errorMsg,
        code: errorMsg.status || null,
      };
    }
  }

  // ============================================
  // ارسال با قالب ثبت اطلاعات هفتگی
  // ============================================
  async sendWeekRegister(mobile, params) {
    const templateId = parseInt(
      process.env.SMS_TEMPLATE_WEEK_REGISTER || 760288,
    );

    const parameters = [
      { name: "USERNAME", value: params.username || "" },
      { name: "WEEKNUMBER", value: params.weekNumber || "" },
      { name: "FLOCKNUMBER", value: params.flockNumber || "" },
      { name: "EXPERT", value: params.expert || "" },
    ];

    return await this.sendVerify(mobile, templateId, parameters);
  }

  // ============================================
  // ارسال با قالب یادآوری هفته
  // ============================================
  async sendWeekReminder(mobile, params) {
    const templateId = parseInt(
      process.env.SMS_TEMPLATE_WEEK_REMINDER || 102017,
    );

    const parameters = [
      { name: "USERNAME", value: params.username || "" },
      { name: "WEEKNUMBER", value: params.weekNumber || "" },
      { name: "DUEDATE", value: params.dueDate || "" },
    ];

    return await this.sendVerify(mobile, templateId, parameters);
  }

  // ============================================
  // بررسی وضعیت پیامک
  // ============================================
  async getMessageStatus(messageId) {
    try {
      const response = await axios.get(`${this.baseURL}/send/${messageId}`, {
        headers: this.getHeaders(),
      });

      if (response.data.status === 1) {
        return response.data.data;
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error(
        "❌ خطا در دریافت وضعیت:",
        error.response?.data || error.message,
      );
      return null;
    }
  }

  // ============================================
  // دریافت پیامک‌های دریافتی (تازه‌ترین)
  // ============================================
  async getLatestReceived(count = 100) {
    try {
      const response = await axios.get(`${this.baseURL}/receive/latest`, {
        params: { count: Math.min(count, 100) },
        headers: this.getHeaders(),
      });

      if (response.data.status === 1) {
        return response.data.data;
      }
      throw new Error(response.data.message);
    } catch (error) {
      console.error(
        "❌ خطا در دریافت پیامک‌های دریافتی:",
        error.response?.data || error.message,
      );
      return [];
    }
  }

  // ============================================
  // نرمالایز کردن شماره موبایل (به فرمت 98XXXXXXXXXX)
  // ============================================
  normalizeMobile(mobile) {
    if (!mobile) return "";
    let normalized = mobile.toString().trim();
    normalized = normalized.replace(/[^0-9+]/g, "");
    if (normalized.startsWith("+")) normalized = normalized.substring(1);
    if (normalized.startsWith("0")) normalized = normalized.substring(1);
    if (!normalized.startsWith("98")) normalized = "98" + normalized;
    return normalized;
  }

  normalizeMobiles(mobiles) {
    if (!Array.isArray(mobiles)) return [];
    return mobiles.map((m) => this.normalizeMobile(m));
  }

  // ============================================
  // بررسی وضعیت پیامک (با messageId)
  // ============================================
  async checkSmsStatus(messageId) {
    try {
      // اگر تابع getMessageStatus وجود دارد، از آن استفاده کن
      return await this.getMessageStatus(messageId);
    } catch (error) {
      console.error("❌ خطا در checkSmsStatus:", error.message);

      // در صورت خطا، undefined برمی‌گردانیم تا در کنترلر به‌درستی فیلتر شود
      // (deliveryState: 0 باعث می‌شد شرط‌ها رد شوند)
      return null;
    }
  }

  // ============================================
  // دریافت متن وضعیت تحویل (تابع کمکی)
  // ============================================
  getDeliveryStateText(deliveryState) {
    const statusMap = {
      1: "رسیده به گوشی",
      2: "نرسیده به گوشی",
      3: "رسیده به مخابرات",
      4: "نرسیده به مخابرات",
      5: "رسیده به اپراتور",
      6: "ناموفق",
      7: "لیست سیاه",
      8: "نامشخص",
    };
    return statusMap[deliveryState] || "نامشخص";
  }
}

module.exports = new SmsService();
