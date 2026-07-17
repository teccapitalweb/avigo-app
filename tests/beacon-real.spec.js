const { test, expect } = require('@playwright/test');
const { jwtValido } = require('./helpers');
const API = 'https://avigo-backend-production.up.railway.app';

// SIN mock de /errores: el beacon debe llegar al backend real de Railway.
test('beacon real: del sitio publicado al backend de producción', async ({ page }) => {
  await page.route('https://accounts.google.com/**', r => r.abort());
  await page.addInitScript(t => {
    localStorage.setItem('avigo_session', JSON.stringify({ token: t, usuario: { id: 'u1' } }));
  }, jwtValido());

  const enviados = [];
  page.on('request', r => { if (r.url().includes('/errores')) enviados.push(r); });
  const esperaRespuesta = page.waitForResponse(
    r => r.url().includes('/errores'), { timeout: 15000 });

  await page.goto('./');
  await page.waitForTimeout(2500);
  await page.evaluate(() => setTimeout(() => { window.__jorgeCrash.boom(); }, 10));

  const res = await esperaRespuesta;
  console.log('   → URL     :', res.url());
  console.log('   → status  :', res.status(), '(esperado 204)');
  console.log('   → payload :', enviados[0] && enviados[0].postData());
  expect(res.status(), 'el backend real debe aceptar el beacon').toBe(204);
});
