// Publish an over-the-air update to the Google Play app, but only for changes
// Play allows that way (utils/play-update-rules.ts).
//
//   npm run update:play -- --message "Fix result screen"
//   npm run update:play -- --dry-run                  check only, publish nothing
//   npm run update:play -- --since <commit> --dry-run compare with that commit
//
// It compares the app folder (including uncommitted and new files) with the
// commit of the latest finished EAS production build for Android, which is
// what Play installs are running. If anything payment-, content- or native-
// related changed, it stops: make a new build and send it for review instead.
// Otherwise it runs `eas update` on the production channel as a store build.
import { spawnSync } from 'node:child_process';
import { blockedForPlayUpdate, parseNameStatus, type Change } from '../utils/play-update-rules';

const run = (cmd: string, args: string[]) => {
  // eas is a .cmd shim on Windows and needs a shell; git must not get one (cmd eats "^").
  const result = spawnSync(cmd, args, {encoding: 'utf8', shell: cmd === 'eas' && process.platform === 'win32', maxBuffer: 64 * 1024 * 1024});
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
};
const quote = (arg: string) => process.platform === 'win32' && /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;

function lastPlayBuildCommit(): string {
  const out = run('eas', ['build:list', '--platform', 'android', '--build-profile', 'production', '--status', 'finished', '--limit', '1', '--json', '--non-interactive']);
  const builds = JSON.parse(out) as {gitCommitHash?: string}[];
  const hash = builds[0]?.gitCommitHash;
  if (!hash) throw new Error('No finished production Android build found. Pass --since <commit> to choose what to compare with.');
  return hash;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sinceAt = args.indexOf('--since');
  const since = sinceAt >= 0 ? args[sinceAt + 1] : undefined;
  if (sinceAt >= 0 && !since) throw new Error('--since needs a commit.');
  const passThrough = args.filter((a, i) => a !== '--dry-run' && i !== sinceAt && i !== sinceAt + 1);

  const base = since ?? lastPlayBuildCommit();
  try { run('git', ['cat-file', '-e', `${base}^{commit}`]); }
  catch { throw new Error(`Commit ${base} is not in this checkout. Run git fetch, or pass --since <commit>.`); }

  // Working tree against the build's commit, plus new files git does not track yet.
  const changes: Change[] = [
    ...parseNameStatus(run('git', ['diff', '--name-status', '--relative', base, '--', '.'])),
    ...run('git', ['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean).map(path => ({status: '??', path})),
  ];
  console.log(`Compared with ${base.slice(0, 10)}: ${changes.length} changed file(s).`);

  const blocked = blockedForPlayUpdate(changes);
  if (blocked.length) {
    console.error('\nNot allowed as an over-the-air update to the Google Play app:\n');
    for (const b of blocked) console.error(`  ${b.path}  (${b.reason})`);
    console.error('\nMake a new build (eas build --platform android --profile production) and send it for review.');
    process.exit(1);
  }
  if (dryRun) { console.log('OK: these changes may ship as an over-the-air update. (--dry-run: nothing published)'); return; }

  // Always a store build: never let RSD_DISTRIBUTION=direct leak into a Play update.
  const env = {...process.env, RSD_DISTRIBUTION: 'store'};
  const ebArgs = ['update', '--channel', 'production', '--environment', 'production', '--platform', 'android', ...passThrough];
  const result = spawnSync('eas', ebArgs.map(quote), {stdio: 'inherit', env, shell: process.platform === 'win32'});
  process.exit(result.status ?? 1);
}

try { main(); }
catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
