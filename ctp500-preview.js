/* Rotate a display copy. The prepared printer canvas and bytes stay intact. */
export function createPrintPreview(source, quarterTurns = 0, createCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}) {
  if (!source?.width || !source?.height) throw new TypeError('A prepared print image is required.');
  if (!Number.isInteger(quarterTurns)) throw new TypeError('Preview rotation must use whole quarter turns.');
  const turns = (quarterTurns % 4 + 4) % 4;
  if (!turns) return source;
  const canvas = createCanvas(turns % 2 ? source.height : source.width, turns % 2 ? source.width : source.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (turns === 1) ctx.translate(canvas.width, 0);
  else if (turns === 2) ctx.translate(canvas.width, canvas.height);
  else ctx.translate(0, canvas.height);
  ctx.rotate(turns * Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  return canvas;
}
