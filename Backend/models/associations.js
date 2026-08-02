// ======================= import models data base =============
const CustomerPersonalInfo = require("./CustomerPersonalInfo");
const Period = require("./Period");
const Hall = require("./Hall");
const HallPhysicalInfo = require("./HallPhysicalInfo");
const HallSystem = require("./HallSystem");
const HallWaterFeed = require("./HallWaterFeed");
const HallHygiene = require("./HallHygiene");
const ChickPlacement = require("./ChickPlacement");
const WeeklyManagement = require("./WeeklyManagement");
const WeeklyDisease = require("./WeeklyDisease");
const WeeklyVaccine = require("./WeeklyVaccine");
const WeeklyMedicine = require("./WeeklyMedicine");
const WeeklyFeed = require("./WeeklyFeed");
const WeeklySuggestion = require("./WeeklySuggestion");
const FlockCompletion = require("./FlockCompletion");
const Disease = require("./Disease");
const Vaccine = require("./Vaccine");
const Medicine = require("./Medicine");
const FeedType = require("./FeedType");
const SuggestionType = require("./SuggestionType");
const VisitReport = require("./VisitReport");
const VisitReportHall = require("./VisitReportHall");
const VisitReportExpert = require("./VisitReportExpert");
const VisitReportAttachment = require("./VisitReportAttachment");
const User = require("./User");
const Bookmark = require("./Bookmark");
const ChickenBreed = require("./ChickenBreed");
const ChickSource = require("./ChickSource");
const SmsLog = require("./SmsLog");

// ================================================================
// ✅ ارتباطات با CASCADE برای حذف آبشاری
// ================================================================

// ===== CustomerPersonalInfo → تمام وابستگی‌ها =====
CustomerPersonalInfo.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});
User.hasMany(CustomerPersonalInfo, {
  foreignKey: "created_by",
  as: "created_customers",
});

CustomerPersonalInfo.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater",
});
User.hasMany(CustomerPersonalInfo, {
  foreignKey: "updated_by",
  as: "updated_customers",
});

// ===== CustomerPersonalInfo → Period =====
CustomerPersonalInfo.hasMany(Period, {
  foreignKey: "customer_personal_information_id",
  onDelete: "CASCADE",
  hooks: true,
});
Period.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_personal_information_id",
});

// ===== CustomerPersonalInfo → Hall =====
CustomerPersonalInfo.hasMany(Hall, {
  foreignKey: "customer_id",
  onDelete: "CASCADE",
  hooks: true,
});
Hall.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
});

// ===== CustomerPersonalInfo → ChickPlacement =====
CustomerPersonalInfo.hasMany(ChickPlacement, {
  foreignKey: "customer_id",
  onDelete: "CASCADE",
  hooks: true,
});
ChickPlacement.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
});

// ===== CustomerPersonalInfo → VisitReport =====
CustomerPersonalInfo.hasMany(VisitReport, {
  foreignKey: "customer_id",
  onDelete: "CASCADE",
  hooks: true,
});
VisitReport.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
});

// ===== CustomerPersonalInfo → Bookmark =====
CustomerPersonalInfo.hasMany(Bookmark, {
  foreignKey: "customer_id",
  onDelete: "CASCADE",
  hooks: true,
});
Bookmark.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
  as: "customer", // ✅ این alias باید با مقدار استفاده شده در کنترلر یکی باشد
});

// ===== CustomerPersonalInfo → SmsLog =====
CustomerPersonalInfo.hasMany(SmsLog, {
  foreignKey: "customer_id",
  onDelete: "CASCADE",
  hooks: true,
});
SmsLog.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
});

// ===== CustomerPersonalInfo → HallHygiene =====
CustomerPersonalInfo.hasMany(HallHygiene, {
  foreignKey: "customer_id",
  onDelete: "CASCADE",
  hooks: true,
});
HallHygiene.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
});

// ================================================================
// ✅ ارتباطات Period با وابستگی‌ها
// ================================================================

