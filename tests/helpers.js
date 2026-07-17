// Utilidades compartidas para los tests de AviGo
const API = 'https://avigo-backend-production.up.railway.app';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// JWT válido (no vencido) — avigoTieneSession solo exige que exista el string,
// pero avigoRenovarTokenSiNecesario hace atob del payload, así que debe parsear.
function jwtValido() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  return b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ sub: 'u1', exp }) + '.firmafalsa';
}

const PLAN_FREE_TRIAL_VENCIDO = {
  plan: 'free',
  enTrial: true,
  expira: new Date(Date.now() - 86400000).toISOString(), // venció ayer
};
const PLAN_PRO = { plan: 'pro', enTrial: false, expira: null };

/**
 * Prepara la página: sesión en localStorage, planInfo cacheado, y mocks de red.
 * @param {object} opts
 *   planCache  — objeto planInfo a dejar en caché (o null para no dejar nada)
 *   authMe     — función (n) => planInfo, donde n es el número de llamada (1-indexed)
 */
async function preparar(page, opts = {}) {
  const { planCache = null, authMe = () => PLAN_PRO } = opts;
  const contadores = { authMe: 0, errores: [] };

  // Bloquear Google GSI (red externa, ruido no determinista)
  await page.route('https://accounts.google.com/**', r => r.abort());

  // OJO: en Playwright la ÚLTIMA ruta registrada gana. El catch-all va primero
  // para que /auth/me y /errores (registrados después) tengan precedencia.
  await page.route(`${API}/**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ granjas: 0, lotes: [] }),
    });
  });

  await page.route(`${API}/auth/me*`, async route => {
    contadores.authMe++;
    const planInfo = authMe(contadores.authMe);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ usuario: { id: 'u1', email: 'jorge@test.mx' }, planInfo }),
    });
  });

  // Capturar los beacons de error (Ola 0)
  await page.route(`${API}/errores*`, async route => {
    try { contadores.errores.push(JSON.parse(route.request().postData() || '{}')); } catch (e) {}
    await route.fulfill({ status: 204, body: '', headers: { 'Access-Control-Allow-Origin': '*' } });
  });

  await page.addInitScript(([token, cache]) => {
    localStorage.setItem('avigo_session', JSON.stringify({
      token,
      usuario: { id: 'u1', email: 'jorge@test.mx', nombre: 'Jorge' },
    }));
    if (cache) localStorage.setItem('avigo_plan_info', cache);
  }, [jwtValido(), planCache ? JSON.stringify(planCache) : null]);

  return contadores;
}

// Cuenta overlays de bienvenida Pro realmente montados en el DOM.
// Se cuenta por el botón (querySelectorAll sí devuelve ids duplicados), no por
// texto: el fuente de la función vive en un <script> dentro de body y matchea.
async function contarModalesPro(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter(b => b.textContent.includes('Empezar ahora')).length
  );
}

const leerPlan = page => page.evaluate(() => localStorage.getItem('avigo_plan_info'));

module.exports = { API, preparar, contarModalesPro, leerPlan, jwtValido, PLAN_FREE_TRIAL_VENCIDO, PLAN_PRO };
