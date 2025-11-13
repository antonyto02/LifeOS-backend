import { spawn } from 'node:child_process';

const VERIFY_SCRIPT = [
  'import crypt, sys',
  'stored_hash = sys.argv[1]',
  'password = sys.stdin.read()',
  'if not stored_hash:',
  "    raise SystemExit('Missing bcrypt hash to verify against')",
  'result = crypt.crypt(password, stored_hash)',
  'if result is None:',
  "    raise SystemExit('crypt() failed to verify bcrypt hash')",
  "sys.stdout.write('1' if result == stored_hash else '0')",
].join('\n');

export async function verifyBcryptHash(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  return new Promise((resolve, reject) => {
    const subprocess = spawn('python3', ['-c', VERIFY_SCRIPT, hash]);

    let stdout = '';
    let stderr = '';

    subprocess.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    subprocess.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    subprocess.on('error', (err) => {
      reject(err);
    });

    subprocess.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr || `Failed to verify bcrypt hash (exit code ${code})`,
          ),
        );
        return;
      }

      resolve(stdout.trim() === '1');
    });

    subprocess.stdin.write(password);
    subprocess.stdin.end();
  });
}
