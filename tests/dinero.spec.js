const { test, expect } = require('@playwright/test');
const { preparar, contarModalesPro, leerPlan, PLAN_FREE_TRIAL_VENCIDO, PLAN_PRO } = require('./helpers');

const TRIAL_ACTIVO = { plan: 'free', enTrial: true, expira: new Date(Date.now() + 5 * 86400000).toISOString() };

// ─── A1 — El modal "¡Ya eres Pro!" sale doble y el visible tiene el botón inerte
// Condición real (verificada): el refresh de arranque (línea 756, t=1.5s) debe
// devolver AÚN free, y el webhook aterriza justo después → los dos verificarPago
// de t=2s (DOMContentLoaded + load) capturan eraPro=false y ambos pintan modal.
// Si el refresh de 1.5s ya viene pro, eraPro=true y no sale ningún modal.
test('A1: un solo modal Pro y su botón funciona', async ({ page }) => {
  await preparar(page, { planCache: null, authMe: n => (n === 1 ? TRIAL_ACTIVO : PLAN_PRO) });
  await page.goto('./?pago=exitoso');
  await page.waitForTimeout(6000);

  const modales = await contarModalesPro(page);
  console.log('   → modales "¡Ya eres Pro!" en el DOM:', modales);
  expect(modales, 'debe haber exactamente 1 modal Pro').toBe(1);

  // El usuario hace clic en "¡Empezar ahora!" del modal visible (el de más arriba)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
      .filter(b => b.textContent.includes('¡Empezar ahora!'));
    btns[btns.length - 1].click();
  });
  await page.waitForTimeout(500);

  const quedan = await contarModalesPro(page);
  console.log('   → modales tras el clic:', quedan);
  expect(quedan, 'el clic debe cerrar el modal (app no bloqueada)').toBe(0);
});

// ─── A2 — Quien paga queda atrapado tras el lock screen de "prueba terminada"
test('A2: el lock screen se cierra solo cuando el pago confirma Pro', async ({ page }) => {
  await preparar(page, { planCache: PLAN_FREE_TRIAL_VENCIDO, authMe: () => PLAN_PRO });
  await page.goto('./?pago=exitoso');

  await page.waitForTimeout(1800);
  const lockAntes = await page.locator('#avigo-upgrade-overlay').count();
  console.log('   → lock screen a t=1.8s (esperado 1):', lockAntes);

  await page.waitForTimeout(6000);
  const lockDespues = await page.locator('#avigo-upgrade-overlay').count();
  console.log('   → lock screen tras confirmar Pro:', lockDespues);
  expect(lockDespues, 'el lock debe desaparecer al confirmarse el pago').toBe(0);
});

// ─── A3 — ?pago=exitoso se borra de la URL antes de verificarlo
test('A3: la señal de pago sobrevive hasta que se verifica', async ({ page }) => {
  await preparar(page, { planCache: null, authMe: () => PLAN_PRO });
  await page.goto('./?pago=exitoso');

  await page.waitForTimeout(700); // antes de que verificarPago corra (t=2s)
  const urlTemprana = await page.evaluate(() => location.search);
  console.log('   → URL a t=0.7s:', JSON.stringify(urlTemprana));
  expect(urlTemprana, 'el param no debe borrarse antes de verificar').toContain('pago=exitoso');

  await page.waitForTimeout(6000);
  const urlFinal = await page.evaluate(() => location.search);
  console.log('   → URL tras verificar:', JSON.stringify(urlFinal));
  expect(urlFinal, 'ya verificado, el param debe limpiarse').not.toContain('pago=exitoso');
});

// ─── C6 — TWA/pestaña huérfana: volver a la app no refresca el plan
test('C6: volver a la app (visibilitychange) refresca el plan', async ({ page }) => {
  const c = await preparar(page, { planCache: TRIAL_ACTIVO, authMe: n => (n <= 2 ? TRIAL_ACTIVO : PLAN_PRO) });
  await page.goto('./');
  await page.waitForTimeout(4000);

  const llamadasAntes = c.authMe;
  expect(await leerPlan(page)).toContain('free');

  // El usuario pagó fuera del webview y vuelve a la app
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(2500);

  console.log(`   → llamadas a /auth/me: ${llamadasAntes} antes → ${c.authMe} tras volver`);
  expect(c.authMe, 'volver a la app debe re-consultar el plan').toBeGreaterThan(llamadasAntes);
  const plan = await leerPlan(page);
  console.log('   → planInfo tras volver:', plan);
  expect(plan, 'el Pro recién pagado debe reflejarse').toContain('pro');
});

// ─── C7 — Carrera con el webhook: un solo intento y se queda en "free"
test('C7: reintenta si el webhook de Stripe aún no aterrizó', async ({ page }) => {
  const c = await preparar(page, { planCache: TRIAL_ACTIVO, authMe: n => (n >= 4 ? PLAN_PRO : TRIAL_ACTIVO) });
  await page.goto('./?pago=exitoso');
  await page.waitForTimeout(14000);

  console.log('   → total llamadas a /auth/me:', c.authMe);
  const plan = await leerPlan(page);
  console.log('   → planInfo final:', plan);
  expect(plan, 'tras reintentar, el pago tardío debe reflejarse').toContain('pro');
});
