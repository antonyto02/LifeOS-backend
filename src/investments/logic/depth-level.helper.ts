export const MAX_LEVEL_DEPTH = 2_000_000;

export function calculateDepthLevel(depthAmount: number | null | undefined): number | null {
  if (!depthAmount || depthAmount <= 0) {
    return null;
  }

  if (depthAmount <= 50_000) return 1;
  if (depthAmount <= 100_000) return 2;
  if (depthAmount <= 150_000) return 3;
  if (depthAmount <= 200_000) return 4;
  if (depthAmount <= 250_000) return 5;
  if (depthAmount <= 300_000) return 6;

  const cappedDepth = Math.min(depthAmount, MAX_LEVEL_DEPTH);
  const additionalLevels = Math.ceil((cappedDepth - 300_000) / 100_000);

  return 6 + additionalLevels;
}
