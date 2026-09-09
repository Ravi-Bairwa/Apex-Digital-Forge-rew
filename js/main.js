/* ═══════════════════════════════
   APEX DIGITAL FORGE — JavaScript
═══════════════════════════════ */

// Page navigation
function showPage(page, e) {
  var target = document.getElementById('page-' + page);
  if (!target) {
    // This page's content lives in its own file now — do a real navigation
    if (e) { e.preventDefault(); }
    var cleanPath = page === 'home' ? '/' : '/' + page;
    window.location.href = cleanPath;
    return;
  }
  if (e) { e.preventDefault(); e.stopPropagation(); }
  // Update canonical tag dynamically per page
  var canonicalTag = document.getElementById('canonical-tag');
  if (canonicalTag) {
    var base = 'https://www.apexdigitalforge.in';
    canonicalTag.setAttribute('href', page === 'home' ? base + '/' : base + '/' + page);
  }
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  target.classList.add('active');
  window.scrollTo(0, 0);
  // Update nav active state
  document.querySelectorAll('nav li a, .mobile-menu a').forEach(function(a) { a.classList.remove('active-nav'); });
  var navLink = document.querySelector('[data-page="' + page + '"]');
  if (navLink) navLink.classList.add('active-nav');
  // Push clean URL — /services not /#services
  if (window.history && window.history.pushState) {
    var cleanPath = page === 'home' ? '/' : '/' + page;
    if (window.location.pathname !== cleanPath) {
      window.history.pushState({ page: page }, '', cleanPath);
    }
  }
}

// Handle browser back/forward navigation
window.addEventListener('popstate', function(e) {
  var path = window.location.pathname.replace('/', '') || 'home';
  var page = (e.state && e.state.page) ? e.state.page : path;
  var target = document.getElementById('page-' + page);
  if (!target) {
    // Page content isn't in this file — reload to get the right page
    window.location.reload();
    return;
  }
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  target.classList.add('active');
  window.scrollTo(0, 0);
  document.querySelectorAll('nav li a, .mobile-menu a').forEach(function(a) { a.classList.remove('nav-active'); });
  var navLink = document.querySelector('[data-page="' + page + '"]');
  if (navLink) navLink.classList.add('nav-active');
});

// Pricing tabs
function showPricing(tab) {
  document.querySelectorAll('.psection').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.ptab').forEach(function(t) { t.classList.remove('active'); });
  var section = document.getElementById('ps-' + tab);
  if (section) section.classList.add('active');
  if (event && event.target) event.target.classList.add('active');
}

function showSvcTab(tab, btn) {
  document.querySelectorAll('.svcpane').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.svctab').forEach(function(t) { t.classList.remove('active'); });
  var pane = document.getElementById('svcp-' + tab);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');
}

// SEO Audit form submission
document.addEventListener('DOMContentLoaded', function() {
  var auditForm = document.getElementById('auditForm');
  if (auditForm) {
    auditForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('auditSubmit');
      var msg = document.getElementById('auditMsg');
      btn.textContent = 'Sending...';
      btn.disabled = true;
      var data = {
        website_url: document.getElementById('auditUrl').value,
        name: document.getElementById('auditName').value,
        email: document.getElementById('auditEmail').value,
        phone: document.getElementById('auditPhone').value || 'Not provided',
        budget: document.getElementById('auditBudget').value || 'Not specified',
        goal: document.getElementById('auditGoal').value || 'Not specified',
        _subject: 'Free SEO Audit Request — ' + document.getElementById('auditUrl').value
      };
      try {
        var res = await fetch('/api/seo-audit', {
          method: 'POST', headers: {'Content-Type':'application/json','Accept':'application/json'},
          body: JSON.stringify(data)
        });
        if (res.ok) {
          msg.style.display = 'block';
          msg.style.background = 'rgba(34,197,94,0.1)';
          msg.style.border = '1px solid rgba(34,197,94,0.3)';
          msg.style.color = '#4ade80';
          msg.textContent = '✓ Audit request received! We\'ll send your report within 24–48 hours.';
          auditForm.reset();
        } else {
          throw new Error('Failed');
        }
      } catch(err) {
        msg.style.display = 'block';
        msg.style.background = 'rgba(239,68,68,0.1)';
        msg.style.border = '1px solid rgba(239,68,68,0.3)';
        msg.style.color = '#f87171';
        msg.textContent = 'Something went wrong. Please email us at apexdigitalforge@gmail.com';
      }
      btn.textContent = 'Request Free SEO Audit →';
      btn.disabled = false;
    });
  }
});

