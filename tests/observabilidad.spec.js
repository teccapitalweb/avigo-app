const { test, expect } = require('@playwright/test');
const { preparar, PLAN_PRO } = require('./helpers');

// ─── C8 — No existe manejador global de errores
test('C8: un error suelto se reporta al backend', async ({ page }) => {
  const c = await preparar(page, { planCache: null, authMe: () => PLAN_PRO });
  await page.goto('./');
  await page.waitForTimeout(2500);

  // Un error como el de selGalpones: revienta en un handler y nadie se entera
  await page.evaluate(() => setTimeout(() => { window.__noExiste.explota(); }, 10));
  await page.waitForTimeout(1200);

  console.log('   → beacons de error recibidos:', JSON.stringify(c.errores, null, 2));
  expect(c.errores.length, 'el error debe llegar al backend').toBeGreaterThan(0);
  expect(c.errores[0].msg, 'debe traer el mensaje').toBeTruthy();
});

test('C8: una promesa rechazada sin catch se reporta', async ({ page }) => {
  const c = await preparar(page, { planCache: null, authMe: () => PLAN_PRO });
  await page.goto('./');
  await page.waitForTimeout(2500);

  await page.evaluate(() => { Promise.reject(new Error('fallo de red simulado')); });
  await page.waitForTimeout(1200);

  console.log('   → beacons de rejection:', JSON.stringify(c.errores, null, 2));
  expect(c.errores.length, 'la rejection debe llegar al backend').toBeGreaterThan(0);
  expect(c.errores.some(e => e.tipo === 'rejection'), 'debe marcarse como rejection').toBe(true);
});
