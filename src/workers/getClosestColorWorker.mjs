import { parentPort, workerData } from "node:worker_threads";

const getClosestColorTile = (input) => {
  console.time('time')
  const { averageColor, tileColors } = input;
  let closestColorIndex = 0;
  let closestColorVal = Infinity;
  tileColors.forEach((color, i) => {
    const {
      averageColor: { r, g, b },
    } = color;
    const val =
      Math.abs(r - averageColor.r) +
      Math.abs(g - averageColor.g) +
      Math.abs(b - averageColor.b);
    if (val < closestColorVal) {
      closestColorVal = val;
      closestColorIndex = i;
    }
  });
  console.timeEnd('time')

  return closestColorIndex;
};

const result = getClosestColorTile(workerData);
parentPort.postMessage(result);
