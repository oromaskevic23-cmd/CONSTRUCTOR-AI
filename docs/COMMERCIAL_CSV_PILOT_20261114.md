# Commercial pilot increment — workspace CSV report

Status: domain tests passed locally; browser and exported ZIP acceptance pending. Source branch based on 28f797bd47f8778afe6c600ae4900479d5e168bf.

## Delivered in this branch

Export CSV report for the existing Task Manager, Business CRM and Business Dashboard templates. Report is local, dependency-free, contains all workspace records (not only search matches), and retains numeric columns. JSON remains the lossless backup format. Common formula prefixes are neutralized before CSV quoting; this is not a guarantee for every spreadsheet importer or subsequent re-export. Import as text when handling untrusted content. No external transfer or customer data used.

## Reproducible evidence

Node.js 22.16.0: `node --test test/commercial-csv.test.mjs` — 8/8 PASS, 0 failures. The local original domain file matched GitHub blob 2db6ffa403c9dbec56bd420bd2855e45e0b8b1f0. The updated domain and test files match GitHub blobs 6b4d0b7b1ba2729e81569f41f55b5bf9bdffca0b and 8c0c2f99c6720e6dc0b2601fb492f10a73183525 respectively. Runtime button is wired in blob c551676bafefba9f20431d8207b1e0004f4a1f57 but has not been browser-tested.

## Release acceptance

1. Run existing full verification at the candidate commit once, without repeated expensive CI.
2. Build all three ZIPs using the existing acceptance tool; verify manifests, extract and run each exported app.
3. In actual browser create synthetic records, export CSV, verify headers, rows, quoting and formula handling; verify search does not change export scope, JSON backup/restore still works and no data leaves the browser.
4. Obtain independent QA and owner authorization before merging/releasing. No customer records, deployment, paid services, autonomous generation or commercial sale claimed.
