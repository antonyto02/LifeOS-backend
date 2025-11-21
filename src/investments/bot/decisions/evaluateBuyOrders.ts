import { CollisionSnapshot } from './computeCollisionPoint';

export function evaluateBuyOrders(snapshot: CollisionSnapshot) {
  const { bidPrice, secondBidPrice, askPrice, topBid, topAsk } = snapshot;

  console.log(`El precio de compra más alto es ${bidPrice}`);

  if (secondBidPrice !== undefined) {
    console.log(`El segundo precio de compra más alto es ${secondBidPrice}`);
  } else {
    console.log('No hay un segundo precio de compra disponible');
  }

  console.log(`El precio de venta más bajo es ${askPrice}`);
  console.log(`El porcentaje de compradores es ${topBid}`);
  console.log(`El porcentaje de vendedores es ${topAsk}`);
}
