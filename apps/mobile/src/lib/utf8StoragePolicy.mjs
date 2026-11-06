function utf8BytesForCodePoint(codePoint) {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

function utf8ByteLength(value) {
  if (typeof value !== "string") {
    throw new TypeError("value must be a string");
  }
  let length = 0;
  for (const character of value) {
    length += utf8BytesForCodePoint(character.codePointAt(0));
  }
  return length;
}

function splitUtf8String(value, maximumBytes) {
  if (typeof value !== "string") {
    throw new TypeError("value must be a string");
  }
  if (!Number.isInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError("maximumBytes must be a positive integer");
  }

  const chunks = [];
  let chunk = "";
  let chunkBytes = 0;
  for (const character of value) {
    const characterBytes = utf8BytesForCodePoint(character.codePointAt(0));
    if (characterBytes > maximumBytes) {
      throw new Error("A character exceeds the secure storage chunk limit.");
    }
    if (chunk && chunkBytes + characterBytes > maximumBytes) {
      chunks.push(chunk);
      chunk = "";
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  chunks.push(chunk);
  return chunks;
}

export { splitUtf8String, utf8ByteLength };
