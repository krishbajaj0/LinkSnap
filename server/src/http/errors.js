export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const parserErrors = {
  'entity.parse.failed': new HttpError(400, 'INVALID_JSON', 'Request body must contain valid JSON.'),
  'entity.too.large': new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit.'),
  'charset.unsupported': new HttpError(415, 'UNSUPPORTED_ENCODING', 'Request body encoding is unsupported.'),
  'encoding.unsupported': new HttpError(415, 'UNSUPPORTED_ENCODING', 'Request body encoding is unsupported.'),
  'request.aborted': new HttpError(400, 'REQUEST_ABORTED', 'Request ended before the body was received.'),
  'request.size.invalid': new HttpError(400, 'INVALID_BODY_SIZE', 'Request body length is invalid.'),
};

export function notFound(_request, _response, next) {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found.'));
}

export function handleError(error, _request, response, next) {
  if (response.headersSent) return next(new Error('Request failed after response started.'));

  const knownError = error instanceof HttpError
    ? error
    : Object.hasOwn(parserErrors, error.type) ? parserErrors[error.type] : undefined;
  const { status, code, message } = knownError
    ?? new HttpError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');

  if (status >= 500 && !knownError) console.error('Unexpected request error.');

  response.status(status).json({ success: false, error: { code, message } });
}
