export function getElement(selector) {
  return document.querySelector(selector);
}

export function getElements(selector) {
  return document.querySelectorAll(selector);
}

export function createElement(tag, className = "", innerHTML = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}

export function addClass(element, className) {
  if (!element) return;
  if (Array.isArray(element)) {
    element.forEach((el) => el.classList.add(className));
  } else {
    element.classList.add(className);
  }
}

export function removeClass(element, className) {
  if (!element) return;
  if (Array.isArray(element)) {
    element.forEach((el) => el.classList.remove(className));
  } else {
    element.classList.remove(className);
  }
}

export function toggleClass(element, className) {
  if (!element) return;
  if (Array.isArray(element)) {
    element.forEach((el) => el.classList.toggle(className));
  } else {
    element.classList.toggle(className);
  }
}

export function hasClass(element, className) {
  if (!element) return false;
  return element.classList.contains(className);
}

export function showElement(element) {
  if (!element) return;
  if (Array.isArray(element)) {
    element.forEach((el) => (el.style.display = ""));
  } else {
    element.style.display = "";
  }
}

export function hideElement(element) {
  if (!element) return;
  if (Array.isArray(element)) {
    element.forEach((el) => (el.style.display = "none"));
  } else {
    element.style.display = "none";
  }
}

export function setText(element, text) {
  if (!element) return;
  element.textContent = text;
}

export function setHtml(element, html) {
  if (!element) return;
  element.innerHTML = html;
}

export function appendChild(parent, child) {
  if (!parent) return;
  parent.appendChild(child);
}

export function removeChild(parent, child) {
  if (!parent || !child) return;
  parent.removeChild(child);
}

export function getData(element, key) {
  if (!element) return null;
  return element.dataset[key];
}

export function setData(element, key, value) {
  if (!element) return;
  element.dataset[key] = value;
}

export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit = 300) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function scrollToElement(element, offset = 0) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  window.scrollTo({
    top: rect.top + scrollTop - offset,
    behavior: "smooth",
  });
}
