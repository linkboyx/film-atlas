import fs from 'node:fs/promises';
const file=new URL('./dist/app.js',import.meta.url);let s=await fs.readFile(file,'utf8');
const edits=[
 ['g=films.filter(f=>f.boxOffice?.usd).length','g=films.filter(f=>f.boxOffice?.comparable).length'],
 ['“票房大片”采用已核实全球累计票房 ≥ 5 亿美元。','“票房大片”采用来源已报告的全球票房 ≥ 5 亿美元；全球口径待复核的金额不通过票房门槛。'],
 ['来自可访问的 ${external(\'https://movie.douban.com/top250\',\'豆瓣榜单\')}与影片页','来自可访问的 ${external(\'https://movie.douban.com/top250\',\'豆瓣榜单\')}、公开类型榜单与站内搜索结果'],
 ['今天是 2026 年 11 月 1 日。','本次整理截至 2026 年 11 月 1 日。'],
 ["<td>${gross(f.boxOffice?.usd)}</td>","<td>${gross(f.boxOffice?.usd)}${f.boxOffice?.usd&&!f.boxOffice.comparable?'<br><small>全球口径待复核</small>':''}</td>"],
 ['美元 · ${safe(f.boxOffice.scope','${n(f.boxOffice.usd)} 美元 · ${safe(f.boxOffice.scope'],
 ['缺失数值不通过对应数值筛选。','缺失数值不通过对应数值筛选。部分资料页虽记录金额，全球统计范围尚待复核，详情及表格会作标注；这些金额不参与全球票房门槛和排名。'],
 ['全球累计票房_USD','来源所载票房_USD'],
 ['票房口径\',\'票房说明','可参与全球票房比较\',\'票房口径\',\'票房说明'],
 ['f.boxOffice?.usd,f.boxOffice?.scope','f.boxOffice?.usd,f.boxOffice?.comparable?\'是\':\'否\',f.boxOffice?.scope'],
 ["const a=films.filter(f=>f.year===y);return", "const a=films.filter(f=>f.year===y);return"],
 ["a.filter(f=>f.boxOffice?.usd).length}</td>","a.filter(f=>f.boxOffice?.comparable).length}</td>"],
 ['<th>全球票房</th>','<th>全球口径票房</th>']
];for(const [from,to]of edits){if(s.includes(from))s=s.replace(from,to);}
await fs.writeFile(file,s);
const p=new URL('./dist/index.html',import.meta.url);let h=await fs.readFile(p,'utf8');h=h.replace('2026 年持续更新 · 尚非全年结果','2026 年内快照 · 尚非全年结果');await fs.writeFile(p,h);
