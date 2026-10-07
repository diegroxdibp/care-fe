import type { Config } from 'jest';
import base from './jest.config.ts';

/*
 * Corre os *.browser-zone-amsterdam.spec.ts com o processo em Amesterdão.
 * Mesmo truque do jest.browser-zone.config.ts (ver lá o porquê do TZ aqui e
 * do --runInBand).
 *
 * Existe por causa de 06/10/2026: perfil em Lisboa, computador nos Países
 * Baixos - uma hora de diferença o ano todo, e o par onde o bug real
 * aconteceu. São Paulo apanha a mesma classe de bug, mas não reproduz o caso.
 */
process.env['TZ'] = 'Europe/Amsterdam';

const config: Config = {
  ...base,
  testMatch: ['<rootDir>/src/**/*.browser-zone-amsterdam.spec.ts'],
};

export default config;
