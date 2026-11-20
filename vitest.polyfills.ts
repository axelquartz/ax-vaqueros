// Se carga ANTES que react-dom: jsdom no implementa AnimationEvent y, sin él,
// React escucha "webkitAnimationEnd" en vez de "animationend".
if (typeof window !== 'undefined' && !('AnimationEvent' in window)) {
  // @ts-expect-error polyfill mínimo para pruebas
  window.AnimationEvent = class AnimationEvent extends Event {}
}

// jsdom tampoco implementa matchMedia
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}

// Node 25 expone un localStorage global propio (sin --localstorage-file queda
// incompleto) que tapa al de jsdom. Usamos uno en memoria, igual a la Web Storage API.
if (typeof globalThis.localStorage?.clear !== 'function') {
  class MemoryStorage implements Storage {
    private map = new Map<string, string>()
    get length() { return this.map.size }
    clear() { this.map.clear() }
    getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null }
    key(i: number) { return [...this.map.keys()][i] ?? null }
    removeItem(k: string) { this.map.delete(k) }
    setItem(k: string, v: string) { this.map.set(k, String(v)) }
  }
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  if (typeof window !== 'undefined') Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
}
