#!/usr/bin/env python3
"""Explicitly authorized REAL local GGUF inference; generated source remains untrusted."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

PIN = "9739055e046d62a937e5b7879012209ef40ebea8a1569a96028de491f3f091d5"
OUT = "local-model-observation.json"
SYSTEM = (
    "You are a software draft generator. Output only strict JSON with schema "
    "constructor_draft_v1, summary, steps (nonempty array with id/action/acceptance) "
    "and files (path/content). Write a minimal JavaScript program. "
    "No markdown code fences, passwords, shell commands, or test success claims."
)


def file_sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-file", required=True)
    parser.add_argument("--goal", required=True)
    parser.add_argument("--confirm-real-inference", action="store_true")
    args = parser.parse_args()
    if not args.confirm_real_inference:
        raise ValueError("EXPLICIT_INFERENCE_OPT_IN_REQUIRED")
    if not 12 <= len(args.goal) <= 300 or any(ord(c) < 32 for c in args.goal):
        raise ValueError("INVALID_GOAL")
    model = Path(args.model_file)
    if not model.is_file() or model.is_symlink() or not 350_000_000 <= model.stat().st_size <= 550_000_000:
        raise ValueError("INVALID_MODEL_PATH_OR_SIZE")
    if file_sha256(model) != PIN:
        raise ValueError("MODEL_SHA256_MISMATCH")
    try:
        from llama_cpp import Llama  # optional offline library, imported only after validation
    except ImportError as error:
        raise RuntimeError("LOCAL_LLAMA_CPP_RUNTIME_NOT_INSTALLED") from error
    llm = Llama(model_path=str(model), n_ctx=2048, n_threads=4,
               chat_format="chatml", verbose=False)
    result = llm.create_chat_completion(
        messages=[{"role": "system", "content": SYSTEM},
                  {"role": "user", "content": "Generate this minimal software: " + args.goal}],
        temperature=0.1, max_tokens=768, response_format={"type": "json_object"}
    )
    choices = result.get("choices", [])
    if len(choices) != 1 or not isinstance(choices[0].get("message", {}).get("content"), str):
        raise RuntimeError("INVALID_LLM_RESPONSE")
    answer = choices[0]["message"]["content"]
    if not answer.strip() or len(answer) > 64000:
        raise RuntimeError("LLM_OUTPUT_BOUNDS_EXCEEDED")
    report = {
        "schema": "constructor_local_gguf_observation_v1",
        "model_id": "Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF:q4_0",
        "model_sha256": PIN,
        "input_sha256": hashlib.sha256(args.goal.encode()).hexdigest(),
        "response_sha256": hashlib.sha256(answer.encode()).hexdigest(),
        "finish_reason": choices[0].get("finish_reason"),
        "response_text": answer,
        "provider": "LOCAL_LLAMA_CPP_PYTHON",
        "inference_attempted": True,
        "model_generated_files_executed": False,
        "release": "DENIED"
    }
    with Path(OUT).open("x", encoding="utf8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print("LOCAL_INFERENCE_ATTEMPTED_AND_HASHED_NO_SOURCE_EXECUTION")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError) as error:
        print("BLOCKED:", type(error).__name__, str(error), file=sys.stderr)
        sys.exit(1)
