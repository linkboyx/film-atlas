import fs from 'node:fs/promises';
import path from 'node:path';
const project=import.meta.dirname,research=path.resolve(project,'..','research');
const read=async(name,fallback=[])=>{try{return JSON.parse(await fs.readFile(path.join(research,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const legacyPath=path.join(research,'legacy-catalog-886.json');let legacy;
try{legacy=JSON.parse(await fs.readFile(legacyPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;legacy=JSON.parse(await fs.readFile(path.join(project,'dist/catalog.json'),'utf8')).films;if(legacy.length!==886)throw Error('Original catalog backup missing');await fs.writeFile(legacyPath,JSON.stringify(legacy,null,2));}
const sources=['films-expanded-imdb.json','films-expanded-classics.json','films-expanded-douban.json'];
const additions=(await Promise.all(sources.map(s=>read(s)))).flat();
const seeds=await read('imdb-expansion-seeds.json');const bySeed=new Map(seeds.map(s=>[s.id,s]));
const covers=await read('poster-manifest.json',{}),names=await read('chinese-title-matches.json',{});
const topMatches=await read('douban-imdb-matches.json');const doubanMatches=[...topMatches,...await read('douban-aka-matches.json')];
const charts=await read('douban-charts.json'),top=await read('douban-top250.json');
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s·•:：,，.。!?！？'’"“”()（）\-—《》]/g,'');
const cid=u=>u?.match(/subject\/(\d+)/)?.[1];
const chartIds=new Map(charts.map(c=>[String(c.id),c]));
const chartNames=new Map();for(const c of charts){const k=norm(c.title);if(!chartNames.has(k))chartNames.set(k,[]);chartNames.get(k).push(c);}
const matchedDouban=new Map();for(const d of doubanMatches){const id=d.imdbId||d.id;const record=d.doubanrecord||d.douban||d.record||d;if(id)matchedDouban.set(id,record);}
const map=new Map(legacy.map(f=>[f.id,{...f,legacySelection:true}]));
const union=(a=[],b=[])=>[...new Set([...a,...b].filter(Boolean))];
const texts=['countries','directors','cast','genres','aliases','reasons'];
for(const row of additions){const f=structuredClone(row);const id=f.imdb?.url?.match(/tt\d+/)?.[0]||f.id;if(!/^tt\d+$/.test(id)||f.year<1988||f.year>2026)throw Error('Invalid expanded movie identity '+f.title);
 if(!map.has(id)){map.set(id,{...f,id});continue;}const old=map.get(id);
 for(const key of texts.filter(k=>k!=='cast'&&k!=='directors'))old[key]=union(old[key],f[key]);
 for(const key of ['cast','directors']){const aliasKey=key==='cast'?'castAliases':'directorAliases';old[aliasKey]=union(old[aliasKey],union(old[key],f[key]));if(!old[key]?.length||!old.legacySelection&&f[key]?.some(n=>/[\u3400-\u9fff]/u.test(n)))old[key]=f[key];}
 old.sources=[...(old.sources||[]),...(f.sources||[])];old.awards=[...(old.awards||[]),...(f.awards||[])];
 if(!/[\u3400-\u9fff]/u.test(old.title)&&/[\u3400-\u9fff]/u.test(f.title))old.title=f.title;
 if(!old.poster&&f.poster)old.poster=f.poster;
 if(old.douban?.score==null&&f.douban?.score!=null)old.douban=f.douban;
 if(!old.boxOffice?.usd&&f.boxOffice?.usd)old.boxOffice=f.boxOffice;
 if(f.inclusion)old.inclusion={rules:union(old.inclusion?.rules,f.inclusion.rules)};
}
const ratings=new Map((await fs.readFile(path.join(research,'imdb-ratings.tsv'),'utf8')).trim().split(/\r?\n/).slice(1).map(s=>{const [id,r,v]=s.split('\t');return[id,{score:+r,votes:+v}];}));
const final=[];let nameCount=0;
for(const [id,f]of map){
 const seed=bySeed.get(id);if(seed){f.aliases=union(f.aliases,[seed.primaryTitle,seed.originalTitle]);f.boxOfficeChart=seed.boxOfficeChart||f.boxOfficeChart||[];if(seed.qualifiedRating)f.inclusion={rules:union(f.inclusion?.rules,['IMDb≥7.0且评价≥5000'])};if(f.boxOfficeChart.length)f.inclusion={rules:union(f.inclusion?.rules,f.boxOfficeChart.map(c=>`年度全球票房前100（${c.year}年第${c.rank}位）`))};}
 const nt=names[id];if(nt){f.aliases=union(f.aliases,nt.aliases);if(!/[\u3400-\u9fff]/u.test(f.title)){f.title=nt.preferred.title;nameCount++;}f.sources.push({label:'IMDb 官方中文片名与别名',url:'https://datasets.imdbws.com/title.akas.tsv.gz'});}
 let dm=matchedDouban.get(id);if(dm?.score!=null){f.douban={score:dm.score,votes:dm.votes,url:dm.url||dm.doubanUrl,checkedAt:'2026-11-01'};if(dm.title){f.aliases=union(f.aliases,[f.title]);f.title=dm.title;}if(!f.countries?.length&&dm.countries?.length)f.countries=dm.countries;if(!f.cast?.length&&dm.cast?.length)f.cast=dm.cast.slice(0,4);}
 let chart=chartIds.get(cid(f.douban?.url));
 // New subject associations come only from the explicit identity/country audit;
 // a similar Chinese title and a nearby release year are insufficient evidence.
 if(chart){f.douban={score:+chart.score,votes:chart.vote_count,url:chart.url,chartSource:chart.chartSource,checkedAt:'2026-11-01'};f.aliases=union(f.aliases,[f.title]);f.title=chart.title;if(chart.types?.length)f.genres=union(f.genres,chart.types);f.sources.push({label:'豆瓣电影 · 类型榜单评分',url:chart.chartSource||chart.url});}
 if(ratings.has(id))f.imdb={...f.imdb,...ratings.get(id),url:`https://www.imdb.com/title/${id}/`,checkedAt:'2026-11-01',datasetUrl:'https://datasets.imdbws.com/title.ratings.tsv.gz'};
 f.imdb??={score:null,votes:null,url:`https://www.imdb.com/title/${id}/`,checkedAt:null};f.douban??={score:null,votes:null,url:null,checkedAt:null};
 for(const k of texts)f[k]=Array.isArray(f[k])?[...new Set(f[k].filter(v=>v&&!/^(?:N\/A|unknown|\\N|null)$/i.test(v)))]:[];
 for(const k of ['imdb','douban']){if(typeof f[k].score!=='number'||f[k].score<=0||f[k].score>10)f[k].score=null;if(!Number.isFinite(f[k].votes))f[k].votes=null;}
 if(f.douban.score>=7.5&&f.douban.votes>=5000)f.inclusion={rules:union(f.inclusion?.rules,['豆瓣≥7.5且评价≥5000'])};
 f.metadataPending=!(f.countries.length&&f.directors.length&&f.cast.length);f.metadataStatus=f.metadataPending?'部分人物或地区资料待补核':'已补核人物与地区资料';
 try{const cm=JSON.parse(await fs.readFile(path.join(research,'cinemeta',id+'.json'),'utf8')).meta;if(cm?.awards&&[cm.id,cm.imdb_id].includes(id))f.awardsSummary={text:cm.awards,url:`https://v3-cinemeta.strem.io/meta/movie/${id}.json`,note:'公开元资料的获奖／提名数量汇总，未逐项核对具体类别；不作为奖项入选或获奖筛选依据。'};}catch(e){if(e.code!=='ENOENT')throw e;}
 f.posterRemote=f.posterRemote||f.poster||f.posterUrl||null;const cover=covers[id];
 if(cover?.path){const p=path.resolve(project,'dist',cover.path);if(!p.startsWith(path.resolve(project,'dist','posters')+path.sep))throw Error('Unsafe poster path '+p);await fs.access(p);f.poster=cover.path;f.posterLocal=true;f.posterSource={label:cover.sourceLabel,url:cover.sourcePage||cover.sourceUrl,imageUrl:cover.sourceUrl};}
 else{f.poster=f.posterRemote;f.posterLocal=false;}
 f.sources=[...new Map((f.sources||[]).filter(s=>s.label&&/^https?:\/\//.test(s.url)).map(s=>[s.url,s])).values()];
 if(f.posterSource?.url&&!f.sources.some(s=>s.url===f.posterSource.url))f.sources.push({label:'封面来源 · '+f.posterSource.label,url:f.posterSource.url});
 f.awards=[...new Map((f.awards||[]).filter(a=>a.text&&a.url).map(a=>[a.text+'|'+a.url,a])).values()];
 if(f.boxOffice)f.boxOffice.comparable=Boolean(f.boxOffice.usd)&&!/全球口径待复核/.test(f.boxOffice.scope||'');
 delete f.research;delete f.posterUrl;delete f.doubanPosterUrl;delete f.douban.title;delete f.douban.originalTitle;delete f.douban.year;
 final.push(f);
}
final.sort((a,b)=>a.year-b.year||a.title.localeCompare(b.title,'zh'));
const years=Array.from({length:39},(_,i)=>{const year=1988+i,a=final.filter(f=>f.year===year);return{year,count:a.length,imdb:a.filter(f=>f.imdb.score!==null).length,douban:a.filter(f=>f.douban.score!==null).length,gross:a.filter(f=>f.boxOffice?.comparable).length,posters:a.filter(f=>f.posterLocal).length,metadataComplete:a.filter(f=>!f.metadataPending).length};});
const discoveryCoverage={imdbQualified:(await read('imdb-qualified.json')).length,annualChartRows:(await read('boxoffice-top100.json')).length,annualChartMatchedRows:(await read('boxoffice-imdb-matches.json')).length,doubanCachedQualified:charts.filter(c=>+c.score>=7.5&&c.vote_count>=5000).length,doubanVerified:(await read('films-expanded-douban.json')).length,top250Verified:topMatches.length};
const meta={accessedAt:'2026-11-01',yearStart:1988,yearEnd:2026,ongoingYear:2026,count:final.length,years,edition:'扩展片库',criteria:{imdb:{score:7,votes:5000},douban:{score:7.5,votes:5000},annualWorldwideRank:100,importantAwards:true,annualLimit:null},discoveryCoverage,localPosters:final.filter(f=>f.posterLocal).length,metadataComplete:final.filter(f=>!f.metadataPending).length,sourceNotes:'1988—2026；无年度数量上限；缺失数据明确待补核；2026仅年内快照。'};
async function atomic(file,text){await fs.writeFile(file+'.tmp',text);await fs.rename(file+'.tmp',file);}
await atomic(path.join(project,'dist/data.js'),'window.FILM_META = '+JSON.stringify(meta)+';\nwindow.FILMS = '+JSON.stringify(final)+';\n');
await atomic(path.join(project,'dist/catalog.json'),JSON.stringify({meta,films:final},null,2));await atomic(path.join(project,'coverage.json'),JSON.stringify(meta,null,2));
console.log(JSON.stringify({films:final.length,new:final.length-legacy.length,localPosters:meta.localPosters,metadataComplete:meta.metadataComplete,imdb:final.filter(f=>f.imdb.score!==null).length,douban:final.filter(f=>f.douban.score!==null).length,chineseTitles:final.filter(f=>/[\u3400-\u9fff]/u.test(f.title)).length,renamedFromOfficialAliases:nameCount},null,2));
