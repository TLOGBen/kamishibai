/*
 * Kami slides playback (SPEC §7.4, CONTRACT C5).
 *
 * A template-layer asset, not a raw island: it ships with the template and is
 * inlined by the render layer, which is what lets SPEC §11 ban script elements
 * *inside islands* — interaction is a component concern, never hand-written
 * escape-hatch markup.
 *
 * Deliberately ES5-shaped and dependency-free: it is embedded verbatim into one
 * offline file, so it must parse in any evergreen browser without a build step.
 * Comparison operators mean `<` does appear below; what must never appear is the
 * `</` or `<!--` that would close or escape its own element early. Without JS
 * every slide simply stays visible and the deck reads as a scrolling document.
 */
(function () {
  var deck = document.querySelector('.deck')
  if (!deck) return
  var slides = Array.prototype.slice.call(deck.querySelectorAll('.slide'))
  if (slides.length === 0) return

  var progress = deck.querySelector('.deck-progress')
  var index = 0

  function show(next) {
    index = Math.max(0, Math.min(slides.length - 1, next))
    for (var i = 0; i < slides.length; i += 1) {
      var current = i === index
      slides[i].classList.toggle('is-current', current)
      slides[i].setAttribute('aria-hidden', current ? 'false' : 'true')
    }
    if (progress) progress.textContent = index + 1 + ' / ' + slides.length
  }

  function enterFullscreen() {
    var target = document.documentElement
    if (document.fullscreenElement) return
    if (target.requestFullscreen) target.requestFullscreen()
  }

  function exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen()
  }

  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    var key = event.key
    if (key === 'ArrowRight' || key === ' ' || key === 'Spacebar' || key === 'PageDown') {
      event.preventDefault()
      show(index + 1)
    } else if (key === 'ArrowLeft' || key === 'PageUp') {
      event.preventDefault()
      show(index - 1)
    } else if (key === 'f' || key === 'F') {
      event.preventDefault()
      enterFullscreen()
    } else if (key === 'Escape' || key === 'Esc') {
      exitFullscreen()
    }
  })

  deck.classList.add('is-live')
  show(0)
})()
