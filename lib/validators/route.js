function validateGetUsableTarget (body) {
  if (!body) {
    return {
      valid: false,
      message: 'Empty body'
    }
  }
  return { valid: true }
}

module.exports = {
  validateGetUsableTarget
}
