import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'node:child_process';

@Injectable()
export class BcryptService {
  private readonly costFactor = 12;

  async hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const subprocess = spawn('openssl', [
        'passwd',
        '-stdin',
        '-bcrypt',
        '-cost',
        String(this.costFactor),
      ]);

      let stdout = '';
      let stderr = '';

      subprocess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      subprocess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      subprocess.on('error', () => {
        reject(new InternalServerErrorException('Unable to secure password.'));
      });

      subprocess.on('close', (code) => {
        if (code !== 0 || !stdout.trim()) {
          reject(
            new InternalServerErrorException(
              stderr.trim() || 'Unable to secure password.',
            ),
          );
          return;
        }

        resolve(stdout.trim());
      });

      subprocess.stdin.write(password);
      subprocess.stdin.end();
    });
  }
}