// Mobile menu
function toggleMenu() {
  var menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

// Close mobile menu on outside click
document.addEventListener('click', function(e) {
  var menu = document.getElementById('mobileMenu');
  var hamburger = document.querySelector('.hamburger');
  if (menu && hamburger && !menu.contains(e.target) && !hamburger.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// Email validation
function isValidEmail(email) {
  return email.indexOf('@') > 0 && email.indexOf('.') > 0;
}

// Custom alert
function showAlert(msg) {
  var existing = document.getElementById('customAlert');
  if (existing) existing.remove();
  var alert = document.createElement('div');
  alert.id = 'customAlert';
  alert.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;background:#16161f;border:1px solid rgba(255,92,53,0.4);border-radius:8px;padding:16px 20px;max-width:360px;font-family:DM Sans,sans-serif;font-size:14px;color:#f4f4f0;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
  var close = document.createElement('button');
  close.textContent = 'x';
  close.style.cssText = 'float:right;background:none;border:none;color:#7a7a8c;cursor:pointer;font-size:16px;margin-left:12px;';
  close.onclick = function() { alert.remove(); };
  alert.appendChild(close);
  alert.appendChild(document.createTextNode(msg));
  document.body.appendChild(alert);
  setTimeout(function() { if (alert.parentNode) alert.remove(); }, 5000);
}

// Contact form submit
async function submitForm(e) {
  e.preventDefault();
  var btn = document.getElementById('submitBtn');
  var form = document.getElementById('contactFormWrap');
  var success = document.getElementById('formSuccess');
  var name = document.getElementById('fname').value.trim();
  var email = document.getElementById('femail').value.trim();
  if (!name || !email) {
    showAlert('Please fill in your name and email.');
    return;
  }
  if (!isValidEmail(email)) {
    showAlert('Please enter a valid email address.');
    return;
  }
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    var data = {
      name: name,
      email: email,
      company: document.getElementById('fcompany').value.trim(),
      phone: document.getElementById('fphone').value.trim(),
      service: document.getElementById('fservice').value,
      budget: document.getElementById('fbudget').value,
      message: document.getElementById('fmessage').value.trim()
    };
    var res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      form.style.display = 'none';
      success.style.display = 'block';
    } else {
      showAlert('Something went wrong. Please email apexdigitalforge@gmail.com directly.');
      btn.textContent = 'Send Inquiry - Get Free Trial';
      btn.disabled = false;
    }
  } catch(err) {
    showAlert('Connection error. Please email apexdigitalforge@gmail.com directly.');
    btn.textContent = 'Send Inquiry - Get Free Trial';
    btn.disabled = false;
  }
}

// Quick lead capture widget ("Get It Now") - just email + website
async function submitQuickLead(e, form) {
  e.preventDefault();
  var btn = form.querySelector('button[type="submit"]');
  var origLabel = btn.textContent;
  var email = form.querySelector('input[type="email"]').value.trim();
  var website = form.querySelector('input[name="website"]').value.trim();
  if (!email || !website) {
    showAlert('Please enter both your email and your website.');
    return;
  }
  if (!isValidEmail(email)) {
    showAlert('Please enter a valid email address.');
    return;
  }
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    var res = await fetch('/api/quick-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email: email, website: website, source_page: window.location.pathname })
    });
    if (res.ok) {
      var wrap = form.closest('.quick-cta');
      if (wrap) {
        var successEl = wrap.querySelector('.quick-cta-success');
        form.style.display = 'none';
        if (successEl) successEl.style.display = 'block';
      }
    } else {
      showAlert('Something went wrong. Please email apexdigitalforge@gmail.com directly.');
      btn.textContent = origLabel;
      btn.disabled = false;
    }
  } catch (err) {
    showAlert('Connection error. Please email apexdigitalforge@gmail.com directly.');
    btn.textContent = origLabel;
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Init first pricing tab
  var firstTab = document.querySelector('.ptab');
  var firstSection = document.querySelector('.psection');
  if (firstTab) firstTab.classList.add('active');
  if (firstSection) firstSection.classList.add('active');
});

