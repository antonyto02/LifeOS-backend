import { spawn } from 'node:child_process';

const PYTHON_SCRIPT = [
  'import crypt, secrets, string, sys',
  'cost = int(sys.argv[1])',
  'password = sys.stdin.read()',
  "alphabet = string.ascii_letters + string.digits + './'",
  'if cost < 4 or cost > 31:',
  "    raise SystemExit('Invalid bcrypt cost')",
  "salt = ''.join(secrets.choice(alphabet) for _ in range(22))",
  'salt_spec = f"$2b${cost:02d}${salt}"',
  'result = crypt.crypt(password, salt_spec)',
  'if result is None:',
  "    raise SystemExit('crypt() failed to generate bcrypt hash')",
  'sys.stdout.write(result)',
].join('\n');

export async function generateBcryptHash(
  password: string,
  cost = 12,
): Promise<string> {
  if (!password) {
    throw new Error('Password is required for hashing');
  }

  return new Promise((resolve, reject) => {
    const subprocess = spawn('python3', ['-c', PYTHON_SCRIPT, String(cost)]);

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
        reject(new Error(stderr || `Failed to generate bcrypt hash (exit code ${code})`));
        return;
      }

      resolve(stdout.trim());
    });

    subprocess.stdin.write(password);
    subprocess.stdin.end();
  });
}
