/* ═══════════════════════════════════════════
   APEX DIGITAL FORGE — Main JavaScript
   apexdigitalforge.in
═══════════════════════════════════════════ */

/* ─── PAGE NAVIGATION ─── */
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ─── PRICING TABS ─── */
function showPricing(tab) {
  document.querySelectorAll('.psection').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  const section = document.getElementById('ps-' + tab);
  if (section) section.classList.add('active');
  if (event && event.target) event.target.classList.add('active');
}

/* ─── MOBILE MENU ─── */
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(e) {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.querySelector('.hamburger');
  if (menu && hamburger && !menu.contains(e.target) && !hamburger.contains(e.target)) {
    menu.classList.remove('open');
  }
});

/* ─── CONTACT FORM — Formspree Backend ─── */
async function submitForm(e) {
  e.preventDefault();

  const btn = document.getElementById('submitBtn');
  const form = document.getElementById('contactFormWrap');
  const success = document.getElementById('formSuccess');

  // Basic validation
  const name = document.getElementById('fname').value.trim();
  const email = document.getElementById('femail').value.trim();
  const service = document.getElementById('fservice').value;
  const budget = document.getElementById('fbudget').value;

  if (!name || !email || !service || !budget) {
    showAlert('Please fill in all required fields.');
    return;
  }

  if (!isValidEmail(email)) {
    showAlert('Please enter a valid email address.');
    return;
  }

  // Show loading state
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const formData = new FormData(form);

    const res = await fetch('https://formspree.io/f/mdajvkzn', {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();

    if (res.ok) {
      // Success
      form.style.display = 'none';
      success.style.display = 'block';

      // Track conversion
      console.log('Form submitted successfully');
    } else {
      const errorMsg = data.errors
        ? data.errors.map(e => e.message).join(', ')
        : 'Something went wrong. Please email us directly.';
      showAlert(errorMsg);
      btn.textContent = 'Send Message — We Reply in 2 Hours';
      btn.disabled = false;
    }

  } catch (err) {
    console.error('Form error:', err);
    showAlert('Connection error. Please email us directly at apexdigitalforge@gmail.com');
    btn.textContent = 'Send Message — We Reply in 2 Hours';
    btn.disabled = false;
  }
}

/* ─── HELPERS ─── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showAlert(msg) {
  // Create custom alert instead of browser default
  const existing = document.getElementById('customAlert');
  if (existing) existing.remove();

  const alert = document.createElement('div');
  alert.id = 'customAlert';
  alert.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    background: #16161f; border: 1px solid rgba(255,92,53,0.4);
    border-radius: 8px; padding: 16px 20px; max-width: 360px;
    font-family: 'DM Sans', sans-serif; font-size: 14px;
    color: #f4f4f0; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  `;
  alert.textContent = msg;

  const close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = 'float:right;background:none;border:none;color:#7a7a8c;cursor:pointer;font-size:16px;margin-left:12px;';
  close.onclick = () => alert.remove();
  alert.prepend(close);

  document.body.appendChild(alert);
  setTimeout(() => alert && alert.remove(), 5000);
}

/* ─── SMOOTH SCROLL FOR ANCHOR LINKS ─── */
document.addEventListener('DOMContentLoaded', function() {
  // Animate elements on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

  // Set active nav link based on current page
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      navLinks.forEach(l => l.classList.remove('active-nav'));
      this.classList.add('active-nav');
    });
  });
});

/* ─── LIVE DOT ANIMATION ─── */
// Already handled by CSS animation — no JS needed

/* ─── PRICING TAB INIT ─── */
document.addEventListener('DOMContentLoaded', function() {
  // Ensure first pricing tab is active on load
  const firstTab = document.querySelector('.ptab');
  const firstSection = document.querySelector('.psection');
  if (firstTab) firstTab.classList.add('active');
  if (firstSection) firstSection.classList.add('active');
});
