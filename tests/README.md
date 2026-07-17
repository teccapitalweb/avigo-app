# Pruebas e2e de AviGo

Cubren los flujos que cuestan dinero o pierden datos. Cada test reproduce un bug
real que estuvo en producción: si alguno se pone rojo, el bug volvió.

No forman parte del sitio publicado. Pages sirve esta carpeta, pero nada de
`index.html` la carga.

## Instalar

```bash
cd tests
npm install
npm run install:browser    # descarga Chromium (solo la primera vez)
```

## Correr

```bash
npm test                   # contra el repo local, servido en :5500
npm run test:prod          # contra https://teccapitalweb.github.io/avigo-app/
npm test -- dinero.spec.js # un solo archivo
npm test -- --headed       # viendo el navegador
```

El puerto **5500 no es casual**: el CORS del backend solo permite 3000, 8080 y
5500 en local. No lo cambies sin tocar también `src/server.js` del backend.

## Qué cubre

| Archivo | Escenario | Bug que vigila |
|---|---|---|
| `dinero.spec.js` | A1 | Doble modal "¡Ya eres Pro!" con el botón visible inerte |
| | A2 | El lock de "prueba terminada" atrapa a quien acaba de pagar |
| | A3 | `?pago=exitoso` se borraba antes de verificarse |
| | C6 | Volver a la app no refrescaba el plan (Pro invisible en TWA) |
| | C7 | Webhook tardío de Stripe: se cacheaba "free" para siempre |
| `navegacion.spec.js` | A4 | Un `nav()` diferido arrancaba al usuario de donde entró |
| | A5 | Doble tap pintaba la pantalla intermedia (flash) |
| | — | Guard de fuente: que no vuelva el patrón `setTimeout(...nav(...))` |
| `observabilidad.spec.js` | C8 | Errores y rejections sin reportar a nadie |
| `beacon-real.spec.js` | C8 | El beacon llega al backend REAL (sin mocks) |

`beacon-real.spec.js` pega a Railway de verdad. Los demás mockean el backend con
`page.route`, así que corren offline y sin tocar datos reales.

## Trampas al escribir tests aquí

Las tres costaron un rato. Si algo "pasa" sospechosamente rápido, revisa esto:

1. **En Playwright gana la ÚLTIMA ruta registrada.** El catch-all de `${API}/**`
   va *primero* en `helpers.js`; si lo pones al final se come `/auth/me` y los
   contadores dan 0.
2. **`goto()` debe ser relativo** (`'./'`, `'./?pago=exitoso'`). Con `'/'` el URL
   resuelve al root del dominio: en producción carga otra página y los tests dan
   falsos positivos (un test "pasa" porque la app nunca cargó).
3. **`screens` se declara con `const`**, así que existe como global léxico pero
   **no** como `window.screens`. Tócalo por el binding directo dentro de
   `page.evaluate`.

## Lo que esto NO puede probar

Requiere el dispositivo real (TWA):

- El retorno del pago dentro de la app Android: el checkout abre **fuera** del
  webview y el puente `ReactNativeWebView` no existe en un navegador. C6 aquí se
  prueba con `visibilitychange`, que es el mecanismo, pero no el puente.
- La app en background durante días (token vencido + cola de sync).
- El checkout real de Stripe con tarjeta real y su webhook en producción.
- Notificaciones push llegando de verdad.
- El GPS pisando la temperatura escrita a mano.
