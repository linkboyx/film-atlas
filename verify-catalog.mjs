import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const {meta,films}=JSON.parse(await fs.readFile(new URL('./dist/catalog.json',import.meta.url),'utf8'));
assert(films.length>=7502,'Expanded input has not all been merged');assert.equal(meta.count,films.length);
assert.equal(new Set(films.map(f=>f.id)).size,films.length,'Duplicate movie ID');
for(let year=1988;year<=2026;year++){const count=films.filter(f=>f.year===year).length;assert(count>=20,`${year} coverage ${count}`);}
for(const f of films){
  assert(f.title&&f.originalTitle,`Missing title ${f.id}`);
  for(const key of ['countries','directors','cast','genres'])assert(Array.isArray(f[key]),`Invalid ${key}: ${f.title}`);
  assert.equal(f.metadataPending,!(f.countries.length&&f.directors.length&&f.cast.length),'Missing metadata not labelled '+f.title);
  assert(f.countries.every(c=>!/[A-Za-z]/.test(c)),`Untranslated country ${f.title}`);
  assert(f.sources?.length,`Missing sources ${f.title}`);
  for(const r of [f.imdb,f.douban]){assert(r.score===null||typeof r.score==='number'&&r.score>0&&r.score<=10,`Rating range ${f.title}`);if(r.score!==null){assert(r.url,`Missing rating source ${f.title}`);assert(r.votes>0,`Missing rating votes ${f.title}`);}}
  assert(f.imdb.url?.includes('/title/'+f.id+'/'),`IMDb identity mismatch ${f.title}`);
  if(f.boxOffice?.comparable){assert(f.boxOffice.usd>0);assert(!f.boxOffice.scope.includes('待复核'));}
  for(const src of f.sources)assert(['http:','https:'].includes(new URL(src.url).protocol));
  for(const a of f.awards)assert(a.text&&a.url,`Unsourced award ${f.title}`);
  assert(!f.research,`Raw research accidentally published ${f.title}`);
  const admission=f.inclusion?.imdbAtAdmission;
  const historicalImdb=admission?.score>=7&&admission?.votes>=5000&&/^\d{4}-\d{2}-\d{2}$/.test(admission?.checkedAt||'')&&admission?.datasetUrl==='https://datasets.imdbws.com/title.ratings.tsv.gz';
  if(!f.legacySelection)assert(f.imdb.score>=7&&f.imdb.votes>=5000||historicalImdb||f.douban.score>=7.5&&f.douban.votes>=5000||f.boxOfficeChart?.some(c=>c.rank>=1&&c.rank<=100)||f.awards.length,'Missing admission evidence '+f.title);
  if(f.posterLocal){assert(/^posters\/tt\d+\.(jpg|png|webp)$/.test(f.poster));const data=await fs.readFile(new URL('./dist/'+f.poster,import.meta.url));assert(data.length>1000,'Invalid local poster '+f.title);assert(data[0]===255&&data[1]===216||data.subarray(1,4).toString()==='PNG'||data.subarray(0,4).toString()==='RIFF','Non-image asset '+f.title);}
}
if(!process.argv.includes('--site-only')){
const seeds=JSON.parse(await fs.readFile(new URL('../research/imdb-expansion-seeds.json',import.meta.url),'utf8'));
const ids=new Set(films.map(f=>f.id));assert(seeds.every(s=>ids.has(s.id)),'Some qualified IMDb/annual-chart movies not ingested');
const top=JSON.parse(await fs.readFile(new URL('../research/douban-imdb-matches.json',import.meta.url),'utf8'));
assert(top.every(m=>ids.has(m.imdbId||m.id)),'A matched Top250 movie is missing');
}
const context={window:{}};vm.runInNewContext(await fs.readFile(new URL('./dist/data.js',import.meta.url),'utf8'),context);
assert.equal(JSON.stringify(context.window.FILMS),JSON.stringify(films),'JS/JSON snapshots differ');
assert.equal(JSON.stringify(context.window.FILM_META),JSON.stringify(meta),'JS/JSON metadata differ');
assert.deepEqual(JSON.parse(await fs.readFile(new URL('./coverage.json',import.meta.url),'utf8')),meta,'Coverage metadata differ');
console.log(JSON.stringify({passed:true,films:films.length,years:39,countries:new Set(films.flatMap(f=>f.countries)).size,imdb:films.filter(f=>f.imdb.score!==null).length,douban:films.filter(f=>f.douban.score!==null).length,reportedUsd:films.filter(f=>f.boxOffice?.usd).length,comparableGlobal:films.filter(f=>f.boxOffice?.comparable).length,awards:films.filter(f=>f.awards.length).length,localPosters:films.filter(f=>f.posterLocal).length,metadataComplete:films.filter(f=>!f.metadataPending).length}));
