(() => {
  'use strict';
  const slides = Array.from(document.querySelectorAll('.slide'));
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const count = document.getElementById('count');
  let current = 0;
  function show(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
      slide.classList.toggle('active', i === current);
    });
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    count.textContent = `Slide ${current + 1} of ${slides.length}`;
    // Warm only the immediate next image; the rest remain lazy.
    const upcoming = slides[current + 1]?.querySelector('img');
    if (upcoming) upcoming.loading = 'eager';
  }
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  document.getElementById('print').addEventListener('click', () => window.print());
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input,textarea,select,[contenteditable="true"],summary')) return;
    const positions = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: slides.length - 1 };
    if (!(event.key in positions)) return;
    event.preventDefault(); show(positions[event.key]);
  });
  show(0);
})();
