import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {fetchBounded,parseBoundedJson} from '../engineering/model-response-boundary.mjs';
const base={url:'http://fixture.invalid',maxBytes:1024,timeoutMs:2000,ttfbMs:500,idleMs:100};
test('overflow mid-stream ignores false Content-Length and cancels the reader',async()=>{
 let reads=0,cancelled=false,signal;
 const stream=new ReadableStream({pull(c){reads++;c.enqueue(new Uint8Array(400));},cancel(){cancelled=true;}});
 await assert.rejects(fetchBounded({...base,fetchImpl:async(_,o)=>{signal=o.signal;return new Response(stream,{headers:{'Content-Length':'1'}});}}),/RESPONSE_TOO_LARGE/);
 assert.equal(cancelled,true);assert.equal(signal.aborted,true);assert.ok(reads<8);
});
test('UTF-8 counts bytes rather than characters; invalid UTF-8 fails closed',async()=>{
 await assert.rejects(fetchBounded({...base,fetchImpl:async()=>new Response('Ж'.repeat(600))}),/RESPONSE_TOO_LARGE/);
 await assert.rejects(fetchBounded({...base,fetchImpl:async()=>new Response(new Uint8Array([255]))}),/RESPONSE_BODY_UNREADABLE/);
});
test('JSON depth and truncation rejected; quoted braces do not increase depth',()=>{
 assert.throws(()=>parseBoundedJson('['.repeat(25)+'0'+']'.repeat(25)),/JSON_DEPTH_EXCEEDED/);
 assert.throws(()=>parseBoundedJson('{"a":'),/JSON_INVALID/);
 assert.deepEqual(parseBoundedJson(JSON.stringify({text:'[{ "\\ }]' })),{text:'[{ "\\ }]' });
});
async function server(t,handler){
 const s=createServer(handler);s.listen(0,'127.0.0.1');await once(s,'listening');
 t.after(()=>{s.closeAllConnections();return new Promise(r=>s.close(r));});
 return 'http://127.0.0.1:'+s.address().port;
}
test('real fetch decompression cannot bypass decoded-byte limit',async t=>{
 const packed=gzipSync(Buffer.alloc(100000,65));assert.ok(packed.length<1024);
 const url=await server(t,(_,res)=>{res.writeHead(200,{'Content-Encoding':'gzip','Content-Length':packed.length});res.end(packed);});
 await assert.rejects(fetchBounded({...base,url}),/RESPONSE_TOO_LARGE/);
});
test('real slow-drip body hits idle timeout and closes the socket',async t=>{
 let closed;const disconnected=new Promise(r=>closed=r);
 const url=await server(t,(_,res)=>{res.writeHead(200);res.write('a');const timer=setInterval(()=>res.write('b'),1000);
 res.on('close',()=>{clearInterval(timer);closed();});});
 await assert.rejects(fetchBounded({...base,url,idleMs:80}),/RESPONSE_IDLE_TIMEOUT/);
 await Promise.race([disconnected,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('socket still open')),1500);timer.unref();})]);
});
test('real header stall hits TTFB and closes the socket',async t=>{
 let closed;const disconnected=new Promise(r=>closed=r);
 const url=await server(t,(_,res)=>{res.on('close',closed);});
 await assert.rejects(fetchBounded({...base,url,ttfbMs:100}),/RESPONSE_TTFB_TIMEOUT/);
 await Promise.race([disconnected,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('socket still open')),1500);timer.unref();})]);
});
test('parent cancellation aborts real response socket',async t=>{
 const controller=new AbortController();let closed;const disconnected=new Promise(r=>closed=r);
 const url=await server(t,(_,res)=>{res.on('close',closed);res.writeHead(200);res.write('a');setTimeout(()=>controller.abort(),20);});
 await assert.rejects(fetchBounded({...base,url,options:{signal:controller.signal}}),/RESPONSE_CANCELLED/);
 await Promise.race([disconnected,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('socket still open')),1500);timer.unref();})]);
});
test('error body not read for terminal HTTP response',async()=>{
 let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
 const r=await fetchBounded({...base,fetchImpl:async()=>new Response(body,{status:429})});
 assert.equal(r.text,null);assert.equal(r.response.status,429);assert.equal(cancelled,true);
});

test('real Brotli response is bounded after decompression',async t=>{
 const packed=brotliCompressSync(Buffer.alloc(100000,65));assert.ok(packed.length<1024);
 const url=await server(t,(_,res)=>{res.writeHead(200,{'Content-Encoding':'br','Content-Length':packed.length});res.end(packed);});
 await assert.rejects(fetchBounded({...base,url}),/RESPONSE_TOO_LARGE/);
});
test('real network rejects unsupported compression, wrong MIME and redirect',async t=>{
 const url=await server(t,(req,res)=>{
 if(req.url==='/redirect'){res.writeHead(302,{Location:'/other'});res.end();return;}
 res.writeHead(200,req.url==='/encoding'?{'Content-Encoding':'zstd','Content-Type':'application/json'}:{'Content-Type':'text/html'});res.end('{}');
 });
 await assert.rejects(fetchBounded({...base,url:url+'/encoding',requireJson:true}),/RESPONSE_ENCODING_UNSUPPORTED/);
 await assert.rejects(fetchBounded({...base,url:url+'/mime',requireJson:true}),/RESPONSE_CONTENT_TYPE_INVALID/);
 await assert.rejects(fetchBounded({...base,url:url+'/redirect',requireJson:true}),/RESPONSE_TRANSPORT_FAILED/);
});
test('bounded JSON rejects dangerous keys and overlarge containers',()=>{
 for(const raw of ['{"__proto__":{}}','{"constructor":1}','{"nested":{"prototype":1}}'])assert.throws(()=>parseBoundedJson(raw),/JSON_FORBIDDEN_KEY/);
 assert.throws(()=>parseBoundedJson(JSON.stringify(Array(129).fill(0))),/JSON_ARRAY_LIMIT/);
 assert.throws(()=>parseBoundedJson(JSON.stringify(Object.fromEntries(Array.from({length:129},(_,i)=>['k'+i,i])))),/JSON_KEY_LIMIT/);
 assert.throws(()=>parseBoundedJson(JSON.stringify('a'.repeat(64001))),/JSON_STRING_LIMIT/);
});
