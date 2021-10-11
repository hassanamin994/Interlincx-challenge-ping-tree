const { validateGetUsableTarget } = require('../validators/route')
const targetService = require('../targetService')
const sendJson = require('send-data/json')

async function getUsableTarget (req, res, _, cb) {
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', async () => {
    try {
      const parsedBody = JSON.parse(body)
      const validateResult = validateGetUsableTarget(parsedBody)

      if (!validateResult.valid) {
        return cb(new Error(validateResult.message))
      }

      const target = await targetService.getUsableTarget(
        parsedBody.geoState,
        new Date(parsedBody.timestamp).getUTCHours()
      )
      if (!target) {
        return sendJson(req, res, {
          decision: 'reject'
        })
      }

      return sendJson(req, res, {
        url: target.url
      })
    } catch (err) {
      console.log(err)
      return cb(new Error('Something went wrong'))
    }
  })
}

module.exports = {
  getUsableTarget
}
