const origin = process.argv[2] || 'https://rsdeducation.vercel.app';
const cases = [
  ['/api/auth/me', 401], ['/api/dsc-sgt/overview', 401],
  ['/api/dsc-sgt/performance', 401], ['/api/payments/plans', 401],
  ['/api/auth/nonce', 200], ['/api/auth/google', 200],
  ['/api/dsc-sgt/mock-tests?medium=english&page=1&pageSize=1', 200],
];
let failures = 0;
for (const [path, expected] of cases) {
  try {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(25000) });
    console.log(`${response.status === expected ? 'PASS' : 'FAIL'} ${path}: ${response.status} (expected ${expected})`);
    if (response.status !== expected) failures++;
    if (path.includes('mock-tests?') && response.ok) {
      const data = await response.json();
      const valid = Array.isArray(data.tests) && typeof data.total_pages === 'number';
      console.log(`${valid ? 'PASS' : 'FAIL'} mock catalog response contract`);
      if (!valid) failures++;
    }
  } catch (error) { console.log(`FAIL ${path}: ${error.message}`); failures++; }
}
// This intentionally does not sign in, modify data, or create payment orders.
process.exitCode = failures ? 1 : 0;
