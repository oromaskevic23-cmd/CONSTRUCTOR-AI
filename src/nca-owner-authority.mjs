// Independent Owner Authority reference verifier. NOT a deployed authority service.
// Owner private signing key must remain outside NCA runtime and HANTER.
import {verify,createPublicKey} from "node:crypto";
const canonical = ({action,epoch,issuedAt,nonce}) => JSON.stringify({action,epoch,issuedAt,nonce});
export function createOwnerGate(publicKeyPem) {
  const key=createPublicKey(publicKeyPem);
  if(key.asymmetricKeyType!=="ed25519") throw new TypeError("Owner key must be Ed25519");
  return {key,epoch:0,stopped:false,nonces:new Set()};
}
export function applyOwnerDirective(gate,directive,signatureBase64) {
  if(!gate || !directive || typeof directive!=="object") throw new TypeError("Invalid directive");
  const {action,epoch,issuedAt,nonce}=directive;
  if(!["STOP","RESUME"].includes(action) || !Number.isSafeInteger(epoch) || epoch<=gate.epoch || !Number.isSafeInteger(issuedAt) || issuedAt<0 || typeof nonce!=="string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(nonce) || gate.nonces.has(nonce)) throw new Error("OWNER_DIRECTIVE_REJECTED");
  if(typeof signatureBase64!=="string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(signatureBase64)) throw new Error("OWNER_SIGNATURE_INVALID");
  const signature=Buffer.from(signatureBase64,"base64");
  if(signature.length!==64 || !verify(null,Buffer.from(canonical(directive)),gate.key,signature)) throw new Error("OWNER_SIGNATURE_INVALID");
  gate.epoch=epoch;
  gate.stopped=action==="STOP";
  gate.nonces.add(nonce);
  return {epoch:gate.epoch,stopped:gate.stopped};
}
export function assertOwnerAllowed(gate) {
  if(!gate || gate.stopped!==false) throw new Error("OWNER_STOP");
  return true;
}
export function ownerDirectiveMessage(directive) {return canonical(directive);}
