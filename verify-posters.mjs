import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const project=import.meta.dirname,research=path.resolve(project,'..','research');
const manifest=JSON.parse(await fs.readFile(path.join(research,'poster-manifest.json'),'utf8'));
const rows=Object.entries(manifest),errors=[],hashes=new Map();let valid=0,bytes=0,index=0;
function format(b){if(b[0]===255&&b[1]===216&&b[2]===255)return'jpg';if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'png';if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return'webp';return null;}
async function work(){while(index<rows.length){const [id,p]=rows[index++];if(!p.path)continue;try{if(!/^posters\/tt\d+\.(jpg|jpeg|png|webp)$/.test(p.path))throw new Error('Unexpected local path');const b=await fs.readFile(path.join(project,'dist',p.path)),ext=format(b);if(!ext)throw new Error('Image magic invalid');if(b.length!==p.bytes)throw new Error('Byte length differs');if(b.length<1000)throw new Error('Image too small');const sha=crypto.createHash('sha256').update(b).digest('hex');if(p.sha256&&p.sha256!==sha)throw new Error('SHA256 differs');const same=hashes.get(sha)||[];same.push(id);hashes.set(sha,same);valid++;bytes+=b.length;}catch(e){errors.push({id,path:p.path,error:e.message});}}}
await Promise.all(Array.from({length:8},work));
const report={checkedAt:'2026-11-01',manifestEntries:rows.length,localImages:valid,missing:rows.filter(([,p])=>!p.path).length,totalBytes:bytes,errors,duplicateImages:[...hashes.values()].filter(v=>v.length>1)};
await fs.writeFile(path.join(research,'poster-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
