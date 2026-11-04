"""Offline safety/unit tests. No real model call or browser execution here."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

FILE=Path(__file__).resolve().parents[1]/"browser_factory"/"live_browser_app.py"
spec=importlib.util.spec_from_file_location("browser_factory",FILE)
app=importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

GOOD={
 "index.html": """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice Lab</title><link rel="stylesheet" href="style.css">
<script src="app.js" defer></script></head><body>
<h1>Invoice Lab</h1><label for="qty">Quantity</label><input id="qty" type="number">
<label for="unitCents">Unit cents</label><input id="unitCents" type="number">
<button id="add">Add line</button><button id="clear">Clear</button>
<output id="total">0</output><output id="lineCount">0</output>
<p id="error" role="alert"></p><ul id="items"></ul></body></html>""",
 "app.js": """function init() {
 const qty=document.getElementById('qty');
 const cents=document.getElementById('unitCents');
 const total=document.getElementById('total');
 const count=document.getElementById('lineCount');
 const err=document.getElementById('error');
 const items=document.getElementById('items');
 let sum=0, lines=0;
 document.getElementById('add').addEventListener('click',()=>{
  const q=Number(qty.value),c=Number(cents.value);
  if(!Number.isSafeInteger(q)||!Number.isSafeInteger(c)||q<=0||c<0) {
   err.textContent='Invalid';return;
  }
  const product=q*c;
  if(!Number.isSafeInteger(product)||!Number.isSafeInteger(sum+product)) {
   err.textContent='Overflow';return;
  }
  sum+=product; lines++;
  total.textContent=String(sum);count.textContent=String(lines);
  const li=document.createElement('li');li.textContent=String(product);items.append(li);
  err.textContent='';
 });
 document.getElementById('clear').addEventListener('click',()=>{
  sum=0;lines=0;total.textContent='0';count.textContent='0';
  items.replaceChildren();err.textContent='';
 });
}
init();""",
 "style.css": "body { font-family: system-ui; margin: 2rem; } button { padding: 1rem; }"
}

class BrowserFactoryOfflineTests(unittest.TestCase):
 def test_exact_three_file_contract(self):
  checked=app.validate_generated(GOOD)
  self.assertEqual(set(checked),set(app.EXPECTED_FILES))
  self.assertEqual(len(checked['app.js']),len(GOOD['app.js'].encode()))
 def test_missing_or_extra_files_denied(self):
  with self.assertRaisesRegex(app.AppBuildDenied,'STRICT_THREE_FILE'):
   app.validate_generated({'app.js':'x'})
  with self.assertRaisesRegex(app.AppBuildDenied,'STRICT_THREE_FILE'):
   app.validate_generated({**GOOD,'package.json':'{"scripts":{"postinstall":"echo x"}}'})
 def test_remote_html_and_inline_script_denied(self):
  for variant in [
   GOOD['index.html'].replace('style.css','https://evil.example/s.css'),
   GOOD['index.html']+'<script>alert(1)</script>',
   GOOD['index.html'].replace('<h1>','<iframe src="x"></iframe><h1>'),
   GOOD['index.html'].replace('<h1>','<div onclick="evil()"></div><h1>'),
  ]:
   with self.subTest(code=variant[-30:]):
    with self.assertRaises(app.AppBuildDenied):
     app.validate_generated({**GOOD,'index.html':variant})
 def test_active_js_features_denied(self):
  for suffix in ["fetch('/x');","eval('1');","process.env.KEY;",
                 "document.body.innerHTML='x';","new Function('return 1')();",
                 "localStorage.setItem('x','1');"]:
   with self.subTest(suffix=suffix):
    with self.assertRaises(app.AppBuildDenied):
     app.validate_generated({**GOOD,'app.js':GOOD['app.js']+suffix})
 def test_css_network_denied(self):
  with self.assertRaisesRegex(app.AppBuildDenied,'CSS_STATIC_POLICY'):
   app.validate_generated({**GOOD,'style.css':GOOD['style.css']+"@import url('https://bad');"})
 def test_feedback_contains_only_allowlisted_failure_names(self):
  p=app.model_prompt(2,GOOD,('zero quantity is rejected with visible error',))
  self.assertIn('Previous JavaScript',p)
  self.assertIn('zero quantity is rejected with visible error',p)
  self.assertNotIn('assert.equal',p)
  self.assertNotIn('browser-qa.cjs',p)
 def test_docker_command_has_network_off_and_readonly_mounts(self):
  class Done:
   returncode=0
   stdout="PASS one"
   stderr=""
  with patch.object(app.subprocess,'run',return_value=Done()) as run:
   result=app.qa_docker(Path('/tmp/demo'),"mcr.microsoft.com/playwright@sha256:"+"f"*64,Path('/tmp/deps'))
  cmd=run.call_args.args[0]
  self.assertIn('--network',cmd)
  self.assertEqual(cmd[cmd.index('--network')+1],'none')
  self.assertIn('--cap-drop=ALL',cmd)
  self.assertIn('--read-only',cmd)
  self.assertIn('--security-opt=no-new-privileges',cmd)
  self.assertIn('readonly',cmd[cmd.index('--mount')+1])
  self.assertTrue(result['passed'])
 def test_source_file_safety_limit_enforced(self):
  with self.assertRaisesRegex(app.AppBuildDenied,'INVALID_ARTIFACT_BYTES'):
   app.validate_generated({**GOOD,'app.js':'x'})
 def test_real_model_prompt_does_not_embed_oracle_source(self):
  p=app.model_prompt(1,None,())
  self.assertIn('Invoice Lab',p)
  self.assertNotIn('playwright',p.lower())
  self.assertNotIn('page.locator(',p)
 def test_stable_sha256(self):
  self.assertEqual(app.digest(b'hello'),"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")

if __name__=='__main__':
 unittest.main()
