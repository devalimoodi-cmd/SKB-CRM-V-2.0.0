export const hatcheryFormService = {
  // ===== ریست فرم دوره =====

  resetPeriodForm() {
    document.getElementById("chickPeriodName").value = "";
    document.getElementById("chickStartDate").value = "";

    const saveBtn = document.querySelector("#chickPeriodInfoTab .btn-primary");
    if (saveBtn) {
      saveBtn.textContent = "شروع دوره جدید";
    }
  },

  // ===== ریست فرم جوجه‌ریزی =====

  resetFlockForm() {
    document.getElementById("skb-hall-select").value = "";
    document.getElementById("skb-period-select").value = "";
    document.getElementById("skb-chick-date").value = "";
    document.getElementById("skb-chick-source").value = "";
    document.getElementById("skb-chick-breed").value = "";
    document.getElementById("skb-chick-age").value = "";
    document.getElementById("skb-initial-weight").value = "";
    document.getElementById("skb-total-load").value = "";
    document.getElementById("skb-chick-count").value = "";
    document.getElementById("skb-current-density").value = "";

    const saveBtn = document.querySelector("#chickRegisterTab .btn-primary");
    if (saveBtn) {
      saveBtn.textContent = "ذخیره گله جدید";
    }
  },

  // ===== ریست فرم بهداشت =====

  resetHygieneForm() {
    document.getElementById("chickLastWashDate").value = "";
    document.getElementById("chickLastDisinfectDate").value = "";
    document.getElementById("chickDisinfectMaterial").value = "";
    document.getElementById("chickHygieneDescription").value = "";

    const saveBtn = document.querySelector("#chickHygieneInfoTab .btn-primary");
    if (saveBtn) {
      saveBtn.textContent = "ذخیره اطلاعات بهداشتی";
    }
  },

  // ===== پر کردن فرم ویرایش =====

  fillPeriodForm(period) {
    document.getElementById("chickPeriodId").value =
      period.period_number || period.id;
    document.getElementById("chickPeriodName").value = period.period_name;
    document.getElementById("chickStartDate").value = this.convertToPersianDate(
      period.start_date,
    );
    document.getElementById("chickPeriodStatus").value = period.status;
  },

  fillFlockForm(flock) {
    document.getElementById("skb-hall-select").value = flock.hall_id;
    document.getElementById("skb-period-select").value = flock.period_id;
    document.getElementById("skb-flock-number").value = flock.flock_number;
    document.getElementById("skb-chick-source").value =
      flock.chick_source_id || "";
    document.getElementById("skb-chick-breed").value = flock.breed_id || "";
    document.getElementById("skb-chick-age").value =
      flock.chick_age_on_arrival || 1;
    document.getElementById("skb-initial-weight").value =
      flock.avg_initial_weight || "";
    document.getElementById("skb-chick-count").value =
      flock.total_chicks_count || "";
    document.getElementById("skb-chick-date").value = this.convertToPersianDate(
      flock.placement_date,
    );
  },

  // ===== تبدیل تاریخ =====

  convertToPersianDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    } catch {
      return "";
    }
  },
};
