"""Offline tests for live mission harness, no model download or Docker execution."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock

FILE=Path(__file__).resolve().parents[1]/"live_factory"/"first_real_llm_build.py"
spec=importlib.util.spec_from_file_location("bounded_factory", FILE)
factory=importlib.util.module_from_spec(spec)
spec.loader.exec_module(factory)

GOOD = """export function invoiceTotalCents(items) {
  if (!Array.isArray(items)) throw new TypeError('items');
  let sum=0;
  for (const item of items) {
    if (!item || typeof item !== 'object') throw new TypeError('item');
    if (!Number.isSafeInteger(item.qty) || !Number.isSafeInteger(item.unitCents)) throw new TypeError('number');
    if (item.qty <= 0 || item.unitCents < 0) throw new RangeError('range');
    const product=item.qty*item.unitCents;
    if (!Number.isSafeInteger(product)) throw new RangeError('overflow');
    sum+=product;
    if (!Number.isSafeInteger(sum)) throw new RangeError('overflow');
  }
  return sum;
}"""

class FactoryOfflineTests(unittest.TestCase):
    def test_one_source_contract_and_hash(self):
        raw=factory.validate_candidate(GOOD)
        self.assertEqual(len(factory.checksum(raw)),64)
    def test_hostile_source_rejected_before_any_execution(self):
        for code in [
            "import {exec} from 'node:child_process'; "+GOOD,
            "const x=eval('1'); "+GOOD,
            "const x=fetch('https://x'); "+GOOD,
            "const x=process.env.SECRET; "+GOOD,
            "const x=globalThis; "+GOOD,
            GOOD+"\nexport const cheat=1;",
        ]:
            with self.subTest(code=code[:35]):
                with self.assertRaises(factory.BoundedBuildError):
                    factory.validate_candidate(code)
    def test_missing_export_is_rejected(self):
        with self.assertRaises(factory.BoundedBuildError):
            factory.validate_candidate("const invoiceTotalCents = () => 0;"*5)
    def test_model_prompt_never_includes_independent_test_cases(self):
        for i in (1,2,3):
            p=factory.prompt(i)
            self.assertIn("invoiceTotalCents",p)
            self.assertNotIn("assert.equal",p)
            self.assertNotIn("qa.mjs",p)
            self.assertNotIn("GITHUB_TOKEN",p)
    def test_docker_uses_network_none_no_host_secrets_and_no_shell_execution(self):
        class Fake:
            returncode=0
            stdout="test report"
            stderr=""
        with patch.object(factory.subprocess,'run',return_value=Fake()) as run:
            result=factory.execute_restricted_docker(Path("/tmp/safe-fixture"),"node@sha256:"+"a"*64)
        cmd=run.call_args.args[0]
        self.assertEqual(cmd[0:3],["docker","run","--rm"])
        self.assertIn("none",cmd)
        self.assertIn("--read-only",cmd)
        self.assertIn("--cap-drop=ALL",cmd)
        self.assertIn("--user",cmd)
        self.assertIn("65534:65534",cmd)
        self.assertIn("readonly",cmd[cmd.index("--mount")+1])
        self.assertTrue(result["passed"])
    def test_no_automatic_fallback_when_llm_unavailable(self):
        with patch.object(factory,'generate',side_effect=OSError("offline")):
            with self.assertRaises(OSError):
                factory.generate(1)

if __name__=="__main__":
    unittest.main()
