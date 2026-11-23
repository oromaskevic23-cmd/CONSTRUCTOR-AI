// Reference protected execution sink. Must be deployed outside untrusted NCA workers.
// This in-memory implementation is NOT an independent production security boundary.
import {assertOwnerAllowed} from "./nca-owner-authority.mjs";
export function createProtectedSink({gate,queue}) {
 if(!gate || !queue) throw new TypeError("Missing authority or queue");
 return {gate,queue,accepted:new Map()};
}
export function publishVerified(sink,{taskId,expectedEpoch,verificationId,result}) {
 assertOwnerAllowed(sink.gate);
 if(sink.queue.stopped) throw new Error("OWNER_STOP");
 if(typeof taskId!=="string" || !Number.isSafeInteger(expectedEpoch) || expectedEpoch<1 || typeof verificationId!=="string" || !/^[A-Za-z0-9_-]{8,128}$/.test(verificationId)) throw new TypeError("Invalid publication");
 const task=sink.queue.tasks.get(taskId);
 if(!task || task.state!=="VERIFYING" || sink.queue.epochs.get(taskId)!==expectedEpoch) throw new Error("UNVERIFIED_OR_STALE");
 // An independent verifier must supply verificationId after checking the artifact.
 // Caller identity/authentication is NOT established in this reference.
 if(sink.accepted.has(taskId)) throw new Error("ALREADY_PUBLISHED");
 const record={taskId,epoch:expectedEpoch,verificationId,result,authorityEpoch:sink.gate.epoch};
 sink.accepted.set(taskId,record);
 task.state="COMPLETED";
 return record;
}
