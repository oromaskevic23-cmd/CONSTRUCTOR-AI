"""CONSTRUCTOR AI: real local LLM -> source -> restricted Docker QA.
No customer input, credentials, production deployment or execution on host.
Generated source must never be executed by this Python host process.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

MODEL = "qwen2.5-coder:1.5b-instruct"
API = "http://127.0.0.1:11434/api/generate"
OBJECTIVE = "Implement a dependency-free JavaScript invoice calculator on public synthetic data."
MAX_ATTEMPTS = 3
UNSAFE = re.compile(
    r"\b(?:import|require|process|eval|Function|fetch|XMLHttpRequest|"
    r"WebSocket|Worker|globalThis|Deno|Bun|setTimeout|setInterval|"
    r"child_process|exec|spawn|fs|net|http|https)\b|"
    r"__proto__|constructor\s*\[|<script|[\x60]", re.I
)
EXPORT = re.compile(r"\bexport\s+function\s+invoiceTotalCents\s*\(")
SHA = re.compile(r"^[0-9a-f]{64}$")

class BoundedBuildError(RuntimeError):
    pass

def checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def prompt(attempt: int) -> str:
    feedback = "" if attempt == 1 else (
        "\nThe previous version failed the independent acceptance suite. "
        "Repair input validation, exact arithmetic, integer overflow and "
        "immutability. Do not invent APIs or bypass tests."
    )
    return (
        "SYNTHETIC TRAINING ONLY. Write a complete JavaScript ES module, not an "
        "explanation. Reply as ONE JSON object with exactly the key source "
        "containing raw JavaScript. No markdown.\n"
        "Implement: export function invoiceTotalCents(items)\n"
        "1. items must be an Array. Each element must be a plain object with "
        "own fields qty and unitCents. Both must satisfy Number.isSafeInteger.\n"
        "2. qty must be >= 1 and unitCents >= 0. Invalid types and nonintegers "
        "throw TypeError; zero/negative qty or negative unitCents throw RangeError.\n"
        "3. Return exact integer total of qty * unitCents for all items. [] -> 0.\n"
        "4. If a product or running sum is not Number.isSafeInteger, throw RangeError.\n"
        "5. Never mutate input. Do not use imports, filesystem, network, process, "
        "eval, external packages, globals or extra exports.\n"
        "Output is untrusted and is executed only in restricted offline Docker "
        "under separately authored tests; test code is never supplied to model."
        + feedback
    )

def validate_candidate(raw: object) -> bytes:
    if type(raw) is not str or len(raw) > 6000 or len(raw) < 80 or "\x00" in raw:
        raise BoundedBuildError("CANDIDATE_LENGTH_OR_TYPE_INVALID")
    if not EXPORT.search(raw) or UNSAFE.search(raw) or raw.count("export") != 1:
        raise BoundedBuildError("CANDIDATE_STATIC_POLICY_REJECTED")
    if "\r" in raw or "\ufeff" in raw:
        raise BoundedBuildError("CANDIDATE_ENCODING_POLICY_REJECTED")
    return raw.encode("utf-8")

def generate(attempt: int) -> tuple[bytes, dict]:
    request_prompt = prompt(attempt)
    request = json.dumps({
        "model": MODEL, "prompt": request_prompt, "stream": False,
        "format": "json",
        "options": {"temperature": 0, "seed": 20261031, "num_ctx": 4096, "num_predict": 1300}
    }, separators=(",", ":")).encode()
    req = urllib.request.Request(
        API, data=request, method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"}
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(req, timeout=210) as response:
        payload = response.read(80000)
    obj = json.loads(payload)
    if (type(obj) is not dict or not obj.get("model","").startswith("qwen2.5-coder:")
            or obj.get("done") is not True or type(obj.get("response")) is not str):
        raise BoundedBuildError("INVALID_REAL_MODEL_RECEIPT")
    result = json.loads(obj["response"])
    if type(result) is not dict or set(result) != {"source"}:
        raise BoundedBuildError("INVALID_MODEL_SOURCE_CONTRACT")
    candidate = validate_candidate(result["source"])
    usage = {
        "prompt_sha256": checksum(request_prompt.encode()),
        "response_sha256": checksum(obj["response"].encode()),
        "source_sha256": checksum(candidate),
        "prompt_eval_count": obj.get("prompt_eval_count"),
        "eval_count": obj.get("eval_count"),
        "total_duration_ns": obj.get("total_duration"),
    }
    if type(usage["eval_count"]) is not int or usage["eval_count"] <= 0:
        raise BoundedBuildError("MISSING_REAL_INFERENCE_TOKEN_EVIDENCE")
    return candidate, usage

def execute_restricted_docker(attempt_root: Path, image: str) -> dict:
    cmd = [
        "docker", "run", "--rm", "--network", "none", "--read-only",
        "--cap-drop=ALL", "--security-opt=no-new-privileges",
        "--pids-limit=64", "--memory=256m", "--cpus=1",
        "--user", "65534:65534",
        "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m",
        "--mount", "type=bind,src="+str(attempt_root)+",dst=/work,readonly",
        "--workdir", "/work", image, "sh", "-ec",
        "node --check solution.mjs && node --test --test-reporter=spec qa.mjs"
    ]
    run = subprocess.run(
        cmd, timeout=70, capture_output=True, text=True, check=False,
        env={"PATH": os.environ.get("PATH","/usr/bin:/bin")}
    )
    return {
        "exit_code": run.returncode, "passed": run.returncode == 0,
        "log_sha256": checksum((run.stdout+run.stderr).encode()),
        "stdout_tail": run.stdout[-2500:], "stderr_tail": run.stderr[-500:],
    }

def main() -> None:
    if os.environ.get("CONSTRUCTOR_SYNTHETIC_LLM_CONSENT") != "EXPLICIT_ONE_TIME_CI_DEMO":
        raise BoundedBuildError("EXPLICIT_SYNTHETIC_INFERENCE_FLAG_REQUIRED")
    image = os.environ.get("CONSTRUCTOR_SANDBOX_IMAGE", "")
    if not image.startswith("node@sha256:") or not SHA.fullmatch(image.removeprefix("node@sha256:")):
        raise BoundedBuildError("PINNED_SANDBOX_IMAGE_DIGEST_REQUIRED")
    qa_source = (Path(__file__).parent.parent / "live_qa" / "invoice-acceptance.mjs").read_bytes()
    root = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / "constructor-llm-evidence"
    root.mkdir(mode=0o700, exist_ok=True)
    report = {
        "schema": "constructor.ai.live_llm_sandbox_proof.v1",
        "mission": "SYNTHETIC_INVOICE_MICROCOMPONENT_ONLY",
        "model": MODEL, "runtime": "LOCAL_OLLAMA_EPHEMERAL_CI",
        "objective": OBJECTIVE, "independent_qa_sha256":checksum(qa_source),
        "sandbox_image": image, "docker_network": "none",
        "sandbox_read_only": True,
        "source_provider": "REAL_LOCAL_LLM_ONLY_NO_TEMPLATE_FALLBACK",
        "attempts": [], "final_status": "NOT_VERIFIED", "real_llm_calls":0,
        "verified_sandbox_runs":0, "release":"DENIED",
        "owner_approval_verified":False, "guardian_core_connected":False,
        "real_ai_passport_verified":False, "independent_human_qa":False,
        "professional_nca_qualified":False,
        "production_authorized":False, "commercial_access":False,
    }
    complete=False
    try:
        for i in range(1,MAX_ATTEMPTS+1):
            entry={"attempt":i,"stage":"INFERENCE_REQUESTED"}
            report["attempts"].append(entry)
            try:
                candidate,receipt=generate(i)
                report["real_llm_calls"] += 1
                entry["generation"]=receipt
                case_dir=root/("attempt-"+str(i))
                case_dir.mkdir(mode=0o755,exist_ok=False)
                (case_dir/"solution.mjs").write_bytes(candidate)
                (case_dir/"qa.mjs").write_bytes(qa_source)
                for name in ("solution.mjs","qa.mjs"):
                    (case_dir/name).chmod(0o644)
                result=execute_restricted_docker(case_dir,image)
                report["verified_sandbox_runs"] += 1
                entry["sandbox"]=result
                entry["stage"]="QA_PASS" if result["passed"] else "QA_FAIL"
                if result["passed"]:
                    complete=True
                    report["final_status"]="VERIFIED_BOUNDED_LLM_MICROCOMPONENT"
                    (root/"winning-source.mjs").write_bytes(candidate)
                    break
            except Exception as exc:
                entry["stage"]="ERROR_FAIL_CLOSED"
                entry["error_code"]=type(exc).__name__+":"+str(exc)[:120]
    finally:
        evidence=json.dumps(report,sort_keys=True,indent=2)+"\n"
        (root/"evidence.json").write_text(evidence,encoding="utf-8")
        print(evidence)
    if not complete:
        raise SystemExit("REAL_LLM_BUILD_NOT_VERIFIED")

if __name__ == "__main__":
    main()