/* ═══ ANIMATED VISUALS: Authority Engine / Orbit / Timeline ═══ */
(function(){
  function initAuthorityEngine(){
    var stage = document.getElementById('aeStage');
    var canvas = document.getElementById('aeCanvas');
    if(!stage || !canvas) return;
    var ctx = canvas.getContext('2d');
    var w, h;
    function adfAccentRGB(){ var t=document.documentElement.getAttribute('data-theme'); if(t==='apex') return '255,46,166'; if(t==='light') return '22,163,74'; return '255,92,53'; }
    function adfAccentHex(){ var t=document.documentElement.getAttribute('data-theme'); if(t==='apex') return '#ff2ea6'; if(t==='light') return '#16a34a'; return '#ff5c35'; }

    var clientEl = stage.querySelector('.ae-node:not(.ae-pub):not(.ae-graph) .ae-circle');
    var pubEls = stage.querySelectorAll('.ae-pub .ae-circle');
    var graphEl = stage.querySelector('.ae-graph .ae-circle');

    // Node positions only change on resize/font-load, never per frame.
    // Caching them avoids calling getBoundingClientRect() (a forced layout
    // read) on every animation frame and for every particle, which was
    // the source of the visible lag/stutter.
    var cachedClient, cachedPubs, cachedGraph;

    function centerOf(el, stageR){
      var r = el.getBoundingClientRect();
      return { x: (r.left + r.right)/2 - stageR.left, y: (r.top + r.bottom)/2 - stageR.top };
    }

    function recalcPositions(){
      var stageR = stage.getBoundingClientRect();
      cachedClient = clientEl ? centerOf(clientEl, stageR) : {x: w*0.07, y: h*0.5};
      if(pubEls && pubEls.length === 3){
        cachedPubs = [centerOf(pubEls[0], stageR), centerOf(pubEls[1], stageR), centerOf(pubEls[2], stageR)];
      } else {
        cachedPubs = [
          {x: w*0.45, y: h*0.14},
          {x: w*0.45, y: h*0.48},
          {x: w*0.45, y: h*0.82}
        ];
      }
      cachedGraph = graphEl ? centerOf(graphEl, stageR) : {x: w*0.85, y: h*0.5};
    }

    function resize(){
      var rect = stage.getBoundingClientRect();
      w = canvas.width = rect.width;
      h = canvas.height = rect.height;
      recalcPositions();
    }
    resize();
    window.addEventListener('resize', resize);
    if(window.ResizeObserver){
      new ResizeObserver(resize).observe(stage);
    }
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(resize);
    }
    setTimeout(resize, 500);
    setTimeout(resize, 1500);

    var particles = [];
    function spawn(){
      var from = cachedPubs[Math.floor(Math.random()*cachedPubs.length)];
      particles.push({ x: from.x, y: from.y, t: 0, speed: 0.006 + Math.random()*0.004, leg: 1 });
    }
    var spawnTimer = setInterval(spawn, 420);

    var mx = -1000, my = -1000;
    stage.addEventListener('mousemove', function(e){
      var r = stage.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
    });
    stage.addEventListener('mouseleave', function(){ mx = -1000; my = -1000; });

    function line(a, b, alpha, color){
      ctx.strokeStyle = color.replace('ALPHA', alpha);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }

    var rafId;
    function tick(){
      ctx.clearRect(0,0,w,h);
      var client = cachedClient, pubs = cachedPubs, graph = cachedGraph;
      pubs.forEach(function(p){ line(p, client, 0.1, 'rgba('+adfAccentRGB()+',ALPHA)'); });
      line(client, graph, 0.08, 'rgba(29,158,117,ALPHA)');

      particles.forEach(function(p){
        p.t += p.speed;
        if(p.leg === 1){
          if(p.t >= 1){ p.leg = 2; p.t = 0; }
        } else if(p.t >= 1){ p.done = true; }
      });
      particles = particles.filter(function(p){ return !p.done; });

      particles.forEach(function(p){
        var from, to;
        if(p.leg === 1){ from = p._from || (p._from = pubs[Math.floor(Math.random()*pubs.length)]); to = client; }
        else { from = client; to = graph; }
        var ex = from.x + (to.x - from.x) * p.t;
        var ey = from.y + (to.y - from.y) * p.t;
        var dist = Math.hypot(mx-ex, my-ey);
        var boost = dist < 70 ? (70-dist)/70 * 5 : 0;
        var angle = Math.atan2(my-ey, mx-ex);
        var px = ex - Math.cos(angle)*boost;
        var py = ey - Math.sin(angle)*boost;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI*2);
        ctx.fillStyle = p.leg === 1 ? 'rgba('+adfAccentRGB()+',0.9)' : 'rgba(29,158,117,0.9)';
        ctx.shadowColor = p.leg === 1 ? adfAccentHex() : '#1d9e75';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      rafId = requestAnimationFrame(tick);
    }
    tick();
  }

  function initScanBeam(){
    var checkpoints = document.querySelectorAll('.scan-checkpoint');
    if(!checkpoints.length) return;
    var N = checkpoints.length;
    var duration = 6000;
    var startTime = null;
    function update(ts){
      if(!startTime) startTime = ts;
      var elapsed = (ts - startTime) % duration;
      var frac = elapsed / duration;
      var progress;
      if(frac <= 0.45){ progress = frac / 0.45; }
      else if(frac <= 0.55){ progress = 1; }
      else { progress = 1 - (frac - 0.55) / 0.45; }
      checkpoints.forEach(function(cp, i){
        var threshold = i / (N - 1);
        if(progress >= threshold - 0.02){ cp.classList.add('lit'); }
        else { cp.classList.remove('lit'); }
      });
      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function initCountUp(){
    var nums = document.querySelectorAll('.count-num');
    if(!nums.length) return;
    var done = new WeakSet();
    function animate(el){
      var target = parseInt(el.getAttribute('data-target'), 10) || 0;
      var start = null;
      var duration = 1200;
      function step(ts){
        if(!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target).toLocaleString('en-US');
        if(progress < 1){ requestAnimationFrame(step); }
        else { el.textContent = target.toLocaleString('en-US'); }
      }
      requestAnimationFrame(step);
    }
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting && !done.has(entry.target)){
          done.add(entry.target);
          animate(entry.target);
        }
      });
    }, { threshold: 0.4 });
    nums.forEach(function(n){ obs.observe(n); });
  }

  function initFeatureStagger(){
    var items = document.querySelectorAll('.feature-item');
    if(!items.length) return;
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry, i){
        if(entry.isIntersecting){
          var idx = Array.prototype.indexOf.call(items, entry.target);
          setTimeout(function(){ entry.target.classList.add('in-view'); }, idx * 100);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    items.forEach(function(item){ obs.observe(item); });
  }

  function initCardTilt(){
    var cards = document.querySelectorAll('.fb-card, .blog-card');
    cards.forEach(function(card){
      card.addEventListener('mousemove', function(e){
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var rotateX = ((y / rect.height) - 0.5) * -8;
        var rotateY = ((x / rect.width) - 0.5) * 8;
        card.style.transform = 'perspective(600px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-2px)';
      });
      card.addEventListener('mouseleave', function(){
        card.style.transform = '';
      });
    });
  }

  function initRevealOnScroll(){
    var learnSeoSections = document.querySelectorAll('#page-learn-seo [id][style*="margin-bottom:60px"]');
    learnSeoSections.forEach(function(s){ s.classList.add('reveal-on-scroll'); });
    var sections = document.querySelectorAll('.reveal-on-scroll');
    if(!sections.length) return;
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    sections.forEach(function(s){ obs.observe(s); });
  }

  function initAll(){
    initAuthorityEngine();
    initScanBeam();
    initCountUp();
    initFeatureStagger();
    initCardTilt();
    initRevealOnScroll();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();

var ADF_THEME_ORDER=['light','apex'];
function toggleTheme(){
  var root=document.documentElement;
  var cur=root.getAttribute('data-theme');
  var idx=ADF_THEME_ORDER.indexOf(cur);
  var next=ADF_THEME_ORDER[(idx+1)%ADF_THEME_ORDER.length];
  root.setAttribute('data-theme',next);
  try{localStorage.setItem('adf-theme',next);}catch(e){}
}
