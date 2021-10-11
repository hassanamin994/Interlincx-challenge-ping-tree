const validator = require('validator').default

function validateGetUsableTarget (body) {
  if (!body) {
    return {
      valid: false,
      message: 'Empty body'
    }
  }
  if (!body.geoState) {
    return {
      valid: false,
      message: 'Invalid geoState'
    }
  }
  if (!body.timestamp || !validator.isDate(new Date(body.timestamp))) {
    return {
      valid: false,
      message: 'Invalid timestampe'
    }
  }
  return { valid: true }
}

module.exports = {
  validateGetUsableTarget
}
