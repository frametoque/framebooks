/**
 * Pure TypeScript Code 128-B barcode and ISO/IEC 18004 QR Code SVG generator.
 * Open standards: ISO/IEC 15417 (Code 128) & ISO/IEC 18004 (QR Code).
 * Generates crisp vector SVGs suitable for any thermal printer or mobile camera screen scanning.
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
  return EXP[(LOG[a] + LOG[b]) % 255];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const factor = EXP[i];
    const nextPoly = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= poly[j];
      nextPoly[j + 1] ^= gfMul(poly[j], factor);
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
      remainder[j] ^= gfMul(gen[j + 1], factor);
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

const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

function getBchDigit(data: number): number {
  let digit = 0;
  while (data !== 0) {
    digit++;
    data >>>= 1;
  }
  return digit;
}

function getBchTypeInfo(data: number): number {
  let d = data << 10;
  const g15Digit = getBchDigit(G15);
  while (getBchDigit(d) - g15Digit >= 0) {
    d ^= G15 << (getBchDigit(d) - g15Digit);
  }
  return ((data << 10) | d) ^ G15_MASK;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8Bytes = new TextEncoder().encode(text);
  const dataLen = utf8Bytes.length;

  let version = 1;
  while (version < QR_VERSIONS.length) {
    const vInfo = QR_VERSIONS[version];
    const countBits = version <= 9 ? 8 : 16;
    const availableBits = vInfo.data * 8;
    const requiredBits = 4 + countBits + dataLen * 8;
    if (requiredBits <= availableBits) break;
    version++;
  }

  if (version >= QR_VERSIONS.length) version = QR_VERSIONS.length - 1;
  const vInfo = QR_VERSIONS[version];
  const charCountBits = version <= 9 ? 8 : 16;

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode indicator
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
  const isReserved: boolean[][] = Array.from({ length: matrixSize }, () =>
    Array(matrixSize).fill(false)
  );

  const addFinder = (originR: number, originC: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = originR + r;
        const mc = originC + c;
        if (mr < 0 || mr >= matrixSize || mc < 0 || mc >= matrixSize) continue;
        isReserved[mr][mc] = true;
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
      if (isReserved[r][c]) continue;

      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          isReserved[r + dr][c + dc] = true;
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
    if (!isReserved[6][i]) {
      isReserved[6][i] = true;
      matrix[6][i] = i % 2 === 0;
    }
    if (!isReserved[i][6]) {
      isReserved[i][6] = true;
      matrix[i][6] = i % 2 === 0;
    }
  }

  // Dark module
  const darkR = 4 * version + 9;
  const darkC = 8;
  isReserved[darkR][darkC] = true;
  matrix[darkR][darkC] = true;

  // Reserve format information regions
  for (let i = 0; i < 15; i++) {
    if (i < 6) {
      isReserved[i][8] = true;
    } else if (i < 8) {
      isReserved[i + 1][8] = true;
    } else {
      isReserved[matrixSize - 15 + i][8] = true;
    }
  }

  for (let i = 0; i < 15; i++) {
    if (i < 8) {
      isReserved[8][matrixSize - i - 1] = true;
    } else if (i < 9) {
      isReserved[8][15 - i] = true;
    } else {
      isReserved[8][15 - i - 1] = true;
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
        if (!isReserved[r][c]) {
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

  const masks = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number, c: number) => r % 2 === 0,
    (r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  let bestMask = 0;
  let bestPenalty = 1e9;

  for (let maskIdx = 0; maskIdx < masks.length; maskIdx++) {
    const maskFn = masks[maskIdx];
    const testMat: boolean[][] = Array.from({ length: matrixSize }, (_, r) =>
      Array.from({ length: matrixSize }, (_, c) => {
        const val = matrix[r][c] === true;
        if (!isReserved[r][c] && maskFn(r, c)) {
          return !val;
        }
        return val;
      })
    );

    let penalty = 0;

    // Feature 1: Runs of same color in rows and cols
    for (let r = 0; r < matrixSize; r++) {
      let run = 0;
      let prev: boolean | null = null;
      for (let c = 0; c < matrixSize; c++) {
        if (testMat[r][c] === prev) {
          run++;
        } else {
          if (run >= 5) penalty += 3 + (run - 5);
          run = 1;
          prev = testMat[r][c];
        }
      }
      if (run >= 5) penalty += 3 + (run - 5);
    }

    for (let c = 0; c < matrixSize; c++) {
      let run = 0;
      let prev: boolean | null = null;
      for (let r = 0; r < matrixSize; r++) {
        if (testMat[r][c] === prev) {
          run++;
        } else {
          if (run >= 5) penalty += 3 + (run - 5);
          run = 1;
          prev = testMat[r][c];
        }
      }
      if (run >= 5) penalty += 3 + (run - 5);
    }

    // Feature 2: 2x2 blocks of same color
    for (let r = 0; r < matrixSize - 1; r++) {
      for (let c = 0; c < matrixSize - 1; c++) {
        const clr = testMat[r][c];
        if (testMat[r + 1][c] === clr && testMat[r][c + 1] === clr && testMat[r + 1][c + 1] === clr) {
          penalty += 3;
        }
      }
    }

    // Feature 4: Proportion of dark modules
    let darkCnt = 0;
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (testMat[r][c]) darkCnt++;
      }
    }
    const ratio = Math.floor((darkCnt * 100) / (matrixSize * matrixSize));
    const prevMult = Math.floor(ratio / 5) * 5;
    const nextMult = prevMult + 5;
    penalty += Math.min(Math.floor(Math.abs(ratio - 50) / 5), Math.floor(Math.abs(nextMult - 50) / 5)) * 10;

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = maskIdx;
    }
  }

  // Apply winning mask
  const winningMaskFn = masks[bestMask];
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (!isReserved[r][c]) {
        if (winningMaskFn(r, c)) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }
  }

  // Error correction level M is 0 (00 in binary)
  const typeData = (0 << 3) | bestMask;
  const bitsVal = getBchTypeInfo(typeData);

  // Vertical placement of format bits
  for (let i = 0; i < 15; i++) {
    const mod = ((bitsVal >> i) & 1) === 1;
    if (i < 6) {
      matrix[i][8] = mod;
    } else if (i < 8) {
      matrix[i + 1][8] = mod;
    } else {
      matrix[matrixSize - 15 + i][8] = mod;
    }
  }

  // Horizontal placement of format bits
  for (let i = 0; i < 15; i++) {
    const mod = ((bitsVal >> i) & 1) === 1;
    if (i < 8) {
      matrix[8][matrixSize - i - 1] = mod;
    } else if (i < 9) {
      matrix[8][15 - i] = mod;
    } else {
      matrix[8][15 - i - 1] = mod;
    }
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
 * Compliant with ISO/IEC 15417.
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

  // The STOP pattern "2331112" (index 106) already includes the standard 2-module termination bar.
  return moduleString;
}

/**
 * Generates an inline SVG for Code 128 Barcode.
 * Standard ISO/IEC 15417 quiet zone is 10X.
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
  const quietZone = options?.quietZone ?? 10; // Standard quiet zone in modules (10X minimum)

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
        rects += `<rect x="${startX.toFixed(2)}" y="0" width="${(currentRun * barWidth).toFixed(2)}" height="${height}" fill="${color}" />`;
        currentRun = 0;
      }
    }
  }
  if (currentRun > 0) {
    rects += `<rect x="${startX.toFixed(2)}" y="0" width="${(currentRun * barWidth).toFixed(2)}" height="${height}" fill="${color}" />`;
  }

  let textElement = "";
  if (showText) {
    textElement = `<text x="${(totalWidth / 2).toFixed(2)}" y="${height + 13}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" font-weight="600" text-anchor="middle" fill="${color}">${text}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight}" width="${totalWidth.toFixed(2)}" height="${totalHeight}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">
    <rect width="${totalWidth.toFixed(2)}" height="${totalHeight}" fill="#ffffff" />
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
  const quietZone = 4; // ISO/IEC 18004 specifies minimum 4 modules quiet zone
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="#ffffff" />
    ${cells}
  </svg>`;
}
