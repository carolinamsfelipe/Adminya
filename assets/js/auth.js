(function () {
  'use strict';

  var form = document.getElementById('login-form');
  var errorBox = document.getElementById('login-error');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('is-visible');
  }

  async function doLogin(email, password) {
    errorBox.classList.remove('is-visible');
    try {
      var res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password }),
      });
      var data = await res.json();
      if (!res.ok) {
        showError(data.error || 'No se pudo iniciar sesión.');
        return;
      }
      window.location.href = '/dashboard.html';
    } catch (e) {
      showError('No se pudo conectar con el servidor.');
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    doLogin(document.getElementById('email').value.trim(), document.getElementById('password').value);
  });

  document.querySelectorAll('.demo-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      doLogin(btn.dataset.email, 'adminyaaa2026');
    });
  });
})();
