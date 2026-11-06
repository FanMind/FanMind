const BEARER_PATTERN = /^Bearer ([^\s]{20,8192})$/;

export class BearerAccessTokenError extends Error {
  constructor(message = "Ungültige mobile Zugriffssitzung.") {
    super(message);
    this.name = "BearerAccessTokenError";
  }
}

export function getOptionalBearerAccessToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization) return undefined;

  const match = authorization.match(BEARER_PATTERN);
  const token = match?.[1];
  if (!token || /[\r\n\0]/.test(token)) {
    throw new BearerAccessTokenError();
  }

  return token;
}