// Period → Hall
Period.hasMany(Hall, {
  foreignKey: "period_id",
  onDelete: "CASCADE",
  hooks: true,
});
Hall.belongsTo(Period, {
  foreignKey: "period_id",
});

// Period → ChickPlacement
Period.hasMany(ChickPlacement, {
  foreignKey: "period_id",
  onDelete: "CASCADE",
  hooks: true,
});
ChickPlacement.belongsTo(Period, {
  foreignKey: "period_id",
});

// Period → VisitReport
Period.hasMany(VisitReport, {
  foreignKey: "period_id",
  onDelete: "CASCADE",
  hooks: true,
});
VisitReport.belongsTo(Period, {
  foreignKey: "period_id",
});

// ✅ Period → HallPhysicalInfo (جدید)
Period.hasMany(HallPhysicalInfo, {
  foreignKey: "period_id",
  as: "hallPhysicalInfos",
  onDelete: "CASCADE",
  hooks: true,
});
HallPhysicalInfo.belongsTo(Period, {
  foreignKey: "period_id",
  as: "period",
});

// ✅ Period → HallSystem (جدید)
Period.hasMany(HallSystem, {
  foreignKey: "period_id",
  as: "hallSystems",
  onDelete: "CASCADE",
  hooks: true,
});
HallSystem.belongsTo(Period, {
  foreignKey: "period_id",
  as: "period",
});

// ✅ Period → HallWaterFeed (جدید)
Period.hasMany(HallWaterFeed, {
  foreignKey: "period_id",
  as: "hallWaterFeeds",
  onDelete: "CASCADE",
  hooks: true,
});
HallWaterFeed.belongsTo(Period, {
  foreignKey: "period_id",
  as: "period",
});

// ================================================================
// ✅ ارتباطات Hall با وابستگی‌ها
// ================================================================

// Hall → HallPhysicalInfo
Hall.hasOne(HallPhysicalInfo, {
  foreignKey: "hall_id",
  onDelete: "CASCADE",
  hooks: true,
});
HallPhysicalInfo.belongsTo(Hall, {
  foreignKey: "hall_id",
});

// Hall → HallSystem
Hall.hasOne(HallSystem, {
  foreignKey: "hall_id",
  onDelete: "CASCADE",
  hooks: true,
});
HallSystem.belongsTo(Hall, {
  foreignKey: "hall_id",
});

// Hall → HallWaterFeed
Hall.hasOne(HallWaterFeed, {
  foreignKey: "hall_id",
  onDelete: "CASCADE",
  hooks: true,
});
HallWaterFeed.belongsTo(Hall, {
  foreignKey: "hall_id",
});

// Hall → HallHygiene
Hall.hasMany(HallHygiene, {
  foreignKey: "hall_id",
  onDelete: "CASCADE",
  hooks: true,
});
HallHygiene.belongsTo(Hall, {
  foreignKey: "hall_id",
});

// Hall → ChickPlacement
Hall.hasMany(ChickPlacement, {
  foreignKey: "hall_id",
  onDelete: "CASCADE",
  hooks: true,
});
ChickPlacement.belongsTo(Hall, {
  foreignKey: "hall_id",
});

// ================================================================
// ✅ ارتباطات ChickPlacement با وابستگی‌ها
// ================================================================

// ChickPlacement → WeeklyManagement
ChickPlacement.hasMany(WeeklyManagement, {
  foreignKey: "chick_placement_id",
  as: "weeklyManagements",
  onDelete: "CASCADE",
  hooks: true,
});
WeeklyManagement.belongsTo(ChickPlacement, {
  foreignKey: "chick_placement_id",
  as: "flock",
});

// ChickPlacement → FlockCompletion
ChickPlacement.hasOne(FlockCompletion, {
  foreignKey: "chick_placement_id",
  as: "flockCompletion",
  onDelete: "CASCADE",
  hooks: true,
});
FlockCompletion.belongsTo(ChickPlacement, {
  foreignKey: "chick_placement_id",
  as: "flock",
});

