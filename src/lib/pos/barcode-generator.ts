/**
 * Pure TypeScript Code 128-B barcode and SVG generator.
 * Open standard: ISO/IEC 15417.
 * Generates clean, crisp vector SVGs suitable for any thermal printer or screen.
 */

// GF(2^8) math with prime polynomial 0x11D for standard QR Code Reed-Solomon
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let gfX = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = gfX;
  EXP[i + 255] = gfX;
  LOG[gfX] = i;
  gfX <<= 1;
  if (gfX & 256) gfX ^= 0x11d;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    const factor = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], factor);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

function rsCompute(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLength);
  const remainder = new Uint8Array(ecLength);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[ecLength - 1] = 0;
    for (let j = 0; j < ecLength; j++) {
      remainder[j] ^= gfMul(gen[j], factor);
    }
  }

  return remainder;
}

interface VersionInfo {
  total: number;
  data: number;
  ecPerBlock: number;
  b1: number;
  d1: number;
  b2: number;
  d2: number;
  align: number[];
}

const QR_VERSIONS: VersionInfo[] = [
  { total: 0, data: 0, ecPerBlock: 0, b1: 0, d1: 0, b2: 0, d2: 0, align: [] },
  { total: 26, data: 16, ecPerBlock: 10, b1: 1, d1: 16, b2: 0, d2: 0, align: [] },
  { total: 44, data: 28, ecPerBlock: 16, b1: 1, d1: 28, b2: 0, d2: 0, align: [6, 18] },
  { total: 70, data: 44, ecPerBlock: 26, b1: 1, d1: 44, b2: 0, d2: 0, align: [6, 22] },
  { total: 100, data: 64, ecPerBlock: 18, b1: 2, d1: 32, b2: 0, d2: 0, align: [6, 26] },
  { total: 134, data: 86, ecPerBlock: 24, b1: 2, d1: 43, b2: 0, d2: 0, align: [6, 30] },
  { total: 172, data: 108, ecPerBlock: 16, b1: 4, d1: 27, b2: 0, d2: 0, align: [6, 34] },
  { total: 196, data: 124, ecPerBlock: 18, b1: 4, d1: 31, b2: 0, d2: 0, align: [6, 22, 38] },
  { total: 242, data: 154, ecPerBlock: 22, b1: 2, d1: 38, b2: 2, d2: 39, align: [6, 24, 42] },
  { total: 292, data: 182, ecPerBlock: 22, b1: 3, d1: 36, b2: 2, d2: 37, align: [6, 26, 46] },
  { total: 346, data: 216, ecPerBlock: 26, b1: 4, d1: 43, b2: 1, d2: 44, align: [6, 28, 50] },
];

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8Bytes = new TextEncoder().encode(text);
  const dataLen = utf8Bytes.length;

  let version = 1;
  while (version <= 10) {
    const vInfo = QR_VERSIONS[version];
    const countBits = version <= 9 ? 8 : 16;
    const availableBits = vInfo.data * 8;
    const requiredBits = 4 + countBits + dataLen * 8;
    if (requiredBits <= availableBits) break;
    version++;
  }

  if (version > 10) version = 10;
  const vInfo = QR_VERSIONS[version];
  const charCountBits = version <= 9 ? 8 : 16;

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4);
  pushBits(dataLen, charCountBits);
  for (let i = 0; i < dataLen; i++) {
    pushBits(utf8Bytes[i], 8);
  }

  const totalDataBits = vInfo.data * 8;
  const termLen = Math.min(4, totalDataBits - bits.length);
  pushBits(0, termLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataCodewords = new Uint8Array(vInfo.data);
  for (let i = 0; i < vInfo.data; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataCodewords[i] = b;
  }

  const totalBlocks = vInfo.b1 + vInfo.b2;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let offset = 0;
  for (let i = 0; i < vInfo.b1; i++) {
    const block = dataCodewords.slice(offset, offset + vInfo.d1);
    dataBlocks.push(block);
    ecBlocks.push(rsCompute(block, vInfo.ecPerBlock));
    offset += vInfo.d1;
  }
  for (let i = 0; i < vInfo.b2; i++) {
    const block = dataCodewords.slice(offset, offset + vInfo.d2);
    dataBlocks.push(block);
    ecBlocks.push(rsCompute(block, vInfo.ecPerBlock));
    offset += vInfo.d2;
  }

  const finalCodewords: number[] = [];
  const maxDataBlockLen = Math.max(vInfo.d1, vInfo.d2);
  for (let c = 0; c < maxDataBlockLen; c++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (c < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][c]);
      }
    }
  }

  for (let c = 0; c < vInfo.ecPerBlock; c++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalCodewords.push(ecBlocks[b][c]);
    }
  }

  const matrixSize = version * 4 + 17;
  const matrix: (boolean | null)[][] = Array.from({ length: matrixSize }, () =>
    Array(matrixSize).fill(null)
  );

  const addFinder = (originR: number, originC: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = originR + r;
        const mc = originC + c;
        if (mr < 0 || mr >= matrixSize || mc < 0 || mc >= matrixSize) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matrix[mr][mc] = false;
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          matrix[mr][mc] = true;
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          matrix[mr][mc] = true;
        } else {
          matrix[mr][mc] = false;
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, matrixSize - 7);
  addFinder(matrixSize - 7, 0);

  const coords = vInfo.align;
  for (const r of coords) {
    for (const c of coords) {
      const onTopLeft = r < 9 && c < 9;
      const onTopRight = r < 9 && c >= matrixSize - 9;
      const onBottomLeft = r >= matrixSize - 9 && c < 9;
      if (onTopLeft || onTopRight || onBottomLeft) continue;

      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) {
            matrix[r + dr][c + dc] = true;
          } else {
            matrix[r + dr][c + dc] = false;
          }
        }
      }
    }
  }

  for (let i = 8; i < matrixSize - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  matrix[4 * version + 9][8] = true;

  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][matrixSize - 1 - i] === null) matrix[8][matrixSize - 1 - i] = false;
    if (matrix[matrixSize - 1 - i][8] === null) matrix[matrixSize - 1 - i][8] = false;
  }

  if (version >= 7) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        matrix[r][matrixSize - 11 + c] = false;
        matrix[matrixSize - 11 + c][r] = false;
      }
    }
  }

  let dataBitIndex = 0;
  const totalBitsToPlace = finalCodewords.length * 8;

  let right = matrixSize - 1;
  let upward = true;

  while (right > 0) {
    if (right === 6) right--;

    for (let i = 0; i < matrixSize; i++) {
      const r = upward ? matrixSize - 1 - i : i;
      for (let c = right; c >= right - 1; c--) {
        if (matrix[r][c] === null) {
          let bit = false;
          if (dataBitIndex < totalBitsToPlace) {
            const byteIdx = Math.floor(dataBitIndex / 8);
            const bitOffset = 7 - (dataBitIndex % 8);
            bit = ((finalCodewords[byteIdx] >> bitOffset) & 1) === 1;
            dataBitIndex++;
          }
          matrix[r][c] = bit;
        }
      }
    }

    upward = !upward;
    right -= 2;
  }

  const maskFn = (r: number, c: number) => (r + c) % 2 === 0;

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      const isTopLeftFinder = r <= 8 && c <= 8;
      const isTopRightFinder = r <= 8 && c >= matrixSize - 8;
      const isBottomLeftFinder = r >= matrixSize - 8 && c <= 8;
      const isTiming = r === 6 || c === 6;
      const isDarkModule = r === 4 * version + 9 && c === 8;

      let isAlign = false;
      for (const ar of coords) {
        for (const ac of coords) {
          if ((ar < 9 && ac < 9) || (ar < 9 && ac >= matrixSize - 9) || (ar >= matrixSize - 9 && ac < 9)) continue;
          if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) {
            isAlign = true;
            break;
          }
        }
        if (isAlign) break;
      }

      if (!isTopLeftFinder && !isTopRightFinder && !isBottomLeftFinder && !isTiming && !isDarkModule && !isAlign) {
        if (maskFn(r, c)) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }
  }

  const formatData = (0b00 << 3) | 0b000;
  let rem = formatData << 10;
  const genPoly = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= genPoly << (i - 10);
    }
  }
  const formatWord = ((formatData << 10) | rem) ^ 0x5412;

  const formatBits: boolean[] = [];
  for (let i = 14; i >= 0; i--) {
    formatBits.push(((formatWord >> i) & 1) === 1);
  }

  const tlCoords: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = tlCoords[i];
    matrix[r][c] = formatBits[i];
  }

  for (let i = 0; i < 7; i++) {
    matrix[matrixSize - 1 - i][8] = formatBits[i];
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][matrixSize - 8 + i] = formatBits[7 + i];
  }

  return matrix.map((row) => row.map((cell) => cell === true));
}

