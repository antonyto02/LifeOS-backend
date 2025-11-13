import { spawn } from 'node:child_process';

const PYTHON_SCRIPT = [
  'import crypt, sys',
  'stored_hash = sys.argv[1]',
  'password = sys.stdin.read()',
  "if not stored_hash:",
  "    raise SystemExit('Missing stored hash')",
  "password = password.rstrip('\n')",
  'computed = crypt.crypt(password, stored_hash)',
  'if computed is None:',
  "    raise SystemExit('crypt() failed during verification')",
  "sys.stdout.write('1' if computed == stored_hash else '0')",
].join('\n');

export async function verifyBcryptHash(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) {
    throw new Error('Stored hash is required for verification');
  }

  return new Promise((resolve, reject) => {
    const subprocess = spawn('python3', ['-c', PYTHON_SCRIPT, storedHash]);

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

    subprocess.stdin.write(password ?? '');
    subprocess.stdin.end();
  });
}
