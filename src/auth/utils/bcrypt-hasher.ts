import * as bcrypt from 'bcryptjs';

const MIN_COST = 4;
const MAX_COST = 31;

export async function generateBcryptHash(
  password: string,
  cost = 12,
): Promise<string> {
  if (!password) {
    throw new Error('Password is required for hashing');
  }

  const normalizedCost = Math.trunc(cost);

  if (
    Number.isNaN(normalizedCost) ||
    normalizedCost < MIN_COST ||
    normalizedCost > MAX_COST
  ) {
    throw new Error('Invalid bcrypt cost');
  }

  return bcrypt.hash(password, normalizedCost);
}
