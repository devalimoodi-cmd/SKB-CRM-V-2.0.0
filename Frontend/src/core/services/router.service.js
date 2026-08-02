class RouterService {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    this.container = document.getElementById("main-content");
    this.init();
  }

  init() {
    window.addEventListener("popstate", () => {
      this.handleRoute(window.location.pathname);
    });
  }

  addRoute(path, component, options = {}) {
    this.routes.push({
      path,
      component,
      options,
      regex: new RegExp(`^${path.replace(/:\w+/g, "([^/]+)")}$`),
    });
  }

  navigate(path) {
    window.history.pushState({}, "", path);
    this.handleRoute(path);
  }

  async handleRoute(path) {
    const route = this.findRoute(path);
    if (!route) {
      this.navigateTo404();
      return;
    }

    this.currentRoute = route;
    const params = this.extractParams(route, path);

    try {
      // بارگذاری کامپوننت
      await route.component(params);
    } catch (error) {
      console.error("❌ Route error:", error);
      this.navigateTo404();
    }
  }

  findRoute(path) {
    return this.routes.find((route) => route.regex.test(path));
  }

  extractParams(route, path) {
    const match = path.match(route.regex);
    if (!match) return {};

    const keys = (route.path.match(/:(\w+)/g) || []).map((k) => k.slice(1));
    const params = {};
    keys.forEach((key, index) => {
      params[key] = match[index + 1];
    });
    return params;
  }

  navigateTo404() {
    if (this.container) {
      this.container.innerHTML = `
                <div class="error-page" style="text-align: center; padding: 60px 20px;">
                    <div class="error-code" style="font-size: 80px; font-weight: bold; color: #667eea;">۴۰۴</div>
                    <h2 style="color: #333; margin: 20px 0;">⛔ صفحه یافت نشد</h2>
                    <p style="color: #666; margin-bottom: 30px;">متأسفیم، صفحه‌ای که به دنبال آن هستید وجود ندارد.</p>
                    <a href="/" class="btn-home" style="background: #667eea; color: white; padding: 12px 30px; border-radius: 10px; text-decoration: none; display: inline-block;">بازگشت به صفحه اصلی</a>
                </div>
            `;
    }
  }

  getCurrentPath() {
    return window.location.pathname;
  }

  getParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = {};
    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }
    return params;
  }
}

export const routerService = new RouterService();
