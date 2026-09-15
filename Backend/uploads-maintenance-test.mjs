// ============================================================
//  تست نگهداری فایل‌ها و بکاپ (uploads maintenance / backup copy)
// ------------------------------------------------------------
//  این تست کاملاً «ایزوله» است: در پوشهٔ موقت (%TEMP%) کار می‌کند و
//  به پوشهٔ واقعی uploads/backups دست نمی‌زند.
//  هدف:
//   ۱) گزارش uploads (حالت JSON) درست کار کند
//   ۲) تشخیص «فایل یتیم» بر اساس ارجاع‌های واقعی دیتابیس درست باشد
//   ۳) حالت پیش‌فرض (dry-run) هیچ فایلی حذف نکند
//   ۴) --delete فقط فایل‌های یتیم را حذف کند و پوشهٔ خالی را پاک کند
//   ۵) کپی بکاپ روی مسیر دوم + صحت‌سنجی کپی + پاکسازی فقط پوشه‌های بکاپ
//  اجرا:  $env:ALLOW_DB_TESTS='true'; npm run test:uploads-maint
// ============================================================
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (s) => console.log(s);

const BACKEND_DIR = import.meta.dirname;
const ASK_DB = process.env.ALLOW_DB_TESTS === "true";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skb-uploads-maint-"));
const tmpUploads = path.join(tmpRoot, "uploads");
const tmpBackupDir = path.join(tmpRoot, "backups");
const tmpCopyDir = path.join(tmpRoot, "copies");

// ===== ساخت فایل‌های تست =====
const nestedDir = path.join(
  tmpUploads,
  "visit_reports",
  "customer_9999",
  "2025-01-01",
);
fs.mkdirSync(nestedDir, { recursive: true });
fs.mkdirSync(path.join(tmpUploads, "profile_images"), { recursive: true });

const orphanOld = path.join(nestedDir, "orphan-old-test.txt");
const orphanNew = path.join(tmpUploads, "orphan-new-test.txt");
const profileOrphan = path.join(
  tmpUploads,
  "profile_images",
  "profile_orphan_test.txt",
);

fs.writeFileSync(orphanOld, "orphan old file (test)");
fs.writeFileSync(orphanNew, "orphan new file (test)");
fs.writeFileSync(profileOrphan, "orphan profile file (test)");

// فایل «قدیمی»: ۴۸ ساعت قبل
const oldSeconds = (Date.now() - 48 * 60 * 60 * 1000) / 1000;
fs.utimesSync(orphanOld, oldSeconds, oldSeconds);

// ===== اجرای اسکریپت‌ها =====
const runScript = (scriptName, scriptArgs = [], extraEnv = {}) =>
  spawnSync(
    process.execPath,
    [path.join(BACKEND_DIR, "scripts", scriptName), ...scriptArgs],
    {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...extraEnv },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );

const runClean = (scriptArgs, extraEnv) =>
  runScript("clean-orphan-uploads.js", scriptArgs, {
    UPLOADS_DIR: tmpUploads,
    UPLOADS_REPORT_DIR: path.join(tmpRoot, "reports"),
    ...extraEnv,
  });

const runReport = (scriptArgs, extraEnv) =>
  runScript("uploads-report.js", scriptArgs, {
    UPLOADS_DIR: tmpUploads,
    ...extraEnv,
  });

const parseJson = (stdout) => {
  try {
    return JSON.parse(String(stdout || "").trim());
  } catch {
    return null;
  }
};

const fileExists = (p) => fs.existsSync(p);

