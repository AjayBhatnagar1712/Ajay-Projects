const AIKON_SITE_CONFIG = {
  businessName: "Aikon Automations",
  domain: "https://aikonautomations.com",
  email: "hello@aikonautomations.com",
  phoneDisplay: "+91 88606 92661",
  phoneHref: "tel:+918860692661",
  whatsappHref: "https://wa.me/918860692661",
  whatsappLabel: "WhatsApp us"
};

const applySiteConfig = () => {
  document.querySelectorAll("[data-email-text]").forEach((node) => {
    node.textContent = AIKON_SITE_CONFIG.email;
  });

  document.querySelectorAll("[data-email-link]").forEach((node) => {
    node.setAttribute("href", `mailto:${AIKON_SITE_CONFIG.email}`);
  });

  document.querySelectorAll("[data-phone-text]").forEach((node) => {
    node.textContent = AIKON_SITE_CONFIG.phoneDisplay;
  });

  document.querySelectorAll("[data-phone-link]").forEach((node) => {
    node.setAttribute("href", AIKON_SITE_CONFIG.phoneHref);
  });

  document.querySelectorAll("[data-whatsapp-link]").forEach((node) => {
    node.setAttribute("href", AIKON_SITE_CONFIG.whatsappHref);
  });

  document.querySelectorAll("[data-whatsapp-text]").forEach((node) => {
    node.textContent = AIKON_SITE_CONFIG.whatsappLabel;
  });

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
};

const initMobileNavigation = () => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");

  if (!toggle || !menu) {
    return;
  }

  const setMenuState = (isOpen) => {
    menu.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("is-menu-open", isOpen);
  };

  toggle.addEventListener("click", () => {
    setMenuState(!menu.classList.contains("is-open"));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuState(false));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) {
      setMenuState(false);
    }
  });
};

const initFormStatusBanner = () => {
  const banner = document.querySelector("[data-form-status]");

  if (!banner) {
    return;
  }

  const status = new URLSearchParams(window.location.search).get("status");

  if (!status) {
    return;
  }

  let message = "";
  let isError = false;

  if (status === "error") {
    message = "Your enquiry could not be sent right now. Please call or email us directly and we will respond shortly.";
    isError = true;
  }

  if (status === "invalid") {
    message = "Please complete the required fields with a valid email address and try again.";
    isError = true;
  }

  if (!message) {
    return;
  }

  banner.textContent = message;
  banner.classList.add("is-visible");

  if (isError) {
    banner.classList.add("error");
  }
};

const initRevealObserver = () => {
  const revealNodes = document.querySelectorAll(".reveal");

  if (!revealNodes.length) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

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
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealNodes.forEach((node) => observer.observe(node));
};

const initTiltSurfaces = () => {
  const tiltNodes = document.querySelectorAll("[data-tilt]");

  tiltNodes.forEach((node) => {
    const reset = () => {
      node.style.transform = "";
    };

    node.addEventListener("mousemove", (event) => {
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rotateY = ((x / rect.width) - 0.5) * 7;
      const rotateX = ((y / rect.height) - 0.5) * -7;
      node.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px)`;
    });

    node.addEventListener("mouseleave", reset);
    node.addEventListener("blur", reset, true);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  applySiteConfig();
  initMobileNavigation();
  initFormStatusBanner();
  initRevealObserver();
  initTiltSurfaces();
});
