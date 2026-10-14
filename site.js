// VacuNet · datos desde Supabase: contenido editable, catálogo y cuentas
const FORM_CITAS = 'https://docs.google.com/forms/d/e/1FAIpQLSctHXqX7V9ZFVcehkF8fsIdPuOgH1bUk5Sy5xW8SraosADeDA/viewform?usp=sf_link';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COP = n => '$' + Number(n).toLocaleString('es-CO');

async function cargarContenido() {
  const { data } = await db.from('contenido').select('clave,valor');
  if (!data) return;
  const c = Object.fromEntries(data.map(r => [r.clave, r.valor]));
  document.querySelectorAll('[data-contenido]').forEach(el => { if (c[el.dataset.contenido]) el.textContent = c[el.dataset.contenido]; });
  document.querySelectorAll('[data-contenido-img]').forEach(el => { if (c[el.dataset.contenidoImg]) el.src = c[el.dataset.contenidoImg]; });
  if (c.promo_banner_activo === 'true' && c.promo_banner_texto) {
    const b = document.createElement('div');
    b.className = 'promo-banner';
    b.textContent = c.promo_banner_texto;
    document.body.prepend(b);
  }
}

async function cargarCatalogo() {
  const grid = document.getElementById('vacunas-grid');
  if (!grid) return;
  const { data, error } = await db.from('vacunas').select('*').eq('activo', true).order('orden');
  if (error || !data) { grid.innerHTML = '<p>No pudimos cargar el catálogo. Intenta de nuevo en un momento.</p>'; return; }
  grid.innerHTML = data.map(v => {
    const dcto = v.descuento_pct > 0;
    const final = dcto ? Math.round(v.precio * (1 - v.descuento_pct / 100)) : v.precio;
    const precio = v.precio == null ? '<span class="consultar">Consulta el precio</span>'
      : (dcto ? `<s>${COP(v.precio)}</s>${COP(final)}` : COP(v.precio));
    const promo = v.promo_texto ? `<span class="etiqueta-promo">${esc(v.promo_texto)}</span>` : '';
    const img = v.imagen_url ? `<img src="${esc(v.imagen_url)}" alt="${esc(v.nombre)}">` : '<div class="sin-foto">💉</div>';
    const accion = v.categoria === 'producto'
      ? `<a href="mailto:vacunetgerencia@gmail.com?subject=${encodeURIComponent('Consulta: ' + v.nombre)}" class="btn-hero">Consultar</a>`
      : `<a href="${FORM_CITAS}" class="btn-hero" target="_blank" rel="noopener noreferrer">Agendar</a>`;
    return `<div class="vacuna-card producto" data-nombre="${esc(v.nombre.toLowerCase())}">${img}<h3>${esc(v.nombre)}</h3>${promo}<p>${esc(v.descripcion)}</p><p class="precio">${precio}</p>${accion}</div>`;
  }).join('');
}

// ---------- Cuentas (Supabase Auth) ----------
function guardarSesion(user) {
  const m = user.user_metadata || {};
  const previo = JSON.parse(localStorage.getItem('vacunet_usuario') || '{}');
  localStorage.setItem('vacunet_usuario', JSON.stringify({
    nombre: m.nombre, tipoDocumento: m.tipoDocumento, numeroDocumento: m.numeroDocumento,
    telefono: m.telefono, correo: user.email, foto: previo.foto
  }));
  localStorage.setItem('vacunet_sesion', 'activa');
}

function irAlDestino() {
  const destino = localStorage.getItem('vacunet_destino') || 'index.html';
  localStorage.removeItem('vacunet_destino');
  window.location.href = destino;
}

async function cerrarSesion() {
  await db.auth.signOut();
  localStorage.removeItem('vacunet_sesion');
  localStorage.removeItem('vacunet_usuario');
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  cargarContenido();
  cargarCatalogo();

  const login = document.getElementById('form-login');
  if (login) {
    const recordado = localStorage.getItem('vacunet_correo');
    if (recordado) { document.getElementById('correo').value = recordado; document.getElementById('recordar').checked = true; }
    login.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('correo').value;
      const { data, error } = await db.auth.signInWithPassword({ email, password: document.getElementById('password').value });
      if (error) { alert('Correo o contraseña incorrectos.'); return; }
      if (document.getElementById('recordar').checked) localStorage.setItem('vacunet_correo', email);
      else localStorage.removeItem('vacunet_correo');
      guardarSesion(data.user);
      irAlDestino();
    });
  }

  const registro = document.getElementById('form-registro');
  if (registro) {
    registro.addEventListener('submit', async e => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      if (password !== document.getElementById('confirmar-password').value) { alert('Las contraseñas no coinciden.'); return; }
      const { data, error } = await db.auth.signUp({
        email: document.getElementById('correo').value, password,
        options: { data: {
          nombre: document.getElementById('nombre').value,
          tipoDocumento: document.getElementById('tipo-documento').value,
          numeroDocumento: document.getElementById('numero-documento').value,
          telefono: document.getElementById('telefono').value
        } }
      });
      if (error) { alert('No pudimos crear la cuenta: ' + error.message); return; }
      if (data.session) { guardarSesion(data.user); alert('¡Cuenta creada! Bienvenido a VacuNet.'); window.location.href = 'index.html'; }
      else alert('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
    });
  }
});