const run = async () => {
  // ===== ۱) گزارش JSON (بدون دیتابیس) =====
  const reportRun = runReport(["--json", "--no-db"]);
  const reportJson = parseJson(reportRun.stdout);
  check(
    "گزارش uploads در حالت JSON اجرا می‌شود",
    reportRun.status === 0 && !!reportJson,
    `status=${reportRun.status}`,
  );
  check(
    "گزارش: تعداد فایل‌های پوشهٔ آزمایشی درست است",
    reportJson?.totalFiles === 3,
    `totalFiles=${reportJson?.totalFiles}`,
  );
  check(
    "گزارش: حجم کل محاسبه شده است",
    (reportJson?.totalSize || 0) > 0,
    `size=${reportJson?.totalSizeHuman}`,
  );
  check(
    "گزارش: تفکیک پوشه‌های سطح اول موجود است",
    Boolean(reportJson?.byFolder?.visit_reports) &&
      Boolean(reportJson?.byFolder?.profile_images),
    `folders=${Object.keys(reportJson?.byFolder || {}).join(",")}`,
  );

  // ===== ۲) ارجاع واقعی از دیتابیس (برای تشخیص یتیم) =====
  let dbReachable = false;
  let referencedName = null;
  let sequelize = null;

  if (ASK_DB) {
    try {
      const db = require("./config/database.js");
      sequelize = db.sequelize;
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error("db timeout")), 8000),
      );
      await Promise.race([sequelize.authenticate(), timeout]);
      dbReachable = true;

      const [attachments] = await sequelize.query(
        "SELECT file_path FROM visit_report_attachments WHERE file_path IS NOT NULL LIMIT 1",
      );
      if (attachments?.[0]?.file_path) {
        referencedName = String(attachments[0].file_path)
          .replace(/\\/g, "/")
          .split("/")
          .pop();
      }
      if (!referencedName) {
        const [profiles] = await sequelize.query(
          "SELECT profile_image FROM users WHERE profile_image IS NOT NULL LIMIT 1",
        );
        if (profiles?.[0]?.profile_image) {
          referencedName = String(profiles[0].profile_image)
            .replace(/\\/g, "/")
            .split("/")
            .pop();
        }
      }
    } catch (error) {
      info(`⚠️ دیتابیس در دسترس نیست (${error.message}) → بخش‌های DB رد می‌شوند`);
    }
  } else {
    info("ℹ️ ALLOW_DB_TESTS=true نیست → فقط بخش‌های بدون دیتابیس اجرا می‌شوند");
  }

  // ✅ گزارش با دیتابیس: باید «ارجاع بدون فایل» را تشخیص دهد
  // (در پوشهٔ آزمایشی هنوز هیچ فایلی از دیتابیس وجود ندارد)
  if (dbReachable && referencedName) {
    const dbReportRun = runReport(["--json"]);
    const dbReport = parseJson(dbReportRun.stdout);
    check(
      "گزارش با دیتابیس اجرا می‌شود",
      dbReportRun.status === 0 && !!dbReport,
      `status=${dbReportRun.status}`,
    );
    check(
      "ارجاع دیتابیس بدون فایل روی دیسک تشخیص داده می‌شود",
      (dbReport?.missingFiles?.count || 0) >= 1,
      `missing=${dbReport?.missingFiles?.count}`,
    );
  }

  let referencedFile = null;
  if (referencedName) {
    referencedFile = path.join(tmpUploads, referencedName);
    fs.writeFileSync(referencedFile, "referenced file (test)");
    info(`🔎 نام ارجاع‌دار از دیتابیس: ${referencedName}`);
  } else {
    info("ℹ️ ارجاع واقعی پیدا نشد → حالت --no-db بررسی می‌شود");
  }

  // ✅ فایل «دارایی ثابت» برنامه (مثل avatar-01.jpg) — نباید یتیم حساب شود
  const avatarFile = path.join(tmpUploads, "avatar-01.jpg");
  fs.writeFileSync(avatarFile, "static avatar (test)");

  // ۳ فایل یتیم + (ارجاع‌دار) + آواتار
  const totalFiles = 3 + (referencedFile ? 1 : 0) + 1;
  const dbMode = referencedName ? [] : ["--no-db"];

  // ===== ۳) تشخیص فایل یتیم در حالت نمایش (dry-run) =====
  const dryRun = runClean(["--json", "--min-age-hours=0", ...dbMode]);
  const dry = parseJson(dryRun.stdout);
  check(
    "اسکریپت پاک‌سازی در حالت نمایش اجرا می‌شود",
    dryRun.status === 0 && !!dry,
    `status=${dryRun.status}`,
  );
  check("حالت پیش‌فرض: dryRun=true است", dry?.dryRun === true, `dryRun=${dry?.dryRun}`);
  check(
    "در حالت نمایش هیچ فایلی حذف نمی‌شود",
    fileExists(orphanOld) && fileExists(orphanNew) && fileExists(profileOrphan),
  );
  check(
    "همهٔ فایل‌های بررسی‌شده شمرده شده‌اند",
    dry?.scannedFiles === totalFiles,
    `scannedFiles=${dry?.scannedFiles}`,
  );
  if (referencedName) {
    check(
      "فایل دارای ارجاع در دیتابیس، یتیم تشخیص داده نمی‌شود",
      !(dry?.orphans || []).some((o) => o.relPath.endsWith(referencedName)),
      `orphans=${(dry?.orphans || []).length}`,
    );
    check(
      "فایل‌های بدون ارجاع یتیم تشخیص داده می‌شوند",
      dry?.orphanCount === 3,
      `orphanCount=${dry?.orphanCount}`,
    );
  } else {
    check(
      "در حالت --no-db همهٔ فایل‌ها یتیم در نظر گرفته می‌شوند",
      dry?.orphanCount === totalFiles - 1,
      `orphanCount=${dry?.orphanCount}`,
    );
  }
  check(
    "دارایی ثابت (avatar-01.jpg) یتیم تشخیص داده نمی‌شود",
    dry?.keptCount === 1 &&
      !(dry?.orphans || []).some((o) => o.relPath.endsWith("avatar-01.jpg")),
    `kept=${dry?.keptCount}`,
  );

  // ===== ۴) محافظ «سن فایل» (فایل‌های تازه دست‌نخورده می‌مانند) =====
  const agedRun = runClean(["--json", "--min-age-hours=24", "--no-db"]);
  const aged = parseJson(agedRun.stdout);
  check(
    "محافظ سن: فقط فایل قدیمی‌تر از ۲۴ ساعت انتخاب می‌شود",
    aged?.orphanCount === 1,
    `orphanCount=${aged?.orphanCount}`,
  );
  check(
    "محافظ سن: فایل‌های تازه نادیده گرفته می‌شوند",
    aged?.skippedRecentCount === totalFiles - 2,
    `skipped=${aged?.skippedRecentCount}`,
  );

  // ===== ۵) حذف واقعی =====
  const expectedDeleted = referencedName ? 3 : totalFiles - 1;
  const realRun = runClean([
    "--json",
    "--delete",
    "--min-age-hours=0",
    ...dbMode,
  ]);
  const del = parseJson(realRun.stdout);
  check(
    "حذف واقعی با موفقیت اجرا می‌شود",
    realRun.status === 0 && !!del,
    `status=${realRun.status}`,
  );
  check(
    `فقط فایل‌های یتیم حذف می‌شوند (${expectedDeleted} فایل)`,
    del?.deleted === expectedDeleted,
    `deleted=${del?.deleted}`,
  );
  check(
    "حجم آزادشده گزارش می‌شود",
    (del?.freedBytes || 0) > 0,
    `freed=${del?.freedHuman}`,
  );
  check(
    "فایل‌های یتیم از دیسک حذف شدند",
    !fileExists(orphanOld) && !fileExists(orphanNew) && !fileExists(profileOrphan),
  );
  if (referencedFile) {
    check(
      "فایل دارای ارجاع دیتابیس حذف نشد",
      fileExists(referencedFile),
    );
  }
  check(
    "دارایی ثابت (avatar-01.jpg) در حذف واقعی دست‌نخورده ماند",
    fileExists(avatarFile),
  );
  check(
    "پوشه‌های خالی باقی نماندند",
    !fileExists(nestedDir),
    `nestedExists=${fileExists(nestedDir)}`,
  );
  check(
    "فایل گزارش پاک‌سازی ساخته شد",
    Boolean(del?.reportFile) && fileExists(del.reportFile),
    String(del?.reportFile || ""),
  );

  // ===== ۶) بکاپ + کپی روی مسیر دوم =====
  if (!dbReachable) {
    info("⏭️  دیتابیس در دسترس نیست → تست بکاپ/کپی مسیر دوم رد شد");
  } else {
    const oldStamps = ["2000-01-01_00-00", "2001-01-01_00-00"];
    for (const name of oldStamps) {
      for (const root of [tmpBackupDir, tmpCopyDir]) {
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.writeFileSync(path.join(root, name, "old.txt"), "old backup");
      }
    }
    // پوشهٔ غیربکاپ (نباید هیچ‌وقت پاک شود)
    for (const root of [tmpBackupDir, tmpCopyDir]) {
      fs.mkdirSync(path.join(root, "keep-me"), { recursive: true });
      fs.writeFileSync(path.join(root, "keep-me", "important.txt"), "keep");
    }

    const backupRun = runScript("backup.js", [], {
      BACKUP_DIR: tmpBackupDir,
      BACKUP_COPY_TO: tmpCopyDir,
      BACKUP_KEEP: "2",
      UPLOADS_DIR: tmpUploads,
    });

    const backupLog = String(backupRun.stdout || "") + String(backupRun.stderr || "");
    check(
      "بکاپ (دیتابیس + فایل‌ها) با موفقیت اجرا می‌شود",
      backupRun.status === 0,
      `status=${backupRun.status} tail=${backupLog.trim().split("\n").slice(-2).join(" | ")}`,
    );

    const stampRe = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/;
    const stamps = fs
      .readdirSync(tmpBackupDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && stampRe.test(e.name))
      .map((e) => e.name)
      .sort();
    const newest = stamps[stamps.length - 1];

    check(
      "پوشهٔ بکاپ جدید ساخته شد",
      Boolean(newest) && stamps.length === 2,
      `stamps=${stamps.join(",")}`,
    );

    const srcDump = path.join(tmpBackupDir, newest || "", "db.dump");
    const dstDump = path.join(tmpCopyDir, newest || "", "db.dump");
    check(
      "db.dump در بکاپ محلی ساخته شد",
      fileExists(srcDump) && fs.statSync(srcDump).size > 0,
      `size=${fileExists(srcDump) ? fs.statSync(srcDump).size : "-"}`,
    );
    check(
      "کپی مسیر دوم ساخته و حجم آن با اصل برابر است",
      fileExists(dstDump) &&
        fileExists(srcDump) &&
        fs.statSync(dstDump).size === fs.statSync(srcDump).size,
      `dst=${fileExists(dstDump) ? fs.statSync(dstDump).size : "-"}`,
    );
    check(
      "info.json در کپی مسیر دوم هم موجود است",
      fileExists(path.join(tmpCopyDir, newest || "", "info.json")),
    );
    check(
      "بکاپ‌های قدیمی در هر دو مسیر پاک شدند (KEEP=2)",
      !fileExists(path.join(tmpBackupDir, "2000-01-01_00-00")) &&
        !fileExists(path.join(tmpCopyDir, "2000-01-01_00-00")),
    );
    check(
      "پوشهٔ غیربکاپ (keep-me) در هیچ مسیری حذف نشد",
      fileExists(path.join(tmpBackupDir, "keep-me", "important.txt")) &&
        fileExists(path.join(tmpCopyDir, "keep-me", "important.txt")),
    );
  }

  if (sequelize) {
    try {
      await sequelize.close();
    } catch {}
  }
};

run()
  .catch((e) => {
    console.error("❌ Test error:", e.message);
    results.push(false);
  })
  .finally(() => {
    const failed = results.filter((x) => !x).length;
    console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    process.exit(failed === 0 ? 0 : 1);
  });
