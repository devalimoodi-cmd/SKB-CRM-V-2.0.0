class StateService {
  constructor() {
    this._state = {
      customerId: null,
      customerData: null,
      periods: [],
      halls: [],
      flocks: [],
      dictionaries: {},
      activeTab: null,
      isLoaded: {},
      bookmarks: [],
      users: [],
    };
    this._listeners = {};
    this._persistedKeys = ["customerId", "activeTab"];
  }

  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;

    // ذخیره در localStorage برای کلیدهای مشخص
    if (this._persistedKeys.includes(key)) {
      try {
        localStorage.setItem(`state_${key}`, JSON.stringify(value));
      } catch (e) {}
    }

    // اطلاع به listenerها
    if (this._listeners[key]) {
      this._listeners[key].forEach((cb) => {
        try {
          cb(value, oldValue);
        } catch (e) {
          console.warn(`⚠️ Error in listener ${key}:`, e);
        }
      });
    }
  }

  get(key) {
    // اگر مقدار در state نبود، از localStorage بازیابی کن
    if (this._state[key] === undefined && this._persistedKeys.includes(key)) {
      try {
        const stored = localStorage.getItem(`state_${key}`);
        if (stored) {
          this._state[key] = JSON.parse(stored);
        }
      } catch (e) {}
    }
    return this._state[key];
  }

  watch(key, callback) {
    if (!this._listeners[key]) {
      this._listeners[key] = [];
    }
    this._listeners[key].push(callback);

    // برگرداندن تابع لغو اشتراک
    return () => {
      this._listeners[key] = this._listeners[key].filter(
        (cb) => cb !== callback,
      );
    };
  }

  syncCustomerId() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (id && id !== this._state.customerId) {
      this.set("customerId", id);
      window.CURRENT_CUSTOMER_ID = id;
    }
    return this._state.customerId;
  }

  markLoaded(section) {
    this._state.isLoaded[section] = true;
  }

  isSectionLoaded(section) {
    return !!this._state.isLoaded[section];
  }

  resetLoaded(section) {
    if (section) {
      this._state.isLoaded[section] = false;
    } else {
      this._state.isLoaded = {};
    }
  }

  reset() {
    Object.keys(this._state).forEach((key) => {
      if (!this._persistedKeys.includes(key)) {
        this._state[key] = null;
      }
    });
    this._state.isLoaded = {};
  }

  // ===== متدهای خاص =====
  getCustomerId() {
    return this.get("customerId") || this.syncCustomerId();
  }

  setCustomerId(id) {
    this.set("customerId", id);
    window.CURRENT_CUSTOMER_ID = id;
  }

  getCustomerData() {
    return this.get("customerData");
  }

  setCustomerData(data) {
    this.set("customerData", data);
  }

  getPeriods() {
    return this.get("periods") || [];
  }

  setPeriods(periods) {
    this.set("periods", periods || []);
  }

  getHalls() {
    return this.get("halls") || [];
  }

  setHalls(halls) {
    this.set("halls", halls || []);
  }

  getFlocks() {
    return this.get("flocks") || [];
  }

  setFlocks(flocks) {
    this.set("flocks", flocks || []);
  }

  getBookmarks() {
    return this.get("bookmarks") || [];
  }

  setBookmarks(bookmarks) {
    this.set("bookmarks", bookmarks || []);
  }

  getDictionary(endpoint) {
    const dicts = this.get("dictionaries") || {};
    return dicts[endpoint] || null;
  }

  setDictionary(endpoint, data) {
    const dicts = this.get("dictionaries") || {};
    dicts[endpoint] = data;
    this.set("dictionaries", dicts);
  }

  getActiveTab() {
    return this.get("activeTab");
  }

  setActiveTab(tab) {
    this.set("activeTab", tab);
  }
}

export const stateService = new StateService();

// ===== قرار دادن در window =====
if (typeof window !== "undefined") {
  window.stateService = stateService;
  window.StateService = StateService;
  // اطمینان از وجود CURRENT_CUSTOMER_ID
  if (!window.CURRENT_CUSTOMER_ID) {
    const urlParams = new URLSearchParams(window.location.search);
    window.CURRENT_CUSTOMER_ID = urlParams.get("id") || null;
  }
}
