// CONSTRUCTOR AI: deterministic ZIP export of validated model drafts. No code execution.
import {createHash} from 'node:crypto';
import {parseModelDraft} from './draft-contract.mjs';

const crcTable = Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(entries){
  const local=[],central=[];let offset=0;
  for(const [name,data] of entries){
    const n=Buffer.from(name),d=Buffer.from(data),crc=crc32(d);
    if(n.length>65535||d.length>0xffffffff)throw Error('ZIP limits exceeded');
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);h.writeUInt32LE(d.length,18);h.writeUInt32LE(d.length,22);h.writeUInt16LE(n.length,26);
    local.push(h,n,d);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(d.length,20);c.writeUInt32LE(d.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
    central.push(c,n);offset+=h.length+n.length+d.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}
export function exportValidatedDraftZip(raw){
  const {draft,sha256}=parseModelDraft(raw);
  const files=draft.files.map(f=>[f.path,f.content]);
  if(files.some(([p])=>p.toLowerCase()==='manifest.json'||p.toLowerCase()==='draft-summary.md'))throw Error('Reserved export filename');
  const manifest={schema:'constructor_export_v1',draftSha256:sha256,mode:'UNTRUSTED_DRAFT_NOT_EXECUTED',files:files.map(([path,content])=>({path,sha256:createHash('sha256').update(content).digest('hex')}))};
  const entries=[...files,['draft-summary.md','# Untrusted AI draft — NOT BUILT OR TESTED\n\n'+draft.summary+'\n'],['manifest.json',JSON.stringify(manifest,null,2)+'\n']].sort(([a],[b])=>a.localeCompare(b,'en'));
  return {zip:zip(entries),manifest};
}
