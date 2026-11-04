import fs from 'node:fs/promises';
const file=new URL('./dist/app.js',import.meta.url);let s=await fs.readFile(file,'utf8');
s=s.replace('<small>THE FILM ATLAS / ${f.year}</small>',"<small>${f.posterLocal?'THE FILM ATLAS':'封面待补'} / ${f.year}</small>");
s=s.replace('...list(f.cast),...list(f.aliases)','...list(f.cast),...list(f.castAliases),...list(f.directorAliases),...list(f.aliases)');
if(!s.includes('<dt>奖项汇总</dt>'))s=s.replace('</dd></dl><div class="detail-actions">','</dd>${f.awardsSummary?`<dt>奖项汇总</dt><dd>${safe(f.awardsSummary.text)}<small>${safe(f.awardsSummary.note)}</small>${external(f.awardsSummary.url,\'汇总来源\')}</dd>`:\'\'}</dl><div class="detail-actions">');
if(!s.includes("'入选理由','入选依据'")){s=s.replace("'入选理由','IMDb来源'","'入选理由','入选依据','IMDb来源'");s=s.replace("list(f.reasons).join(' / '),f.imdb?.url","list(f.reasons).join(' / '),list(f.inclusion?.rules).join('；'),f.imdb?.url");}
if(!s.includes('本次检索的实际覆盖'))s=s.replace('<h3>评分、票房与年份的口径</h3>','<h3>本次检索的实际覆盖</h3><p>IMDb 官方数据中符合当前年份、影片类型、评分及票数门槛的 ${n(meta.discoveryCoverage?.imdbQualified||0)} 部已按 ID 纳入。年度票房榜共 ${n(meta.discoveryCoverage?.annualChartRows||0)} 条，其中 ${n(meta.discoveryCoverage?.annualChartMatchedRows||0)} 条已匹配电影身份；其余包含重映、年代外影片及尚未唯一匹配的条目。豆瓣已取得的类型榜单中有 ${n(meta.discoveryCoverage?.doubanCachedQualified||0)} 条达到分数和票数门槛，其中 ${n(meta.discoveryCoverage?.doubanVerified||0)} 部通过电影身份与年份核对。未通过唯一匹配的候选不强行入库，现有来源也不覆盖豆瓣全部电影。</p><h3>评分、票房与年份的口径</h3>');
await fs.writeFile(file,s);
