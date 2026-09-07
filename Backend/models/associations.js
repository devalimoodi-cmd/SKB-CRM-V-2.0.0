// ======================= import models data base =============
const CustomerPersonalInfo = require("./CustomerPersonalInfo");
const Unit = require("./Unit");
const UnitStatus = require("./UnitStatus");
const UnitExpert = require("./UnitExpert");
const Hall = require("./Hall");
const HallPhysicalInfo = require("./HallPhysicalInfo");
const HallSystem = require("./HallSystem");
const HallSystemItem = require("./HallSystemItem");
const HallWaterFeed = require("./HallWaterFeed");
const HallHygiene = require("./HallHygiene");
const ChickPlacement = require("./ChickPlacement");
const CropTest = require("./CropTest");
const WeeklyManagement = require("./WeeklyManagement");
const WeeklyDisease = require("./WeeklyDisease");
const WeeklyVaccine = require("./WeeklyVaccine");
const WeeklyMedicine = require("./WeeklyMedicine");
const WeeklyFeed = require("./WeeklyFeed");
const WeeklySuggestion = require("./WeeklySuggestion");
const FlockCompletion = require("./FlockCompletion");
const FlockCompletionHall = require("./FlockCompletionHall");
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
const BreedWeightStandard = require("./BreedWeightStandard");
const Flock = require("./Flock");

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

// ===== CustomerPersonalInfo → Unit =====
CustomerPersonalInfo.hasMany(Unit, {
  foreignKey: "customer_personal_information_id",
  as: "units",
  onDelete: "CASCADE",
  hooks: true,
});
Unit.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_personal_information_id",
  as: "customer",
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
// ✅ ارتباطات Unit با وابستگی‌ها
// ================================================================

// Unit → UnitStatus
Unit.belongsTo(UnitStatus, {
  foreignKey: "unit_status_id",
  as: "status",
});
UnitStatus.hasMany(Unit, {
  foreignKey: "unit_status_id",
  as: "units",
});

// Unit → UnitExpert
Unit.hasMany(UnitExpert, {
  foreignKey: "unit_id",
  as: "experts",
  onDelete: "CASCADE",
  hooks: true,
});
UnitExpert.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → Hall
Unit.hasMany(Hall, {
  foreignKey: "unit_id",
  as: "halls",
  onDelete: "CASCADE",
  hooks: true,
});
Hall.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → ChickPlacement
Unit.hasMany(ChickPlacement, {
  foreignKey: "unit_id",
  onDelete: "CASCADE",
  hooks: true,
});
ChickPlacement.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → VisitReport
Unit.hasMany(VisitReport, {
  foreignKey: "unit_id",
  onDelete: "CASCADE",
  hooks: true,
});
VisitReport.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → Bookmark
Unit.hasMany(Bookmark, {
  foreignKey: "unit_id",
  as: "unitBookmarks",
  onDelete: "CASCADE",
  hooks: true,
});
Bookmark.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → HallPhysicalInfo
Unit.hasMany(HallPhysicalInfo, {
  foreignKey: "unit_id",
  as: "hallPhysicalInfos",
  onDelete: "CASCADE",
  hooks: true,
});
HallPhysicalInfo.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → HallSystem
Unit.hasMany(HallSystem, {
  foreignKey: "unit_id",
  as: "hallSystems",
  onDelete: "CASCADE",
  hooks: true,
});
HallSystem.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → HallWaterFeed
Unit.hasMany(HallWaterFeed, {
  foreignKey: "unit_id",
  as: "hallWaterFeeds",
  onDelete: "CASCADE",
  hooks: true,
});
HallWaterFeed.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → HallHygiene
Unit.hasMany(HallHygiene, {
  foreignKey: "unit_id",
  onDelete: "CASCADE",
  hooks: true,
});
HallHygiene.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Unit → CropTest
Unit.hasMany(CropTest, {
  foreignKey: "unit_id",
  onDelete: "CASCADE",
  hooks: true,
});
CropTest.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// Hall → CropTest
Hall.hasMany(CropTest, {
  foreignKey: "hall_id",
  onDelete: "CASCADE",
  hooks: true,
});
CropTest.belongsTo(Hall, {
  foreignKey: "hall_id",
});

