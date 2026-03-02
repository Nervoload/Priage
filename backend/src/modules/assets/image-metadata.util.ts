export type ImageMetadata = {
  width: number;
  height: number;
};

export function readImageMetadata(buffer: Buffer, mimeType: string): ImageMetadata {
  switch (mimeType) {
    case 'image/png':
      return readPngMetadata(buffer);
    case 'image/jpeg':
      return readJpegMetadata(buffer);
    case 'image/webp':
      return readWebpMetadata(buffer);
    default:
      throw new Error(`Unsupported image mime type: ${mimeType}`);
  }
}

function readPngMetadata(buffer: Buffer): ImageMetadata {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Invalid PNG data');
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegMetadata(buffer: Buffer): ImageMetadata {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Invalid JPEG data');
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (!marker) {
      break;
    }

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame = (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    );

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  throw new Error('JPEG dimensions could not be determined');
}

function readWebpMetadata(buffer: Buffer): ImageMetadata {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Invalid WEBP data');
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X') {
    return {
      width: 1 + readUInt24LE(buffer, 24),
      height: 1 + readUInt24LE(buffer, 27),
    };
  }

  if (chunkType === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (chunkType === 'VP8 ') {
    const startCode = Buffer.from([0x9d, 0x01, 0x2a]);
    const startCodeIndex = buffer.indexOf(startCode, 20);
    if (startCodeIndex === -1 || startCodeIndex + 7 >= buffer.length) {
      throw new Error('WEBP dimensions could not be determined');
    }

    return {
      width: buffer.readUInt16LE(startCodeIndex + 3) & 0x3fff,
      height: buffer.readUInt16LE(startCodeIndex + 5) & 0x3fff,
    };
  }

  throw new Error('Unsupported WEBP chunk type');
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}
