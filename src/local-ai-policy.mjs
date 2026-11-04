// Never send the local API token from a hosted or non-loopback Studio page.
export function localTaskApiUrl(pageUrl){
  try{
    const url=new URL(pageUrl);
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password)return null;
    return new URL('/api/local-velion/task-draft',url.origin).href;
  }catch{return null;}
}
