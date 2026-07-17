const path = require('path');

// Por defecto corre contra el repo local servido en :5500 (puerto permitido por
// el CORS del backend). Con AVIGO_BASE corre contra el sitio publicado:
//   AVIGO_BASE=https://teccapitalweb.github.io/avigo-app/ npx playwright test
const base = process.env.AVIGO_BASE || 'http://localhost:5500';
const esLocal = base.includes('localhost');

module.exports = {
  testDir: __dirname,
  timeout: 45000,
  reporter: [['list']],
  use: { baseURL: base, headless: true },
  // Ojo: las rutas de goto() deben ser relativas ('./', './?pago=exitoso').
  // Con "/" el URL resuelve al root del dominio y NO carga la app en Pages.
  ...(esLocal
    ? {
        webServer: {
          command: 'npx serve -l 5500 ..',
          cwd: __dirname,
          port: 5500,
          reuseExistingServer: true,
          timeout: 60000,
        },
      }
    : {}),
};
