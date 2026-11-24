/**
 * Chargement serveur/test du script classique `catalogue-meta.js`.
 * Le navigateur l'expose via `window.CatalogueMeta` ; Node l'évalue dans
 * un bac VM pour conserver UNE seule implémentation des listes runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const FICHIER = path.join(ICI, 'catalogue-meta.js');

const code = fs.readFileSync(FICHIER, 'utf-8');
const bac = { window: {}, module: { exports: {} }, exports: {}, console };
vm.createContext(bac);
vm.runInContext(code, bac, { filename: FICHIER, timeout: 5000 });

const api = bac.window.CatalogueMeta || bac.module.exports;
if (!api || typeof api.analyserCatalogue !== 'function') {
  throw new Error('catalogue-meta.js : API CatalogueMeta introuvable.');
}

export const analyserCatalogue = api.analyserCatalogue;
export const comparerAnalyses = api.comparerAnalyses;
export const typeDe = api.typeDe;
export const montageDe = api.montageDe;
export const estTriptyque = api.estTriptyque;
export const estIncertaine = api.estIncertaine;
export const normaliserValeur = api.normaliserValeur;
export const slugifier = api.slugifier;
export const labeliser = api.labeliser;
