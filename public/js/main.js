// Landing page — minimal JS, just scroll animations
document.addEventListener('DOMContentLoaded', () => {
  // Intersection observer for scroll-triggered fade-ins
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.15 }
  );
  document.querySelectorAll('.fade-in-delay, .fade-in-delay-2, .fade-in-delay-3')
    .forEach(el => observer.observe(el));
});
