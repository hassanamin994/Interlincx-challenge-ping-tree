const { promisify } = require('util')
const redisClient = require('./redis')
const targetHMKey = 'target'
const targetUsedAcceptsPerDayHMKey = 'target:usedAcceptsPerDay'

redisClient.flushall = promisify(redisClient.flushall).bind(redisClient)
redisClient.del = promisify(redisClient.del).bind(redisClient)
redisClient.sadd = promisify(redisClient.sadd).bind(redisClient)
redisClient.sinter = promisify(redisClient.sinter).bind(redisClient)
redisClient.zinterstore = promisify(redisClient.zinterstore).bind(redisClient)
redisClient.smembers = promisify(redisClient.smembers).bind(redisClient)
redisClient.zrevrange = promisify(redisClient.zrevrange).bind(redisClient)
redisClient.zrange = promisify(redisClient.zrange).bind(redisClient)
redisClient.zcard = promisify(redisClient.zcard).bind(redisClient)
redisClient.zadd = promisify(redisClient.zadd).bind(redisClient)
redisClient.zrem = promisify(redisClient.zrem).bind(redisClient)
redisClient.hmget = promisify(redisClient.hmget).bind(redisClient)
redisClient.hgetall = promisify(redisClient.hgetall).bind(redisClient)
redisClient.hincrby = promisify(redisClient.hincrby).bind(redisClient)

module.exports = {
  addTarget,
  getAllTargets,
  getUsableTarget,
  getTargetById,
  updateTargetById
}

async function addTarget (target) {
  // set keys for each target_geoState_hour: list(id)
  const multi = redisClient.multi()
    // target info
    .hmset(targetHMKey, target.id, JSON.stringify(target))
    // target usage per day
    .hmset(targetUsedAcceptsPerDayHMKey, target.id, 0, 'EX', 24 * 60 * 60)
  const { accept } = target

  const setsKeys = getNestedValues({ accept })
  for (const key of setsKeys) {
    multi
      // sorted values for all targets supporting state:hour
      .zadd(`target:${key}`, parseFloat(target.value), target.id)
  }

  await new Promise((resolve, reject) => {
    multi
      .exec((err, reply) => {
        if (err) return reject(err)
        return resolve(reply)
      })
  })
  return target
}

async function updateTargetById (targetId, changes) {
  const target = await redisClient.hmget(targetHMKey, targetId)
  if (!target) {
    throw new Error('Invalid targetId')
  }
  const parsedTarget = JSON.parse(target)
  const oldTarget = { ...parsedTarget }
  // apply changes to the object
  Object.keys(changes).forEach((key) => {
    if (typeof changes[key] === 'object') {
      parsedTarget[key] = {
        ...parsedTarget[key],
        ...changes[key]
      }
    } else {
      parsedTarget[key] = changes[key]
    }
  })

  const multi = redisClient.multi()

  if (changes.accept) {
    const { accept: oldAccept } = oldTarget

    const oldSetsKeys = getNestedValues({ accept: oldAccept })

    const { accept: newAccept } = parsedTarget

    const newSetsKeys = getNestedValues({ accept: newAccept })

    const { addedItems, deletedItems } = getStringArrayDiff(oldSetsKeys, newSetsKeys)

    for (const key of addedItems) {
      multi
      // sorted values for all targets supporting state:hour
        .zadd(`target:${key}`, parseFloat(parsedTarget.value), parsedTarget.id)
    }
    for (const key of deletedItems) {
      multi
      // sorted values for all targets supporting state:hour
        .zrem(`target:${key}`, parsedTarget.id)
    }
  }
  // finalize update, add new target info and execute transaction
  await new Promise((resolve, reject) => {
    multi
      // target info
      .hmset(targetHMKey, parsedTarget.id, JSON.stringify(parsedTarget))
      .exec((err, reply) => {
        if (err) return reject(err)
        return resolve(reply)
      })
  })
  //   console.dir({ parsedTarget }, { depth: null });
  return JSON.parse(await redisClient.hmget(targetHMKey, parsedTarget.id))
}

async function getAllTargets () {
  const targets = await redisClient.hgetall(targetHMKey)

  if (!targets) {
    return []
  }

  const parsedTargets = Object.values(targets).map((target) =>
    JSON.parse(target)
  )
  return parsedTargets
}

async function getTargetById (targetId) {
  const target = await redisClient.hmget(targetHMKey, targetId)
  if (target) {
    return JSON.parse(target)
  }
  return null
}

async function getUsableTarget (query) {
  const accept = formatGetUsableTargetQuery(query)
  const searchkeys = getNestedValues({ accept }).map(key => `target:${key}`)

  const intersectionKey = `target:accept.geoState_hour_inter:${searchkeys.join(':')}`
  await redisClient.zinterstore(intersectionKey, searchkeys.length, ...searchkeys)

  const members = await redisClient.zrevrange(intersectionKey, 0, -1)

  let acceptedTarget = null

  for (const memberId of members) {
    const target = JSON.parse(await redisClient.hmget(targetHMKey, memberId))
    const targetUsedAcceptsPerDay = parseFloat(
      await redisClient.hmget(targetUsedAcceptsPerDayHMKey, target.id)
    )

    if (
      target &&
      target.maxAcceptsPerDay &&
      parseInt(target.maxAcceptsPerDay) > parseInt(targetUsedAcceptsPerDay)
    ) {
      acceptedTarget = target
      await redisClient.hincrby(targetUsedAcceptsPerDayHMKey, target.id, 1)
      break
    }
  }

  await redisClient.del(intersectionKey)

  return acceptedTarget
}

function formatGetUsableTargetQuery (query) {
  const formattedQuery = {}
  Object.keys(query).forEach(key => {
    if (key === 'timestamp') {
      formattedQuery.hour = { $in: [new Date(query[key]).getUTCHours()] }
    } else {
      formattedQuery[key] = query[key]
    }
  })
  return formattedQuery
}

function getStringArrayDiff (oldArr, newArr) {
  const deletedItems = oldArr.filter(
    (geoStateHour) => !newArr.includes(geoStateHour)
  )
  const addedItems = newArr.filter(
    (geoStateHour) => !oldArr.includes(geoStateHour)
  )

  return { deletedItems, addedItems }
}

function getNestedValues (obj, prefix = '') {
  return Object.keys(obj).reduce(function (res, el) {
    if (typeof obj[el] === 'object' && obj[el] !== null) {
      return [...res, ...getNestedValues(obj[el], prefix + el + '.')]
    }
    if (Array.isArray(obj)) {
      return [...res, prefix + `${obj[el]}`]
    }
    return [...res, prefix + el + '.' + obj[el]]
  }, []).map(item => item.replace(/\$in\./g, ''))
}
