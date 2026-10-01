import type { Config } from 'jest';
import base from './jest.config.ts';

/*
 * Corre os *.browser-zone.spec.ts com o processo em São Paulo, como o browser
 * de uma pessoa no Brasil. A suite normal corre em UTC/Lisboa — iguais no
 * inverno —, onde um `new Date('yyyy-MM-dd')` (meia-noite UTC) passa
 * despercebido.
 *
 * Tem de ser aqui e com --runInBand: no Windows o Node ignora TZ no arranque
 * mas respeita-o se for atribuído em runtime, e o process.env que cada teste
 * vê é uma cópia — só este processo (o do config) o muda de verdade.
 */
process.env['TZ'] = 'America/Sao_Paulo';

const config: Config = {
  ...base,
  testMatch: ['<rootDir>/src/**/*.browser-zone.spec.ts'],
};

export default config;
