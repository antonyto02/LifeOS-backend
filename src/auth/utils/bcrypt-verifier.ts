import * as bcrypt from 'bcryptjs';

export async function verifyBcryptHash(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  return bcrypt.compare(password, hash);
}
