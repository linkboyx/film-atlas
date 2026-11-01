import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const {meta,films}=JSON.parse(await fs.readFile(new URL('./dist/catalog.json',import.meta.url),'utf8'));
assert.equal(films.length,886);assert.equal(meta.count,films.length);
assert.equal(new Set(films.map(f=>f.id)).size,films.length,'Duplicate movie ID');
for(let year=1988;year<=2026;year++){const count=films.filter(f=>f.year===year).length;assert(count>=20&&count<=30,`${year} coverage ${count}`);}
for(const f of films){
  assert(f.title&&f.originalTitle,`Missing title ${f.id}`);
  for(const key of ['countries','directors','cast','genres'])assert(f[key]?.length,`Missing ${key}: ${f.title}`);
  assert(f.countries.every(c=>!/[A-Za-z]/.test(c)),`Untranslated country ${f.title}`);
  assert(f.sources?.length,`Missing sources ${f.title}`);
  for(const r of [f.imdb,f.douban]){assert(r.score===null||typeof r.score==='number'&&r.score>0&&r.score<=10,`Rating range ${f.title}`);if(r.score!==null){assert(r.url,`Missing rating source ${f.title}`);assert(r.votes>0,`Missing rating votes ${f.title}`);}}
  assert(f.imdb.url?.includes('/title/'+f.id+'/'),`IMDb identity mismatch ${f.title}`);
  if(f.boxOffice?.comparable){assert(f.boxOffice.usd>0);assert(!f.boxOffice.scope.includes('待复核'));}
  for(const src of f.sources)assert(['http:','https:'].includes(new URL(src.url).protocol));
  for(const a of f.awards)assert(a.text&&a.url,`Unsourced award ${f.title}`);
  assert(!f.research,`Raw research accidentally published ${f.title}`);
}
const context={window:{}};vm.runInNewContext(await fs.readFile(new URL('./dist/data.js',import.meta.url),'utf8'),context);
assert.equal(JSON.stringify(context.window.FILMS),JSON.stringify(films),'JS/JSON snapshots differ');
console.log(JSON.stringify({passed:true,films:films.length,years:39,countries:new Set(films.flatMap(f=>f.countries)).size,imdb:films.filter(f=>f.imdb.score!==null).length,douban:films.filter(f=>f.douban.score!==null).length,reportedUsd:films.filter(f=>f.boxOffice?.usd).length,comparableGlobal:films.filter(f=>f.boxOffice?.comparable).length,awards:films.filter(f=>f.awards.length).length}));
