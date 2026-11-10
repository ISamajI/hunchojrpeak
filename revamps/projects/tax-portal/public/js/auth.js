(async function () {
  loadConfig();
  const msg = document.getElementById('msg');
  const fr = document.getElementById('form-register');
  const fl = document.getElementById('form-login');
  const tr = document.getElementById('tab-register');
  const tl = document.getElementById('tab-login');

  function show(which) {
    const login = which === 'login';
    fr.classList.toggle('hidden', login); fl.classList.toggle('hidden', !login);
    tr.classList.toggle('active', !login); tl.classList.toggle('active', login);
    msg.classList.add('hidden');
  }
  tr.onclick = () => show('register');
  tl.onclick = () => show('login');
  if (location.hash === '#login') show('login');

  const fail = (e) => { msg.textContent = e.message; msg.classList.remove('hidden'); };
  const go = (role) => (location.href = role === 'owner' ? '/admin' : '/portal');

  fr.onsubmit = async (e) => {
    e.preventDefault();
    const btn = fr.querySelector('button'); btn.disabled = true;
    try {
      const r = await api('/api/register', { method: 'POST', body: {
        name: document.getElementById('r-name').value, email: document.getElementById('r-email').value, password: document.getElementById('r-pass').value } });
      go(r.role);
    } catch (err) { fail(err); btn.disabled = false; }
  };

  fl.onsubmit = async (e) => {
    e.preventDefault();
    const btn = fl.querySelector('button'); btn.disabled = true;
    try {
      const r = await api('/api/login', { method: 'POST', body: {
        email: document.getElementById('l-email').value, password: document.getElementById('l-pass').value } });
      go(r.role);
    } catch (err) { fail(err); btn.disabled = false; }
  };
})();
