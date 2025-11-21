import { DepthState } from '../../state/depth.state';
import { computeCollision } from './computeCollisionPoint';

export function handleMarketEvent(depthState: DepthState, symbol: string): void {
  computeCollision(depthState, symbol);
}
