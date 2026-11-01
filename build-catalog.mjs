import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..','research');
const all=(await Promise.all(['films-1988-2000.json','films-2001-2013.json','films-2014-2026.json'].map(async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'))))).flat();
const charts=JSON.parse(await fs.readFile(path.join(root,'douban-charts.json'),'utf8').catch(()=>'[]'));
const top=JSON.parse(await fs.readFile(path.join(root,'douban-top250.json'),'utf8'));
const ratings=new Map((await fs.readFile(path.join(root,'imdb-ratings.tsv'),'utf8')).trim().split(/\r?\n/).slice(1).map(s=>{const [id,r,v]=s.split('\t');return[id,{score:+r,votes:+v}]}));
const cid=u=>u?.match(/subject\/(\d+)/)?.[1];
const byId=new Map(charts.map(r=>[r.id,r]));
const norm=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[\s·•:：,，.。!?！？'’"“”()（）\-—《》]/g,'');
const groups=new Map();for(const r of charts){const k=norm(r.title);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
const countryNames={Hungary:'匈牙利',Iceland:'冰岛',Jordan:'约旦',Mexico:'墨西哥',Netherlands:'荷兰'};
const people={'Christopher Nolan':'克里斯托弗·诺兰','Steven Spielberg':'史蒂文·斯皮尔伯格','James Cameron':'詹姆斯·卡梅隆','David Fincher':'大卫·芬奇','Quentin Tarantino':'昆汀·塔伦蒂诺','Martin Scorsese':'马丁·斯科塞斯','Ridley Scott':'雷德利·斯科特','Peter Jackson':'彼得·杰克逊','Tim Burton':'蒂姆·伯顿','Robert Zemeckis':'罗伯特·泽米吉斯','Frank Darabont':'弗兰克·德拉邦特','Ang Lee':'李安','Zhang Yimou':'张艺谋','Chen Kaige':'陈凯歌','Wong Kar-wai':'王家卫','Stephen Chow':'周星驰','John Woo':'吴宇森','Johnnie To':'杜琪峰','Tsui Hark':'徐克','Jiang Wen':'姜文','Jia Zhangke':'贾樟柯','Edward Yang':'杨德昌','Hou Hsiao-hsien':'侯孝贤','Hayao Miyazaki':'宫崎骏','Isao Takahata':'高畑勋','Satoshi Kon':'今敏','Hirokazu Kore-eda':'是枝裕和','Takeshi Kitano':'北野武','Shunji Iwai':'岩井俊二','Bong Joon-ho':'奉俊昊','Park Chan-wook':'朴赞郁','Lee Chang-dong':'李沧东','Aamir Khan':'阿米尔·汗','Rajkumar Hirani':'拉库马·希拉尼','Akira Kurosawa':'黑泽明','Luc Besson':'吕克·贝松','Giuseppe Tornatore':'朱塞佩·托纳多雷','Roberto Benigni':'罗伯托·贝尼尼','Wes Anderson':'韦斯·安德森','Denis Villeneuve':'丹尼斯·维伦纽瓦','Alfonso Cuarón':'阿方索·卡隆','Guillermo del Toro':'吉尔莫·德尔·托罗','Tom Hanks':'汤姆·汉克斯','Leonardo DiCaprio':'莱昂纳多·迪卡普里奥','Brad Pitt':'布拉德·皮特','Morgan Freeman':'摩根·弗里曼','Tim Robbins':'蒂姆·罗宾斯','Tom Cruise':'汤姆·克鲁斯','Johnny Depp':'约翰尼·德普','Keanu Reeves':'基努·里维斯','Christian Bale':'克里斯蒂安·贝尔','Natalie Portman':'娜塔莉·波特曼','Kate Winslet':'凯特·温斯莱特','Jim Carrey':'金·凯瑞','Leslie Cheung':'张国荣','Tony Leung Chiu-wai':'梁朝伟','Tony Leung':'梁朝伟','Andy Lau':'刘德华','Gong Li':'巩俐','Ge You':'葛优','Jackie Chan':'成龙','Jet Li':'李连杰','Chow Yun-fat':'周润发','Maggie Cheung':'张曼玉','Michelle Yeoh':'杨紫琼','Daniel Radcliffe':'丹尼尔·雷德克里夫','Emma Watson':'艾玛·沃森','Rupert Grint':'鲁伯特·格林特'};
const bilingual=v=>people[v]?`${people[v]}（${v}）`:v;
const result=[];const seen=new Set();const audit=[];
for(const f of all){
  if(f.year<1988||f.year>2026)throw new Error(`Year outside bounds ${f.title}`);
  const imdbId=f.imdb?.url?.match(/tt\d+/)?.[0];
  const key=imdbId||f.year+'-'+norm(f.originalTitle||f.title);
  if(seen.has(key)){audit.push({duplicate:f.title,imdbId,year:f.year});continue;}seen.add(key);
  if(imdbId&&ratings.has(imdbId)){f.imdb={...f.imdb,...ratings.get(imdbId),checkedAt:'2026-11-01',datasetUrl:'https://datasets.imdbws.com/title.ratings.tsv.gz'};}
  let d=byId.get(cid(f.douban?.url));
  if(!d){const t=top.find(r=>norm(r.title)===norm(f.title)&&r.year===f.year||r.originalTitle&&norm(r.originalTitle)===norm(f.originalTitle)&&r.year===f.year);if(t){f.douban={...t,url:t.url};d=byId.get(cid(t.url));}}
  if(!d){const rows=groups.get(norm(f.title))||[];const candidates=rows.filter(r=>r.release_date&&Math.abs(+r.release_date.slice(0,4)-f.year)<=1);if(candidates.length===1){d=candidates[0];audit.push({chartMatch:f.title,year:f.year,doubanId:d.id,releaseDate:d.release_date});}}
  if(d){f.douban={...f.douban,score:+d.score,votes:d.vote_count,url:d.url,checkedAt:'2026-11-01',chartSource:d.chartSource};f.poster=d.cover_url||f.poster;f.genres=d.types?.length?d.types:f.genres;}
  f.countries=[...new Set((f.countries||[]).map(c=>countryNames[c]||c))];
  f.directors=(f.directors||[]).map(bilingual);f.cast=(f.cast||[]).map(bilingual);
  f.poster=f.poster||f.doubanPosterUrl||f.posterUrl||null;
  if(f.poster)try{const u=new URL(f.poster);for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_'))u.searchParams.delete(k);f.poster=u.toString();}catch{f.poster=null;}
  f.originalTitle=f.originalTitle.replace(/\s+'\s*/g,"'");
  if(!f.douban)f.douban={score:null,votes:null,url:null,checkedAt:null};
  if(!f.imdb)f.imdb={score:null,votes:null,url:null,checkedAt:null};
  for(const type of ['imdb','douban']){if(typeof f[type].score!=='number'||f[type].score<=0||f[type].score>10)f[type].score=null;if(f[type].votes&&!Number.isFinite(f[type].votes))f[type].votes=null;}
  f.id=imdbId||f.id;
  f.sources=(f.sources||[]).filter(s=>s.url&&s.label);
  if(f.imdb?.score!==null)f.sources.push({label:'IMDb 官方评分数据集',url:'https://datasets.imdbws.com/title.ratings.tsv.gz'});
  if(f.douban?.score!==null)f.sources.push({label:'豆瓣电影 · 评分来源',url:f.douban.chartSource||f.douban.url});
  f.sources=[...new Map(f.sources.map(s=>[s.url,s])).values()];
  delete f.research;delete f.sourceCheckDate;delete f.douban.title;delete f.douban.originalTitle;delete f.douban.year;
  f.awards=(f.awards||[]).filter(a=>typeof a==='object'&&a.text&&a.url);
  if(f.boxOffice)f.boxOffice.comparable=Boolean(f.boxOffice.usd)&&!/全球口径待复核/.test(f.boxOffice.scope||'');
  if(f.boxOffice?.usd&&(!Number.isFinite(f.boxOffice.usd)||f.boxOffice.usd<1000||f.boxOffice.usd>5e9)){audit.push({invalidGross:f.title,value:f.boxOffice.usd});f.boxOffice.usd=null;}
  result.push(f);
}
result.sort((a,b)=>a.year-b.year||a.title.localeCompare(b.title,'zh'));
const years=Array.from({length:39},(_,i)=>{const y=1988+i,a=result.filter(f=>f.year===y);return{year:y,count:a.length,imdb:a.filter(f=>f.imdb.score!==null).length,douban:a.filter(f=>f.douban.score!==null).length,gross:a.filter(f=>f.boxOffice?.usd).length,awards:a.filter(f=>f.awards.length).length};});
const meta={accessedAt:'2026-11-01',yearStart:1988,yearEnd:2026,ongoingYear:2026,count:result.length,years,sourceNotes:'公开来源访问日期；不是所有来源的更新时间。2026为年内数据，评分非实时。'};
await fs.writeFile(path.join(import.meta.dirname,'dist','data.js'),'window.FILM_META = '+JSON.stringify(meta)+';\nwindow.FILMS = '+JSON.stringify(result)+';\n');
await fs.writeFile(path.join(import.meta.dirname,'dist','catalog.json'),JSON.stringify({meta,films:result},null,2));
await fs.writeFile(path.join(root,'catalog-merge-audit.json'),JSON.stringify(audit,null,2));
await fs.writeFile(path.join(import.meta.dirname,'coverage.json'),JSON.stringify(meta,null,2));
console.log(JSON.stringify({total:result.length,imdb:years.reduce((n,y)=>n+y.imdb,0),douban:years.reduce((n,y)=>n+y.douban,0),gross:years.reduce((n,y)=>n+y.gross,0),awards:years.reduce((n,y)=>n+y.awards,0),years,duplicates:audit.filter(a=>a.duplicate)},null,2));
