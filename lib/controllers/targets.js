const sendJson = require('send-data/json')
const {
  isPostTargetValid,
  isUpdateTargetValid
} = require('../validators/targets')
const targetService = require('../targetService')

module.exports = {
  addTarget,
  getAllTargets,
  getTargetById,
  updateTargetById
}

async function addTarget (req, res, _, cb) {
  let data = ''

  req.on('data', (chunk) => {
    data += chunk
  })

  req.on('end', async () => {
    try {
      const target = JSON.parse(data)
      const validationResult = isPostTargetValid(target)

      if (!validationResult.valid) {
        return cb(new Error(validationResult.message))
      }

      const addedTarget = await targetService.addTarget(target)
      sendJson(req, res, addedTarget)
    } catch (err) {
      console.log(err)
      return cb(new Error('Something went wrong'))
    }
  })
}

async function getAllTargets (req, res, _, cb) {
  try {
    const targets = await targetService.getAllTargets()
    sendJson(req, res, targets)
  } catch (err) {
    console.log(err)
    return cb(new Error('Something went wrong'))
  }
}

async function getTargetById (req, res, options, cb) {
  try {
    const params = options.params
    const target = await targetService.getTargetById(params.id)
    sendJson(req, res, target)
  } catch (err) {
    console.log(err)
    return cb(new Error('Something went wrong'))
  }
}

async function updateTargetById (req, res, options, cb) {
  try {
    const params = options.params
    let changes = ''

    req.on('data', (chunk) => {
      changes += chunk
    })

    req.on('end', async () => {
      const parsedChanges = JSON.parse(changes)

      const validationResult = isUpdateTargetValid(parsedChanges)
      if (!validationResult.valid) {
        return cb(new Error(validationResult.message))
      }

      const updatedTarget = await targetService.updateTargetById(
        params.id,
        parsedChanges
      )

      sendJson(req, res, updatedTarget)
    })
  } catch (err) {
    console.log(err)
    return cb(new Error('Something went wrong'))
  }
}