// ChickPlacement → Bookmark
ChickPlacement.hasMany(Bookmark, {
  foreignKey: "flock_id",
  as: "bookmarks",
  onDelete: "CASCADE",
  hooks: true,
});
Bookmark.belongsTo(ChickPlacement, {
  foreignKey: "flock_id",
  as: "flock",
});

// ================================================================
// ✅ ارتباطات WeeklyManagement با وابستگی‌ها
// ================================================================

WeeklyManagement.hasMany(WeeklyDisease, {
  foreignKey: "weekly_management_id",
  as: "WeeklyDiseases",
  onDelete: "CASCADE",
  hooks: true,
});
WeeklyDisease.belongsTo(WeeklyManagement, {
  foreignKey: "weekly_management_id",
  as: "weeklyManagement",
});

WeeklyManagement.hasMany(WeeklyVaccine, {
  foreignKey: "weekly_management_id",
  as: "WeeklyVaccines",
  onDelete: "CASCADE",
  hooks: true,
});
WeeklyVaccine.belongsTo(WeeklyManagement, {
  foreignKey: "weekly_management_id",
  as: "weeklyManagement",
});

WeeklyManagement.hasMany(WeeklyMedicine, {
  foreignKey: "weekly_management_id",
  as: "WeeklyMedicines",
  onDelete: "CASCADE",
  hooks: true,
});
WeeklyMedicine.belongsTo(WeeklyManagement, {
  foreignKey: "weekly_management_id",
  as: "weeklyManagement",
});

WeeklyManagement.hasMany(WeeklyFeed, {
  foreignKey: "weekly_management_id",
  as: "WeeklyFeeds",
  onDelete: "CASCADE",
  hooks: true,
});
WeeklyFeed.belongsTo(WeeklyManagement, {
  foreignKey: "weekly_management_id",
  as: "weeklyManagement",
});

WeeklyManagement.hasMany(WeeklySuggestion, {
  foreignKey: "weekly_management_id",
  as: "WeeklySuggestions",
  onDelete: "CASCADE",
  hooks: true,
});
WeeklySuggestion.belongsTo(WeeklyManagement, {
  foreignKey: "weekly_management_id",
  as: "weeklyManagement",
});

// ================================================================
// ✅ ارتباطات VisitReport با وابستگی‌ها
// ================================================================

VisitReport.hasMany(VisitReportHall, {
  foreignKey: "visit_report_id",
  onDelete: "CASCADE",
  hooks: true,
});
VisitReportHall.belongsTo(VisitReport, {
  foreignKey: "visit_report_id",
});

VisitReport.hasMany(VisitReportExpert, {
  foreignKey: "visit_report_id",
  onDelete: "CASCADE",
  hooks: true,
});
VisitReportExpert.belongsTo(VisitReport, {
  foreignKey: "visit_report_id",
});

VisitReport.hasMany(VisitReportAttachment, {
  foreignKey: "visit_report_id",
  as: "attachments",
  onDelete: "CASCADE",
  hooks: true,
});
VisitReportAttachment.belongsTo(VisitReport, {
  foreignKey: "visit_report_id",
});

// ================================================================
// ✅ ارتباطات Many-to-Many
// ================================================================

VisitReport.belongsToMany(Hall, {
  through: VisitReportHall,
  foreignKey: "visit_report_id",
  otherKey: "hall_id",
});
Hall.belongsToMany(VisitReport, {
  through: VisitReportHall,
  foreignKey: "hall_id",
  otherKey: "visit_report_id",
});

VisitReport.belongsToMany(User, {
  through: VisitReportExpert,
  as: "experts",
  foreignKey: "visit_report_id",
  otherKey: "expert_id",
});
User.belongsToMany(VisitReport, {
  through: VisitReportExpert,
  foreignKey: "expert_id",
  otherKey: "visit_report_id",
});