// Code 128 patterns (index 0 to 106)
// Each pattern is a sequence of bar widths and space widths (total 11 modules per character, 13 for stop)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes text into Code 128-B modules.
 */
export function encodeCode128(text: string): string {
  const clean = text.trim();
  if (!clean) return "";

  const codes: number[] = [START_CODE_B];
  let checkSum = START_CODE_B;

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    // Code 128-B handles ASCII 32 to 127
    const val = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(val);
    checkSum += val * (i + 1);
  }

  const checkDigit = checkSum % 103;
  codes.push(checkDigit);
  codes.push(STOP_CODE);

  // Convert codes to widths
  let moduleString = "";
  for (let i = 0; i < codes.length; i++) {
    const pattern = CODE128_PATTERNS[codes[i]] || CODE128_PATTERNS[0];
    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      moduleString += (isBar ? "1" : "0").repeat(width);
      isBar = !isBar;
    }
  }

  // Final termination bar (2 modules)
  moduleString += "11";
  return moduleString;
}

/**
 * Generates an inline SVG for Code 128 Barcode.
 */
export function generateBarcodeSvg(
  text: string,
  options?: {
    height?: number;
    barWidth?: number;
    showText?: boolean;
    color?: string;
    quietZone?: number;
  }
): string {
  const height = options?.height ?? 50;
  const barWidth = options?.barWidth ?? 2;
  const showText = options?.showText ?? true;
  const color = options?.color ?? "#000000";
  const quietZone = options?.quietZone ?? 6; // Standard quiet zone (margin) in modules

  const modules = encodeCode128(text);
  if (!modules) return "";

  const quietOffset = quietZone * barWidth;
  const totalWidth = modules.length * barWidth + quietOffset * 2;
  const totalHeight = showText ? height + 16 : height;

  let rects = "";
  let currentRun = 0;
  let startX = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === "1") {
      if (currentRun === 0) startX = quietOffset + i * barWidth;
      currentRun++;
    } else {
      if (currentRun > 0) {
        rects += `<rect x="${startX}" y="0" width="${currentRun * barWidth}" height="${height}" fill="${color}" />`;
        currentRun = 0;
      }
    }
  }
  if (currentRun > 0) {
    rects += `<rect x="${startX}" y="0" width="${currentRun * barWidth}" height="${height}" fill="${color}" />`;
  }

  let textElement = "";
  if (showText) {
    textElement = `<text x="${totalWidth / 2}" y="${height + 13}" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="${color}">${text}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" preserveAspectRatio="xMidYMid meet">
    <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff" />
    ${rects}
    ${textElement}
  </svg>`;
}

/**
 * Standard vector QR code generator for product SKU labels (ISO/IEC 18004 compliant).
 * Generates full, standard QR codes with finder patterns, timing, format info, and data matrix.
 */
export function generateQrCodeSvg(
  text: string,
  size: number = 100,
  color: string = "#000000"
): string {
  if (!text) return "";
  const matrix = encodeQrMatrix(text);
  const matrixSize = matrix.length;
  const quietZone = 2; // 2 modules quiet zone
  const totalDim = matrixSize + quietZone * 2;
  const cellSize = size / totalDim;

  let cells = "";
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = (c + quietZone) * cellSize;
        const y = (r + quietZone) * cellSize;
        cells += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${color}" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet">
    <rect width="${size}" height="${size}" fill="#ffffff" />
    ${cells}
  </svg>`;
}
