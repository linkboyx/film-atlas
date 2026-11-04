import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {Readable, Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

export const datasetUrl = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const root = path.resolve(import.meta.dirname, '..');

export async function readRatings(ids, {ratingsFile} = {}) {
  let stream, compressed = false, sourceDate = null;
  if (ratingsFile) {
    stream = createReadStream(ratingsFile);
    compressed = ratingsFile.endsWith('.gz');
  } else {
    const response = await fetch(datasetUrl, {signal: AbortSignal.timeout(300_000)});
    if (!response.ok) throw Error(`IMDb download failed: HTTP ${response.status}`);
    const modified = response.headers.get('last-modified');
    if (modified && Number.isFinite(Date.parse(modified))) sourceDate = new Date(modified).toISOString().slice(0, 10);
    stream = Readable.fromWeb(response.body);
    compressed = true;
  }
  const ratings = new Map();
  let header = false;
  let pending = '';
  const parseLine = raw => {
    const line = raw.replace(/\r$/, '');
    if (!header) {
      assert.equal(line, 'tconst\taverageRating\tnumVotes', 'Unexpected IMDb TSV header');
      header = true;
      return;
    }
    if (!line) return;
    const [id, rawScore, rawVotes] = line.split('\t');
    if (!ids.has(id)) return;
    const score = Number(rawScore), votes = Number(rawVotes);
    assert(score > 0 && score <= 10 && Number.isInteger(votes) && votes > 0, `Invalid IMDb rating ${id}`);
    assert(!ratings.has(id), `Duplicate IMDb ID ${id}`);
    ratings.set(id, {score, votes});
  };
  const consume = new Writable({
    write(chunk, encoding, callback) {
      try {
        const lines = (pending + chunk.toString('utf8')).split('\n');
        pending = lines.pop();
        for (const line of lines) parseLine(line);
        callback();
      } catch (error) { callback(error); }
    },
    final(callback) {
      try { if (pending) parseLine(pending); callback(); }
      catch (error) { callback(error); }
    },
  });
  if (compressed) await pipeline(stream, createGunzip(), consume);
  else await pipeline(stream, consume);
  assert(header && ratings.size > 0, 'IMDb file contains no matching ratings');
  return {ratings, sourceDate};
}

export function updateCatalog(input, ratings, {checkedAt, sourceDate = null}) {
  const catalog = structuredClone(input);
  const {meta, films} = catalog;
  const criteria = meta.criteria?.imdb || {score: 7, votes: 5000};
  const previouslyRated = films.filter(f => f.imdb?.score != null).length;
  const matches = films.filter(f => ratings.has(f.id)).length;
  assert(matches >= Math.max(1, Math.ceil(previouslyRated * 0.95)), 'IMDb match rate below 95%; refusing a partial update');
  let changed = 0;
  for (const film of films) {
    const rating = ratings.get(film.id);
    if (!rating) continue; // Keep last verified value and its date for missing IDs.
    if (film.imdb?.score !== rating.score || film.imdb?.votes !== rating.votes) changed++;
    // Admission is historical: later score changes must not delete admitted films.
    if (film.imdb?.score >= criteria.score && film.imdb?.votes >= criteria.votes) {
      film.inclusion ??= {rules: []};
      film.inclusion.imdbAtAdmission ??= {
        score: film.imdb.score, votes: film.imdb.votes,
        checkedAt: film.imdb.checkedAt || meta.accessedAt,
        datasetUrl: film.imdb.datasetUrl || datasetUrl,
      };
    }
    film.imdb = {...film.imdb, ...rating, url: `https://www.imdb.com/title/${film.id}/`, checkedAt, datasetUrl};
    // A date from an old dataset must never survive a successful refresh.
    delete film.imdb.sourceDate;
    if (sourceDate) film.imdb.sourceDate = sourceDate;
  }
  // accessedAt remains the date of the full editorial snapshot.
  // Only IMDb was refreshed; do not make Douban or box-office look current.
  meta.imdbCheckedAt = checkedAt;
  meta.imdbSourceDate = sourceDate;
  meta.dataUpdatedAt = checkedAt;
  meta.updates = {...meta.updates, imdb: {checkedAt, sourceDate, matched: matches, changed, missing: films.length - matches, scope: 'existing-films'}};
  for (const year of meta.years) year.imdb = films.filter(f => f.year === year.year && f.imdb?.score != null).length;
  return catalog;
}

export async function refresh({project = root, ratingsFile, checkedAt = new Date().toISOString().slice(0, 10)} = {}) {
  const catalog = JSON.parse(await fs.readFile(path.join(project, 'dist/catalog.json'), 'utf8'));
  const {ratings, sourceDate} = await readRatings(new Set(catalog.films.map(f => f.id)), {ratingsFile});
  const updated = updateCatalog(catalog, ratings, {checkedAt, sourceDate});
  const outputs = [
    ['dist/catalog.json', JSON.stringify(updated, null, 2)],
    ['dist/data.js', 'window.FILM_META = ' + JSON.stringify(updated.meta) + ';\nwindow.FILMS = ' + JSON.stringify(updated.films) + ';\n'],
    ['coverage.json', JSON.stringify(updated.meta, null, 2)],
  ];
  for (const [name, content] of outputs) await fs.writeFile(path.join(project, name) + '.tmp', content);
  for (const [name] of outputs) await fs.rename(path.join(project, name) + '.tmp', path.join(project, name));
  console.log(JSON.stringify(updated.meta.updates.imdb));
  return updated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert(args.length === 0 || args.length === 2 && args[0] === '--ratings', 'Usage: node scripts/update-imdb.mjs [--ratings path/to/title.ratings.tsv[.gz]]');
  await refresh({ratingsFile: args[1]});
}