// ChickPlacement → CropTest
ChickPlacement.hasMany(CropTest, {
  foreignKey: "chick_placement_id",
  as: "cropTests",
  onDelete: "CASCADE",
  hooks: true,
});
CropTest.belongsTo(ChickPlacement, {
  foreignKey: "chick_placement_id",
  as: "flock",
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

// HallSystem → HallSystemItem (جزئیات چندنوعی گرمایش/سرمایش/فن)
HallSystem.hasMany(HallSystemItem, {
  foreignKey: "system_id",
  onDelete: "CASCADE",
  hooks: true,
});
HallSystemItem.belongsTo(HallSystem, {
  foreignKey: "system_id",
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
// ✅ ارتباطات BreedWeightStandard (استاندارد وزنی نژاد)
// ================================================================

ChickenBreed.hasMany(BreedWeightStandard, {
  foreignKey: "breed_id",
  as: "weightStandards",
  onDelete: "CASCADE",
  hooks: true,
});
BreedWeightStandard.belongsTo(ChickenBreed, {
  foreignKey: "breed_id",
  as: "breed",
});

BreedWeightStandard.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});
BreedWeightStandard.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater",
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

// ================================================================
// ✅ ارتباطات «گله» (Flock / دوره پرورش) — سطح واحد مرغداری
// ================================================================

// ===== مشتری → گله =====
CustomerPersonalInfo.hasMany(Flock, {
  foreignKey: "customer_id",
  as: "flocks",
  onDelete: "CASCADE",
  hooks: true,
});
Flock.belongsTo(CustomerPersonalInfo, {
  foreignKey: "customer_id",
  as: "customer",
});

// ===== واحد → گله =====
Unit.hasMany(Flock, {
  foreignKey: "unit_id",
  as: "flocks",
  onDelete: "CASCADE",
  hooks: true,
});
Flock.belongsTo(Unit, {
  foreignKey: "unit_id",
  as: "unit",
});

// ===== گله → جوجه‌ریزی سالن‌ها (ChickPlacement) =====
Flock.hasMany(ChickPlacement, {
  foreignKey: "flock_id",
  as: "placements",
  onDelete: "CASCADE",
  hooks: true,
});
ChickPlacement.belongsTo(Flock, {
  foreignKey: "flock_id",
  as: "flock",
});

// ===== گله → پایان دوره =====
Flock.hasMany(FlockCompletion, {
  foreignKey: "flock_id",
  as: "completions",
});
// بدون alias (پیش‌فرض) — alias «flock» قبلاً برای ChickPlacement ثبت شده
FlockCompletion.belongsTo(Flock, {
  foreignKey: "flock_id",
});

// ================================================================
// ✅ ارتباطات «ریز پایان دوره per سالن» (FlockCompletionHall)
// ================================================================

FlockCompletion.hasMany(FlockCompletionHall, {
  foreignKey: "flock_completion_id",
  as: "hallDetails",
  onDelete: "CASCADE",
  hooks: true,
});
FlockCompletionHall.belongsTo(FlockCompletion, {
  foreignKey: "flock_completion_id",
  as: "completion",
});

FlockCompletionHall.belongsTo(ChickPlacement, {
  foreignKey: "chick_placement_id",
  as: "placement",
});
FlockCompletionHall.belongsTo(Hall, {
  foreignKey: "hall_id",
  as: "hall",
});

FlockCompletionHall.belongsTo(Flock, {
  foreignKey: "flock_id",
});
Flock.hasMany(FlockCompletionHall, {
  foreignKey: "flock_id",
  as: "completionHallDetails",
});

// ================================================================
// ✅ بوکمارک روی گله/دوره + سالن اختیاری
// ================================================================
Bookmark.belongsTo(Flock, {
  foreignKey: "flock_period_id",
  as: "flockPeriod",
});
Bookmark.belongsTo(ChickPlacement, {
  foreignKey: "hall_id",
  as: "hallPlacement",
});
