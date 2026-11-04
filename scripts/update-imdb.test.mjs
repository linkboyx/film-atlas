import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {updateCatalog, refresh, readRatings, datasetUrl} from './update-imdb.mjs';
const projectRoot = path.resolve(import.meta.dirname, '..');

const film = id => ({id, year: 2000, title: id, imdb: {score: 7.1, votes: 6000, checkedAt: '2026-11-01', sourceDate: '2026-10-31'}, douban: {score: 8, checkedAt: '2026-11-01'}, inclusion: {rules: ['IMDb≥7.0且评价≥5000']}});
const catalog = () => ({meta: {accessedAt: '2026-11-01', count: 1, criteria: {imdb: {score: 7, votes: 5000}}, years: [{year: 2000, imdb: 1}]}, films: [film('tt0000001')]});

test('rating drops retain historical admission and other source dates', () => {
  const original = catalog();
  const updated = updateCatalog(original, new Map([['tt0000001', {score: 6.9, votes: 7000}]]), {checkedAt: '2026-11-02'});
  assert.equal(updated.films[0].imdb.score, 6.9);
  assert.equal(updated.films[0].imdb.checkedAt, '2026-11-02');
  assert.equal(updated.films[0].imdb.sourceDate, undefined);
  assert.equal(updated.films[0].inclusion.imdbAtAdmission.score, 7.1);
  assert.deepEqual(updated.films[0].douban, original.films[0].douban);
  assert.equal(updated.meta.accessedAt, original.meta.accessedAt);
  assert.equal(original.films[0].imdb.score, 7.1);
});

test('partial downloads cannot replace a catalog', () => {
  assert.throws(() => updateCatalog(catalog(), new Map(), {checkedAt: '2026-11-02'}), /match rate/);
});

test('an ID missing in a near-complete dataset retains its previous verified rating', () => {
  const input = catalog();
  input.films = Array.from({length: 20}, (_, i) => film(`tt${String(i + 1).padStart(7, '0')}`));
  const ratings = new Map(input.films.slice(1).map(f => [f.id, {score: 8, votes: 8000}]));
  const updated = updateCatalog(input, ratings, {checkedAt: '2026-11-02'});
  assert.deepEqual(updated.films[0], input.films[0]);
  assert.equal(updated.meta.updates.imdb.missing, 1);
});

test('gzip input produces matching JSON, browser script and coverage snapshots', async t => {
  const temp = await fs.mkdtemp(path.join(projectRoot, '.film-atlas-test-update-'));
  t.after(() => fs.rm(temp, {recursive: true, force: true}));
  await fs.mkdir(path.join(temp, 'dist'));
  await fs.writeFile(path.join(temp, 'dist/catalog.json'), JSON.stringify(catalog()));
  const ratingsFile = path.join(temp, 'ratings.tsv.gz');
  await fs.writeFile(ratingsFile, gzipSync('tconst\taverageRating\tnumVotes\ntt0000001\t8.2\t9123\ntt9999999\t9.0\t50000\n'));
  const updated = await refresh({project: temp, ratingsFile, checkedAt: '2026-11-02'});
  const context = {window: {}};
  vm.runInNewContext(await fs.readFile(path.join(temp, 'dist/data.js'), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.FILMS)), updated.films);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(temp, 'dist/catalog.json'), 'utf8')), updated);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(temp, 'coverage.json'), 'utf8')), updated.meta);
  assert.equal(updated.films[0].imdb.datasetUrl, datasetUrl);
  assert.equal(updated.films.length, 1);
});

test('bad TSV, invalid ratings, and truncated gzip downloads fail validation', async t => {
  const temp = await fs.mkdtemp(path.join(projectRoot, '.film-atlas-test-invalid-'));
  t.after(() => fs.rm(temp, {recursive: true, force: true}));
  const ratingsFile = path.join(temp, 'ratings.tsv');
  for (const text of ['bad header\n', 'tconst\taverageRating\tnumVotes\ntt0000001\t12\t50\n', 'tconst\taverageRating\tnumVotes\ntt0000001\t8\t50\ntt0000001\t9\t100\n']) {
    await fs.writeFile(ratingsFile, text);
    await assert.rejects(readRatings(new Set(['tt0000001']), {ratingsFile}));
  }
  const compressed = gzipSync('tconst\taverageRating\tnumVotes\ntt0000001\t8\t50\n');
  await fs.writeFile(ratingsFile + '.gz', compressed.subarray(0, compressed.length - 5));
  await assert.rejects(readRatings(new Set(['tt0000001']), {ratingsFile: ratingsFile + '.gz'}));
});
