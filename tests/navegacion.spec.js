const { test, expect } = require('@playwright/test');
const { preparar, PLAN_PRO } = require('./helpers');

// Pantallas sintéticas: ejercitan el wrapper vivo de nav() sin depender de que
// haya una granja cargada. No están en rutasProtegidas ni en NAV_ORDER.
async function montarPantallasFalsas(page) {
  await page.evaluate(() => {
    // `screens` se declara con const a nivel top: es global léxico, NO existe
    // como window.screens. Hay que tocarlo por el binding directo.
    window.__render = { t1: 0, t2: 0 };
    screens.__t1 = function () { window.__render.t1++; return '<div>T1</div>'; };
    screens.__t2 = function () { window.__render.t2++; return '<div>T2</div>'; };
  });
}

// ─── A4 — El nav diferido arranca al usuario de la pantalla que acaba de abrir
test('A4: un nav diferido no arranca al usuario de donde entró', async ({ page }) => {
  await preparar(page, { planCache: null, authMe: () => PLAN_PRO });
  await page.goto('./');
  await page.waitForTimeout(3000);
  await montarPantallasFalsas(page);

  const modo = await page.evaluate(() => {
    // El flujo real: se guarda un registro, sale el toast y se navega con retardo
    if (typeof _navDiferido === 'function') { _navDiferido('__t1', 400); }
    else { setTimeout(function () { nav('__t1'); }, 400); }   // patrón viejo
    // Dentro de esa ventana el usuario toca otra pantalla en la navBar
    nav('__t2');
    return typeof _navDiferido === 'function' ? 'con _navDiferido' : 'patrón viejo';
  });
  await page.waitForTimeout(1000);

  const final = await page.evaluate(() => _lastScreen);
  console.log(`   → modo: ${modo} | pantalla final: ${final} (el usuario pidió __t2)`);
  expect(final, 'debe quedarse donde el usuario tocó, no donde mandaba el timer').toBe('__t2');
});

// ─── A5 — Wrapper de animación sin guard de reentrancia: doble tap pinta las dos
test('A5: doble tap no pinta la pantalla intermedia', async ({ page }) => {
  await preparar(page, { planCache: null, authMe: () => PLAN_PRO });
  await page.goto('./');
  await page.waitForTimeout(3000);
  await montarPantallasFalsas(page);

  // Doble tap en la navBar dentro de la ventana de 80ms del wrapper
  await page.evaluate(() => { nav('__t1'); nav('__t2'); });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => ({ ...window.__render, final: _lastScreen }));
  console.log(`   → renders: __t1=${r.t1} (debe ser 0) __t2=${r.t2} | final: ${r.final}`);
  expect(r.t1, 'la pantalla intermedia NO debe renderizarse (flash)').toBe(0);
  expect(r.t2, 'la pantalla final debe renderizarse una sola vez').toBe(1);
  expect(r.final, 'debe terminar en la última que se pidió').toBe('__t2');
});

// Guard: que los 5 sitios reales sigan usando el helper y no vuelva el patrón viejo
test('A4: ningún setTimeout navega directo en el fuente publicado', async ({ page }) => {
  const res = await page.request.get('./index.html');
  const src = await res.text();
  // OJO con el regex: [^)]* no cruza el ")" de "function()", así que daba 0
  // incluso contra el código viejo. Hay que permitir paréntesis internos.
  const sueltos = src.match(/setTimeout\([^;]{0,60}nav\('/g) || [];
  const conHelper = src.match(/_navDiferido\('/g) || [];
  console.log(`   → setTimeout que navegan: ${sueltos.length} (debe ser 0) | _navDiferido: ${conHelper.length}`);
  expect(sueltos.length, 'no debe quedar ningún nav() diferido sin cancelar').toBe(0);
  expect(conHelper.length, 'los 5 sitios deben usar el helper').toBeGreaterThanOrEqual(5);
});
