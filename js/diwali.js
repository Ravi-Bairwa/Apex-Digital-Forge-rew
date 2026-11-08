/* Diwali 2026 campaign — self-expiring.
   Active 8 Nov 2026 00:00 IST -> 16 Nov 2026 00:00 IST (8 days). After END nothing renders.
   To remove permanently: delete css/diwali.css, js/diwali.js and the two <link>/<script> tags marked "diwali-2026". */
(function () {
  var START = new Date('2026-11-08T00:00:00+05:30').getTime();
  var END   = new Date('2026-11-16T00:00:00+05:30').getTime();
  var now = Date.now();
  if (now < START || now >= END) return;

  var root = document.documentElement;
  root.classList.add('diwali');

  var dismissed = false;
  try { dismissed = sessionStorage.getItem('adf-diwali-dismissed') === '1'; } catch (e) {}

  function mount() {
    if (document.getElementById('diwali-banner')) return;
    var diya = '<svg class="dw-diya" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false">' +
      '<path d="M16 3c2.6 3 3.6 5.2 3.6 7.2A3.6 3.6 0 0 1 16 13.8a3.6 3.6 0 0 1-3.6-3.6C12.4 8.2 13.6 6 16 3z" fill="#ffd34d"/>' +
      '<path d="M3 16h26c0 6.2-5.8 11-13 11S3 22.2 3 16z" fill="#c8431f"/>' +
      '<path d="M3 16h26" stroke="#ffd34d" stroke-width="1.6"/></svg>';

    var b = document.createElement('div');
    b.id = 'diwali-banner';
    b.className = 'diwali-banner';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Diwali offer');
    b.innerHTML =
      '<div class="dw-inner">' + diya +
      '<span class="dw-text"><strong>Happy Diwali!</strong> ' +
      '<span class="dw-full">Enjoy </span><span class="dw-off">20% OFF</span> on all services' +
      '<span class="dw-full"> &middot; Use code <b>DIWALI20</b> &middot; Offer ends 15 Nov</span></span>' +
      '<a class="dw-cta" href="/contact">Claim offer</a>' + diya +
      '</div>' +
      '<button type="button" class="dw-close" aria-label="Dismiss Diwali offer banner">&times;</button>' +
      '<div class="dw-lights" aria-hidden="true"></div>';

    b.querySelector('.dw-close').addEventListener('click', function () {
      b.parentNode && b.parentNode.removeChild(b);
      try { sessionStorage.setItem('adf-diwali-dismissed', '1'); } catch (e) {}
    });

    document.body.insertBefore(b, document.body.firstChild);
  }

  if (dismissed) return;
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
