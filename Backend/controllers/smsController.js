const SmsService = require("../services/smsService"); // ✅ این درست است
const { successResponse, errorResponse } = require("../utils/response");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const User = require("../models/User");
const SmsLog = require("../models/SmsLog");
const { Op } = require("sequelize");

// ============================================
// دریافت اعتبار فعلی
// ============================================
const getCredit = async (req, res) => {
  try {
    const credit = await SmsService.getCredit();
    successResponse(res, { credit }, "اعتبار فعلی");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// دریافت خطوط ارسالی
// ============================================
const getLines = async (req, res) => {
  try {
    const lines = await SmsService.getLines();
    successResponse(res, lines, "لیست خطوط ارسالی");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// ارسال پیامک تست (ساده)
// ============================================
const sendTestSms = async (req, res) => {
  try {
    const { mobile, message } = req.body;

    if (!mobile || !message) {
      return errorResponse(res, "شماره موبایل و متن پیام الزامی است", 400);
    }

    const lines = await SmsService.getLines();
    const lineNumber = lines[0] || process.env.SMS_DEFAULT_LINE;

    if (!lineNumber) {
      return errorResponse(res, "هیچ خط ارسالی یافت نشد", 400);
    }

    const result = await SmsService.sendSingle(lineNumber, message, mobile);

    if (result.success) {
      successResponse(res, result, "پیامک با موفقیت ارسال شد");
    } else {
      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// ارسال پیامک سفارشی (گروهی)
// ============================================
const sendCustomSms = async (req, res) => {
  try {
    const { lineNumber, message, mobiles, sendDateTime } = req.body;

    if (!mobiles || !mobiles.length || !message) {
      return errorResponse(res, "شماره موبایل و متن پیام الزامی است", 400);
    }

    if (mobiles.length > 100) {
      return errorResponse(res, "حداکثر ۱۰۰ شماره مجاز است", 400);
    }

    const result = await SmsService.sendBulk(
      lineNumber || process.env.SMS_DEFAULT_LINE,
      message,
      mobiles,
      sendDateTime,
    );

    if (result.success) {
      // ✅ ذخیره لاگ برای هر شماره ارسال‌شده (اگر مشتری با این شماره وجود داشته باشد)
      const messageIds = result.messageIds || [];

      for (let i = 0; i < mobiles.length; i++) {
        try {
          // پیدا کردن مشتری با این شماره موبایل (اختیاری)
          const customer = await CustomerPersonalInfo.findOne({
            where: { mobile_number: mobiles[i] },
            attributes: ["id", "flock_id", "week_number"],
          });

          const logData = {
            mobile: mobiles[i],
            message,
            status: "sent",
            type: "custom",
            sent_by: req.user?.id || null,
            sent_at: new Date(),
            message_id: messageIds[i] || null,
          };

          // اگر مشتری پیدا شد، customer_id را هم ذخیره کن
          if (customer) {
            logData.customer_id = customer.id;
            // پیدا کردن گله فعال مشتری (اختیاری)
            const ChickPlacement = require("../models/ChickPlacement");
            const flock = await ChickPlacement.findOne({
              where: { customer_id: customer.id, is_active: true },
              attributes: ["id", "week_number"],
            });
            if (flock) {
              logData.flock_id = flock.id;
              logData.week_number = flock.week_number;
            }
          }

          // بررسی وضعیت تحویل برای هر پیامک (اگر messageId موجود است)
          if (messageIds[i]) {
            try {
              const statusResult = await SmsService.checkSmsStatus(
                messageIds[i],
              );
              if (statusResult && statusResult.deliveryState !== undefined) {
                logData.delivery_state = statusResult.deliveryState;
                logData.status =
                  statusResult.deliveryState === 1
                    ? "delivered"
                    : statusResult.deliveryState === 6
                      ? "failed"
                      : "sent";
                if (statusResult.deliveryState === 1) {
                  logData.delivered_at = new Date();
                }
              }
            } catch (statusError) {
              console.error(
                `⚠️ خطا در دریافت وضعیت تحویل پیامک ${messageIds[i]}:`,
                statusError.message,
              );
            }
          }

          await SmsLog.create(logData);
        } catch (logError) {
          console.error(
            `⚠️ خطا در ذخیره لاگ برای شماره ${mobiles[i]}:`,
            logError.message,
          );
        }
      }

      successResponse(res, result, "پیامک با موفقیت ارسال شد");
    } else {
      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// ارسال Verify (کد تایید)
// ============================================
const sendVerify = async (req, res) => {
  try {
    const { mobile, templateId, parameters } = req.body;

    if (!mobile || !templateId) {
      return errorResponse(res, "شماره موبایل و شناسه قالب الزامی است", 400);
    }

    const result = await SmsService.sendVerify(mobile, templateId, parameters);

    if (result.success) {
      successResponse(res, result, "کد تایید با موفقیت ارسال شد");
    } else {
      const errorMessages = {
        10: "کلید وب سرویس نامعتبر است",
        11: "کلید وب سرویس غیرفعال است",
        102: "اعتبار کافی نمی‌باشد",
        113: "قالب یافت نشد",
        115: "شماره موبایل در لیست سیاه است",
        116: "نام پارامتر مقداردهی نشده است",
        123: "خط ارسال‌کننده نیاز به فعال‌سازی دارد",
        124: "قالب OTP شناسایی نشد",
      };
      const userMessage = errorMessages[result.code] || result.error;
      errorResponse(res, userMessage, 400);
    }
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// ارسال قالب ثبت اطلاعات هفتگی
// ============================================
const sendWeekRegister = async (req, res) => {
  try {
    const { mobile, username, weekNumber, flockNumber, expert } = req.body;

    if (!mobile || !username || !weekNumber) {
      return errorResponse(
        res,
        "شماره موبایل، نام کاربری و شماره هفته الزامی است",
        400,
      );
    }

    const result = await SmsService.sendWeekRegister(mobile, {
      username,
      weekNumber,
      flockNumber: flockNumber || "",
      expert: expert || "",
    });

    if (result.success) {
      successResponse(res, result, "پیامک ثبت هفته با موفقیت ارسال شد");
    } else {
      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// ارسال قالب یادآوری هفته
// ============================================
const sendWeekReminder = async (req, res) => {
  try {
    const { mobile, username, weekNumber, dueDate } = req.body;

    if (!mobile || !username || !weekNumber || !dueDate) {
      return errorResponse(res, "تمامی فیلدها الزامی هستند", 400);
    }

    const result = await SmsService.sendWeekReminder(mobile, {
      username,
      weekNumber,
      dueDate,
    });

    if (result.success) {
      successResponse(res, result, "پیامک یادآوری با موفقیت ارسال شد");
    } else {
      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// ارسال یادآوری هفتگی گله/دوره (per گله یا per سالن اختیاری)
// ============================================
const sendFlockReminder = async (req, res) => {
  try {
    const { customer_id, flock_id, hall_id } = req.body;

    if (!customer_id || !flock_id) {
      return errorResponse(
        res,
        "شناسه مشتری و گله/دوره الزامی است",
        400,
      );
    }

    const Flock = require("../models/Flock");
    const ChickPlacement = require("../models/ChickPlacement");

    const customer = await CustomerPersonalInfo.findByPk(customer_id);
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }
    if (!customer.mobile_number) {
      return errorResponse(res, "شماره موبایل مشتری ثبت نشده است", 400);
    }

    const flock = await Flock.findByPk(flock_id);
    if (!flock) {
      return errorResponse(res, "گله/دوره یافت نشد", 404);
    }
    if (parseInt(flock.customer_id) !== parseInt(customer_id)) {
      return errorResponse(res, "گله متعلق به این مشتری نیست", 400);
    }

    // تاریخ مبنا برای محاسبه هفته: سالن اختیاری یا تاریخ تعریف گله
    let baseDate = flock.placement_date;
    let label = `گله ${flock.flock_number}`;
    if (hall_id) {
      const placement = await ChickPlacement.findByPk(hall_id);
      if (!placement) {
        return errorResponse(res, "سالن/جوجه‌ریزی یافت نشد", 404);
      }
      if (
        placement.flock_id &&
        parseInt(placement.flock_id) !== parseInt(flock.id)
      ) {
        return errorResponse(res, "سالن عضو این گله نیست", 400);
      }
      baseDate = placement.placement_date;
      label = `گله ${flock.flock_number}`;
    }

    const start = new Date(baseDate);
    const today = new Date();
    if (isNaN(start.getTime())) {
      return errorResponse(res, "تاریخ مبنا نامعتبر است", 400);
    }
    const diffDays = Math.floor(
      (today - start) / (1000 * 60 * 60 * 24),
    );
    const weekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const dueDate = weekEnd.toISOString().slice(0, 10);

    const result = await SmsService.sendWeekReminder(
      customer.mobile_number,
      {
        username: customer.full_name || customer.mobile_number,
        weekNumber,
        dueDate,
      },
    );

    if (result.success) {
      successResponse(
        res,
        { ...result, flockNumber: flock.flock_number, weekNumber, dueDate },
        `یادآوری هفتگی ${label} ارسال شد`,
      );
    } else {
      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    console.error("❌ خطا در ارسال یادآوری گله:", error);
    errorResponse(res, error.message, 502);
  }
};

// ============================================
// ارسال پیامک به گیرنده دلخواه (کارشناس/مدیر/مرغدار)
// ============================================
const sendToRecipient = async (req, res) => {
  try {
    const { mobile, message } = req.body;
    if (!mobile || !message) {
      return errorResponse(
        res,
        "شماره موبایل و متن پیام الزامی است",
        400,
      );
    }
    const lines = await SmsService.getLines();
    const lineNumber = (lines && lines[0]) || process.env.SMS_DEFAULT_LINE;
    if (!lineNumber) {
      return errorResponse(res, "هیچ خط ارسالی یافت نشد", 400);
    }
    const result = await SmsService.sendSingle(lineNumber, message, mobile);
    if (result.success) {
      successResponse(
        res,
        { ...result, mobile },
        "پیامک با موفقیت ارسال شد",
      );
    } else {
      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    console.error("❌ خطا در ارسال به گیرنده:", error);
    errorResponse(res, error.message, 502);
  }
};

// ============================================
// بررسی وضعیت پیامک
// ============================================
const getMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return errorResponse(res, "شناسه پیامک الزامی است", 400);
    }

    const status = await SmsService.getMessageStatus(messageId);

    if (status) {
      const deliveryStatus = {
        1: "رسیده به گوشی",
        2: "نرسیده به گوشی",
        3: "رسیده به مخابرات",
        4: "نرسیده به مخابرات",
        5: "رسیده به اپراتور",
        6: "ناموفق",
        7: "لیست سیاه",
        8: "نامشخص",
      };

      successResponse(
        res,
        {
          ...status,
          deliveryText: deliveryStatus[status.deliveryState] || "نامشخص",
        },
        "وضعیت پیامک",
      );
    } else {
      errorResponse(res, "پیامک یافت نشد", 404);
    }
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// دریافت پیامک‌های دریافتی
// ============================================
const getReceivedMessages = async (req, res) => {
  try {
    const { count = 100 } = req.query;

    const messages = await SmsService.getLatestReceived(
      Math.min(parseInt(count), 100),
    );

    successResponse(res, messages, "لیست پیامک‌های دریافتی");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ============================================
// ارسال پیامک به یک مشتری (با گرفتن از دیتابیس)
// ============================================
const sendToCustomer = async (req, res) => {
  try {
    const { customerId, message, flockId, weekNumber } = req.body;

    if (!customerId || !message) {
      return errorResponse(res, "شناسه مشتری و متن پیام الزامی است", 400);
    }

    // دریافت اطلاعات مشتری
    const customer = await CustomerPersonalInfo.findByPk(customerId);
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    if (!customer.mobile_number) {
      return errorResponse(res, "مشتری شماره موبایل ندارد", 400);
    }

    // ارسال پیامک
    const result = await SmsService.sendSingle(
      process.env.SMS_DEFAULT_LINE,
      message,
      customer.mobile_number,
    );

    if (result.success) {
      // ✅ ذخیره لاگ ارسال پیامک
      let smsLog = null;
      try {
        smsLog = await SmsLog.create({
          customer_id: customerId,
          mobile: customer.mobile_number,
          message,
          message_id: result.messageId || null,
          status: "sent",
          type: "manual",
          sent_by: req.user?.id || null,
          sent_at: new Date(),
          flock_id: flockId ? parseInt(flockId) : null,
          week_number: weekNumber ? parseInt(weekNumber) : null,
        });
      } catch (logError) {
        console.error("⚠️ خطا در ذخیره لاگ پیامک:", logError.message);
      }

      // ✅ بررسی وضعیت تحویل پیامک از سرویس (اگر messageId موجود است)
      if (smsLog && result.messageId) {
        try {
          const statusResult = await SmsService.checkSmsStatus(
            result.messageId,
          );
          if (statusResult && statusResult.deliveryState !== undefined) {
            await smsLog.update({
              delivery_state: statusResult.deliveryState,
              status:
                statusResult.deliveryState === 1
                  ? "delivered"
                  : statusResult.deliveryState === 6
                    ? "failed"
                    : "sent",
              delivered_at:
                statusResult.deliveryState === 1 ? new Date() : null,
            });
            console.log(
              `📊 وضعیت تحویل پیامک ${result.messageId}: state=${statusResult.deliveryState}`,
            );
          }
        } catch (statusError) {
          console.error("⚠️ خطا در دریافت وضعیت تحویل:", statusError.message);
        }
      }

      // ✅ دریافت لاگ کامل با اطلاعات فرستنده و وضعیت به‌روز
      let completeLog = null;
      if (smsLog) {
        try {
          completeLog = await SmsLog.findByPk(smsLog.id, {
            include: [
              {
                model: User,
                as: "sender",
                attributes: ["id", "first_name", "last_name", "username"],
              },
            ],
          });
        } catch (includeError) {
          console.error("⚠️ خطا در دریافت لاگ کامل:", includeError.message);
        }
      }

      successResponse(
        res,
        {
          customerId: customer.id,
          mobile: customer.mobile_number,
          messageId: result.messageId,
          cost: result.cost,
          log: completeLog || smsLog,
        },
        "پیامک با موفقیت ارسال شد",
      );
    } else {
      // ✅ ذخیره لاگ ناموفق
      try {
        await SmsLog.create({
          customer_id: customerId,
          mobile: customer.mobile_number,
          message,
          status: "failed",
          type: "manual",
          sent_by: req.user?.id || null,
          sent_at: new Date(),
          error: result.error || "خطا در ارسال",
          flock_id: flockId ? parseInt(flockId) : null,
          week_number: weekNumber ? parseInt(weekNumber) : null,
        });
      } catch (logError) {
        console.error("⚠️ خطا در ذخیره لاگ ناموفق:", logError.message);
      }

      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ارسال پیامک گروهی به چند مشتری
// ============================================
const sendBulkToCustomers = async (req, res) => {
  try {
    const { customerIds, message } = req.body;

    if (
      !customerIds ||
      !Array.isArray(customerIds) ||
      customerIds.length === 0
    ) {
      return errorResponse(res, "لیست مشتریان ارسال نشده است", 400);
    }

    if (!message) {
      return errorResponse(res, "متن پیام الزامی است", 400);
    }

    // دریافت اطلاعات مشتریان
    const customers = await CustomerPersonalInfo.findAll({
      where: { id: customerIds, active: true },
    });

    if (customers.length === 0) {
      return errorResponse(res, "هیچ مشتری فعالی یافت نشد", 404);
    }

    // استخراج شماره‌ها
    const mobiles = customers
      .filter((c) => c.mobile_number)
      .map((c) => c.mobile_number);

    if (mobiles.length === 0) {
      return errorResponse(res, "هیچ مشتری شماره موبایل ندارد", 400);
    }

    // ارسال پیامک گروهی
    const result = await SmsService.sendBulk(
      process.env.SMS_DEFAULT_LINE,
      message,
      mobiles,
    );

    if (result.success) {
      // ✅ ذخیره لاگ برای هر پیامک ارسال‌شده
      const logs = [];
      const messageIds = result.messageIds || [];

      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        if (!customer.mobile_number) continue;

        try {
          const logData = {
            customer_id: customer.id,
            mobile: customer.mobile_number,
            message,
            status: "sent",
            type: "bulk",
            sent_by: req.user?.id || null,
            sent_at: new Date(),
            message_id: messageIds[i] || null,
          };

          // بررسی وضعیت تحویل برای هر پیامک (اگر messageId موجود است)
          if (messageIds[i]) {
            try {
              const statusResult = await SmsService.checkSmsStatus(
                messageIds[i],
              );
              if (statusResult && statusResult.deliveryState !== undefined) {
                logData.delivery_state = statusResult.deliveryState;
                logData.status =
                  statusResult.deliveryState === 1
                    ? "delivered"
                    : statusResult.deliveryState === 6
                      ? "failed"
                      : "sent";
                if (statusResult.deliveryState === 1) {
                  logData.delivered_at = new Date();
                }
              }
            } catch (statusError) {
              console.error(
                `⚠️ خطا در دریافت وضعیت تحویل پیامک ${messageIds[i]}:`,
                statusError.message,
              );
            }
          }

          const log = await SmsLog.create(logData);
          logs.push(log);
        } catch (logError) {
          console.error(
            `⚠️ خطا در ذخیره لاگ برای مشتری ${customer.id}:`,
            logError.message,
          );
        }
      }

      successResponse(
        res,
        {
          sentCount: mobiles.length,
          messageIds: result.messageIds,
          cost: result.cost,
          logs,
        },
        `پیامک به ${mobiles.length} مشتری ارسال شد`,
      );
    } else {
      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);
    }
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ذخیره لاگ پیامک - نسخه کامل با تمام فیلدها
// ============================================
const saveSmsLog = async (req, res) => {
  try {
    const {
      customer_id,
      mobile,
      message,
      status,
      message_id,
      sent_at,
      sent_by,
      flock_id, // ✅ اضافه شد
      week_number, // ✅ اضافه شد
      template_id, // ✅ اضافه شد
      type, // ✅ اضافه شد
    } = req.body;

    // اعتبارسنجی
    if (!mobile || !message) {
      return errorResponse(res, "شماره موبایل و متن پیام الزامی است", 400);
    }

    // ✅ لاگ برای دیباگ
    console.log("📝 ذخیره لاگ در سرور:", {
      customer_id,
      mobile,
      message_id,
      flock_id,
      week_number,
      sent_by: sent_by || req.user?.id,
    });

    const logData = {
      mobile,
      message,
      status: status || "pending",
      message_id: message_id || null,
      sent_by: sent_by || req.user?.id || null,
      sent_at: sent_at || new Date(),
      type: type || "sent",
    };

    // اضافه کردن فیلدهای اختیاری
    if (customer_id) {
      logData.customer_id = parseInt(customer_id);
    }
    if (flock_id) {
      logData.flock_id = parseInt(flock_id);
    }
    if (week_number) {
      logData.week_number = parseInt(week_number);
    }
    if (template_id) {
      logData.template_id = parseInt(template_id);
    }

    const log = await SmsLog.create(logData);

    // دریافت لاگ با اطلاعات کامل برای بازگشت
    const completeLog = await SmsLog.findByPk(log.id, {
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
        {
          model: User,
          as: "sender",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
    });

    successResponse(res, completeLog, "لاگ پیامک با موفقیت ذخیره شد", 201);
  } catch (error) {
    console.error("❌ خطا در ذخیره لاگ:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت لاگ‌های اخیر پیامک
// ============================================
const getRecentSmsLogs = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const logs = await SmsLog.findAll({
      where: { sent_by: req.user.id },
      order: [["sent_at", "DESC"]],
      limit: parseInt(limit),
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
      ],
    });

    successResponse(res, logs, "لاگ‌های اخیر پیامک دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت لاگ‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت لاگ‌های پیامک یک مشتری (با فیلتر flock_id و include sender)
// ============================================
const getCustomerSmsLogs = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { flock_id } = req.query;

    if (!customerId) {
      return errorResponse(res, "شناسه مشتری الزامی است", 400);
    }

    const where = { customer_id: customerId };
    if (flock_id) {
      where.flock_id = parseInt(flock_id);
    }

    const logs = await SmsLog.findAll({
      where,
      order: [["sent_at", "DESC"]],
      limit: 100,
      include: [
        {
          model: User,
          as: "sender", // ✅ alias تعریف‌شده در associations
          attributes: ["id", "first_name", "last_name", "username"],
        },
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name"],
        },
      ],
    });

    successResponse(res, logs, "لاگ‌های پیامک مشتری دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت لاگ‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی وضعیت پیامک
// ============================================
const updateSmsStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status, delivery_state } = req.body;

    if (!messageId) {
      return errorResponse(res, "شناسه پیامک الزامی است", 400);
    }

    const log = await SmsLog.findOne({ where: { message_id: messageId } });
    if (!log) {
      return errorResponse(res, "لاگ پیامک یافت نشد", 404);
    }

    await log.update({
      status: status || log.status,
      delivery_state: delivery_state || null,
      delivered_at: status === "delivered" ? new Date() : log.delivered_at,
    });

    successResponse(res, log, "وضعیت پیامک بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی وضعیت:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت وضعیت پیامک از سرویس و بروزرسانی لاگ
// ============================================
const checkAndUpdateSmsStatus = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return errorResponse(res, "شناسه پیامک الزامی است", 400);
    }

    // دریافت وضعیت از سرویس
    const status = await SmsService.getMessageStatus(messageId);

    if (!status) {
      return errorResponse(res, "وضعیت پیامک دریافت نشد", 404);
    }

    // بروزرسانی لاگ
    const log = await SmsLog.findOne({ where: { message_id: messageId } });
    if (log) {
      const deliveryStatusMap = {
        1: "delivered",
        2: "failed",
        3: "sent",
        4: "failed",
        5: "sent",
        6: "failed",
        7: "failed",
        8: "pending",
      };

      await log.update({
        status: deliveryStatusMap[status.deliveryState] || "pending",
        delivery_state: status.deliveryState,
        delivered_at:
          status.deliveryState === 1 ? new Date() : log.delivered_at,
      });
    }

    successResponse(
      res,
      {
        messageId,
        deliveryState: status.deliveryState,
        deliveryText: getDeliveryStatusText(status.deliveryState),
        log: log || null,
      },
      "وضعیت پیامک دریافت شد",
    );
  } catch (error) {
    console.error("خطا در بررسی وضعیت:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// تابع کمکی برای دریافت متن وضعیت تحویل
// ============================================
function getDeliveryStatusText(deliveryState) {
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

// ============================================
// بروزرسانی وضعیت پیامک‌ها با استعلام از سرویس
// ============================================
const updateSmsStatusFromProvider = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return errorResponse(res, "شناسه پیامک الزامی است", 400);
    }

    console.log(`📊 بروزرسانی وضعیت پیامک: ${messageId}`);

    // 1. پیدا کردن لاگ در دیتابیس
    const smsLog = await SmsLog.findOne({
      where: { message_id: messageId },
      include: [
        { model: CustomerPersonalInfo, as: "customer" },
        { model: User, as: "sender" },
      ],
    });

    if (!smsLog) {
      return errorResponse(res, "لاگ پیامک یافت نشد", 404);
    }

    // 2. ✅ استفاده از SmsService.checkSmsStatus
    const statusResult = await SmsService.checkSmsStatus(messageId);

    console.log(`📊 وضعیت دریافت شده:`, statusResult);

    if (!statusResult || statusResult.deliveryState === undefined) {
      return errorResponse(res, "وضعیت پیامک قابل دریافت نیست", 400);
    }

    // 3. بروزرسانی لاگ
    const updateData = {
      delivery_state: statusResult.deliveryState,
      status:
        statusResult.deliveryState === 1
          ? "delivered"
          : statusResult.deliveryState === 6
            ? "failed"
            : statusResult.deliveryState === 3
              ? "sent"
              : "pending",
    };

    if (statusResult.deliveryDateTime) {
      updateData.delivered_at = new Date(statusResult.deliveryDateTime * 1000);
    } else if (statusResult.deliveryState === 1) {
      // اگر تحویل شده ولی زمان ندارد، زمان فعلی را ثبت کن
      updateData.delivered_at = new Date();
    }

    await smsLog.update(updateData);

    // 4. دریافت لاگ بروز شده
    const updatedLog = await SmsLog.findByPk(smsLog.id, {
      include: [
        { model: CustomerPersonalInfo, as: "customer" },
        { model: User, as: "sender" },
      ],
    });

    successResponse(res, updatedLog, "وضعیت پیامک بروزرسانی شد");
  } catch (error) {
    console.error("❌ خطا در بروزرسانی وضعیت پیامک:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی وضعیت همه پیامک‌های یک مشتری/گله
// ============================================
const updateAllSmsStatusForFlock = async (req, res) => {
  try {
    const { customerId, flockId } = req.params;

    console.log(
      `🔄 بروزرسانی وضعیت پیامک‌های مشتری ${customerId}, گله ${flockId}`,
    );

    // 1. پیدا کردن لاگ‌های مرتبط (فقط پیامک‌هایی که message_id دارند و تحویل نشده‌اند)
    const where = { customer_id: parseInt(customerId) };
    if (flockId && flockId !== "null" && flockId !== "undefined") {
      where.flock_id = parseInt(flockId);
    }

    // فقط پیامک‌هایی که message_id دارند و هنوز تحویل نشده‌اند (delivery_state != 1)
    where.message_id = { [Op.ne]: null };
    where.delivery_state = { [Op.or]: [null, 0, 2, 3, 4, 5, 6, 7, 8] };

    const logs = await SmsLog.findAll({
      where,
      order: [["sent_at", "DESC"]],
      limit: 100,
    });

    if (logs.length === 0) {
      return errorResponse(res, "هیچ پیامکی برای این مشتری/گله یافت نشد", 404);
    }

    console.log(`📋 ${logs.length} پیامک یافت شد`);

    const results = [];
    let updatedCount = 0;

    // 2. بروزرسانی هر لاگ
    for (const log of logs) {
      try {
        // اگر قبلاً تحویل شده و زمان دارد، رد شو
        if (log.delivery_state === 1 && log.delivered_at) {
          results.push({
            messageId: log.message_id,
            status: log.status,
            delivered_at: log.delivered_at,
            already_delivered: true,
          });
          continue;
        }

        console.log(`📊 بررسی پیامک: ${log.message_id}`);

        // ✅ استفاده از SmsService.checkSmsStatus
        const statusResult = await SmsService.checkSmsStatus(log.message_id);

        if (statusResult && statusResult.deliveryState !== undefined) {
          const updateData = {
            delivery_state: statusResult.deliveryState,
            status:
              statusResult.deliveryState === 1
                ? "delivered"
                : statusResult.deliveryState === 6
                  ? "failed"
                  : statusResult.deliveryState === 3
                    ? "sent"
                    : "pending",
          };

          if (statusResult.deliveryDateTime) {
            updateData.delivered_at = new Date(
              statusResult.deliveryDateTime * 1000,
            );
          } else if (statusResult.deliveryState === 1) {
            updateData.delivered_at = new Date();
          }

          await log.update(updateData);
          updatedCount++;

          results.push({
            messageId: log.message_id,
            status: updateData.status,
            delivered_at: updateData.delivered_at || null,
            delivery_state: statusResult.deliveryState,
          });

          console.log(
            `✅ پیامک ${log.message_id} به ${updateData.status} بروزرسانی شد`,
          );
        }
      } catch (err) {
        console.error(
          `❌ خطا در بروزرسانی پیامک ${log.message_id}:`,
          err.message,
        );
        results.push({
          messageId: log.message_id,
          error: err.message,
        });
      }
    }

    successResponse(
      res,
      {
        total: logs.length,
        updated: updatedCount,
        results,
      },
      `${updatedCount} از ${logs.length} پیامک بروزرسانی شد`,
    );
  } catch (error) {
    console.error("❌ خطا در بروزرسانی وضعیت پیامک‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};
module.exports = {
  getCredit,
  getLines,
  sendTestSms,
  sendCustomSms,
  sendVerify,
  sendWeekRegister,
  sendWeekReminder,
  sendFlockReminder,
  sendToRecipient,
  getMessageStatus,
  getReceivedMessages,
  sendToCustomer,
  sendBulkToCustomers,
  saveSmsLog,
  getRecentSmsLogs,
  getCustomerSmsLogs,
  updateSmsStatus,
  checkAndUpdateSmsStatus,
  updateSmsStatusFromProvider,
  updateAllSmsStatusForFlock,
};
