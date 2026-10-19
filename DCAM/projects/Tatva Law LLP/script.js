const header = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const navShell = document.querySelector(".nav-shell");
const navLinks = document.querySelectorAll(".site-nav a, .nav-shell .header-cta");
const reveals = document.querySelectorAll(".reveal");
const years = document.querySelectorAll("[data-year]");

const syncHeader = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 18);
};

const setMenu = (open) => {
  if (!navToggle || !navShell) {
    return;
  }

  navToggle.setAttribute("aria-expanded", String(open));
  navShell.classList.toggle("is-open", open);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

years.forEach((year) => {
  year.textContent = new Date().getFullYear();
});

if (navToggle && navShell) {
  navToggle.addEventListener("click", () => {
    const isOpen = navShell.classList.contains("is-open");
    setMenu(!isOpen);
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenu(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      setMenu(false);
    }
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add("is-visible"));
}
