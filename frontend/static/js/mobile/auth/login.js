(function () {
  function initPasswordToggle() {
    const input = document.getElementById('loginPassword');
    const toggle = document.getElementById('mobileAuthPasswordToggle');
    const icon = document.getElementById('mobileAuthPasswordIcon');
    if (!input || !toggle || !icon) return;

    toggle.addEventListener('click', function () {
      const nextType = input.type === 'password' ? 'text' : 'password';
      input.type = nextType;
      icon.className = nextType === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.RimalisAuth?.initLoginForm?.();
    initPasswordToggle();
  });
})();
