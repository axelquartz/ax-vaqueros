// Se carga ANTES que react-dom: jsdom no implementa AnimationEvent y, sin él,
// React escucha "webkitAnimationEnd" en vez de "animationend".
if (typeof window !== 'undefined' && !('AnimationEvent' in window)) {
  // @ts-expect-error polyfill mínimo para pruebas
  window.AnimationEvent = class AnimationEvent extends Event {}
}