// ================================================================
// ✅ ارتباطات ChickPlacement با دیکشنری‌ها
// ================================================================

ChickPlacement.belongsTo(ChickenBreed, {
  foreignKey: "breed_id",
  as: "breed",
});
ChickenBreed.hasMany(ChickPlacement, {
  foreignKey: "breed_id",
  as: "chickPlacements",
});

ChickPlacement.belongsTo(ChickSource, {
  foreignKey: "chick_source_id",
  as: "chickSource",
});
ChickSource.hasMany(ChickPlacement, {
  foreignKey: "chick_source_id",
  as: "chickPlacements",
});

// ================================================================
// ✅ ارتباطات WeeklyManagement با دیکشنری‌ها
// ================================================================

Disease.hasMany(WeeklyDisease, {
  foreignKey: "disease_id",
  as: "weeklyDiseases",
});
WeeklyDisease.belongsTo(Disease, {
  foreignKey: "disease_id",
  as: "disease",
});

Vaccine.hasMany(WeeklyVaccine, {
  foreignKey: "vaccine_id",
  as: "weeklyVaccines",
});
WeeklyVaccine.belongsTo(Vaccine, {
  foreignKey: "vaccine_id",
  as: "vaccine",
});

Medicine.hasMany(WeeklyMedicine, {
  foreignKey: "medicine_id",
  as: "weeklyMedicines",
});
WeeklyMedicine.belongsTo(Medicine, {
  foreignKey: "medicine_id",
  as: "medicine",
});

FeedType.hasMany(WeeklyFeed, {
  foreignKey: "feed_type_id",
  as: "weeklyFeeds",
});
WeeklyFeed.belongsTo(FeedType, {
  foreignKey: "feed_type_id",
  as: "feedType",
});

SuggestionType.hasMany(WeeklySuggestion, {
  foreignKey: "suggestion_id",
  as: "weeklySuggestions",
});
WeeklySuggestion.belongsTo(SuggestionType, {
  foreignKey: "suggestion_id",
  as: "suggestionType",
});

// ================================================================
// ✅ ارتباطات WeeklyManagement با User (کارشناس)
// ================================================================

WeeklyManagement.belongsTo(User, {
  foreignKey: "service_expert_id",
  as: "service_expert",
});
User.hasMany(WeeklyManagement, {
  foreignKey: "service_expert_id",
  as: "weekly_managements",
});

// ================================================================
// ✅ ارتباطات Bookmark
// ================================================================

Bookmark.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});
User.hasMany(Bookmark, {
  foreignKey: "created_by",
  as: "created_bookmarks",
});

Bookmark.belongsTo(User, {
  foreignKey: "assigned_to",
  as: "assignee",
});
User.hasMany(Bookmark, {
  foreignKey: "assigned_to",
  as: "assigned_bookmarks",
});

Bookmark.belongsTo(Period, {
  foreignKey: "period_id",
  as: "period",
});
Period.hasMany(Bookmark, {
  foreignKey: "period_id",
  as: "bookmarks",
});

// ================================================================
// ✅ ارتباطات SmsLog
// ================================================================

SmsLog.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
  as: "customer",
});
CustomerPersonalInfo.hasMany(SmsLog, {
  foreignKey: "customer_id",
  as: "sms_logs",
});

SmsLog.belongsTo(User, {
  foreignKey: "sent_by",
  as: "sender",
});
User.hasMany(SmsLog, {
  foreignKey: "sent_by",
  as: "sent_sms_logs",
});

// ================================================================
// ✅ ارتباطات VisitReport با User (ثبت‌کننده)
// ================================================================

VisitReport.belongsTo(User, {
  foreignKey: "created_by",
  as: "CreatedBy",
});
User.hasMany(VisitReport, {
  foreignKey: "created_by",
});

console.log(
  "✅ همه ارتباطات (Associations) با CASCADE با موفقیت بارگذاری شدند",
);
