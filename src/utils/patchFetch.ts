// Patch window.fetch setter to prevent "Cannot set property fetch of #<Window> which has only a getter"
(function () {
  try {
    if (typeof window !== 'undefined' && window.fetch) {
      const origFetch = window.fetch;
      const desc =
        Object.getOwnPropertyDescriptor(window, 'fetch') ||
        (window.Window && Object.getOwnPropertyDescriptor(window.Window.prototype, 'fetch'));
      if (desc && desc.configurable && (!desc.set || !desc.writable)) {
        let _currentFetch = origFetch;
        Object.defineProperty(window, 'fetch', {
          get: function () {
            return _currentFetch;
          },
          set: function (v) {
            _currentFetch = v;
          },
          configurable: true,
          enumerable: true,
        });
      }
    }
  } catch (e) {
    console.warn('fetch setter polyfill warning:', e);
  }
})();

export {};
