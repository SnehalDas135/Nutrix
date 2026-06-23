
export function sendError(res, statusCode, message, details = null) {
  return res.status(statusCode).json({
    error: {
      message: message,
      ...(process.env.NODE_ENV === 'development' && { details })
    }
  });
}