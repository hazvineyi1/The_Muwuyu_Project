// Errors that carry an HTTP status, so the route layer never has to guess.

class OpError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// A stale write. Carries the CURRENT state of whatever was being written, so
// the client can merge rather than clobber — the whole point of the exercise.
class ConflictError extends OpError {
  constructor(message, current) {
    super(409, 'conflict', message, { current });
    this.current = current;
  }
}

const badRequest = (msg, details) => new OpError(400, 'bad_request', msg, details);
const notFound   = (msg, details) => new OpError(404, 'not_found', msg, details);
// A link that would make somebody their own ancestor, or give them a second
// set of parents. Data integrity, not a UI nicety.
const cycle      = (msg, details) => new OpError(422, 'cycle', msg, details);
// A name with nobody on the other end of it. "To be added to the tree you need
// to be connected to somebody." Its own code rather than a bad_request,
// because it is the one refusal a family will actually meet and the page has
// something better to say about it than "that could not be saved".
const adrift     = (msg, details) => new OpError(422, 'not_joined', msg, details);

module.exports = { OpError, ConflictError, badRequest, notFound, cycle, adrift };
