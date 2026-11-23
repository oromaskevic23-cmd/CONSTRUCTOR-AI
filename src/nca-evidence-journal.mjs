// Single-process append-only evidence journal prototype. Not a transactional database.
// The caller must serialize appends. Hash chain detects tampering, not rollback of the entire file.
import {createHash} from "node:crypto";
import {open,readFile,mkdir} from "node:fs/promises";
import {dirname} from "node:path";
const digest = value => createHash("sha256").update(value).digest("hex");
export function verifyJournal(raw) {
  const lines=raw === "" ? [] : raw.split("\n");
  if(lines.at(-1)==="") lines.pop();
  let previous="0".repeat(64);
  let sequence=0;
  const entries=[];
  for(const line of lines) {
    if(!line) throw new Error("JOURNAL_CORRUPT");
    let entry;
    try {entry=JSON.parse(line);} catch {throw new Error("JOURNAL_CORRUPT");}
    if(!entry || entry.seq!==++sequence || entry.prev!==previous || typeof entry.kind!=="string" || !/^[A-Z_]{1,40}$/.test(entry.kind) || !Number.isSafeInteger(entry.at) || entry.at<0 || typeof entry.hash!=="string") throw new Error("JOURNAL_CORRUPT");
    const canonical=JSON.stringify({seq:entry.seq,prev:entry.prev,kind:entry.kind,at:entry.at,data:entry.data});
    if(digest(canonical)!==entry.hash) throw new Error("JOURNAL_TAMPERED");
    previous=entry.hash;
    entries.push(entry);
  }
  return {entries,head:previous,nextSeq:sequence+1};
}
export async function appendJournal(file,{kind,at,data},expectedHead) {
  if(typeof kind!=="string" || !/^[A-Z_]{1,40}$/.test(kind) || !Number.isSafeInteger(at) || at<0 || data===undefined) throw new TypeError("Invalid event");
  await mkdir(dirname(file),{recursive:true});
  const handle=await open(file,"a+",0o600);
  try {
    const raw=await handle.readFile("utf8");
    const verified=verifyJournal(raw);
    if(verified.head!==expectedHead) throw new Error("JOURNAL_HEAD_CONFLICT");
    const canonical=JSON.stringify({seq:verified.nextSeq,prev:verified.head,kind,at,data});
    const entry={seq:verified.nextSeq,prev:verified.head,kind,at,data,hash:digest(canonical)};
    // This reference requires one writer; a multi-process append can race.
    await handle.writeFile(JSON.stringify(entry)+"\n","utf8");
    await handle.sync();
    return entry;
  } finally {await handle.close();}
}
export async function loadJournal(file) {return verifyJournal(await readFile(file,"utf8"));}
export const EMPTY_JOURNAL_HEAD="0".repeat(64);
