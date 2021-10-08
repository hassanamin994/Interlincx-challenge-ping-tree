const redisClient = require("./redis");
const { promisify } = require("util");
const targetHMKey = `target`;
targetUsedAcceptsPerDayHMKey = "target:usedAcceptsPerDay";

redisClient.flushall = promisify(redisClient.flushall).bind(redisClient);
redisClient.sadd = promisify(redisClient.sadd).bind(redisClient);
redisClient.smembers = promisify(redisClient.smembers).bind(redisClient);
redisClient.zrevrange = promisify(redisClient.zrevrange).bind(redisClient);
redisClient.zcard = promisify(redisClient.zcard).bind(redisClient);
redisClient.hmget = promisify(redisClient.hmget).bind(redisClient);
redisClient.hgetall = promisify(redisClient.hgetall).bind(redisClient);
redisClient.hincrby = promisify(redisClient.hincrby).bind(redisClient);

async function addTarget(target) {
  // set keys for each target_geoState_hour: list(id)
  const multi = redisClient.multi();
  for (const state of target.accept.geoState["$in"]) {
    for (const hour of target.accept.hour["$in"]) {
      const stateHourIdKey = `target:state_hour:id:${state}:${hour}`;
      const stateHourValueKey = `target:state_hour:value:${state}:${hour}`;
      multi
        // ids for all targets supporting state:hour
        .sadd(stateHourIdKey, target.id)
        // sorted values for all targets supporting state:hour
        .zadd(stateHourValueKey, parseFloat(target.value), target.id);
    }
  }

  await new Promise((resolve, reject) => {
    multi
      // target info
      .hmset(targetHMKey, target.id, JSON.stringify(target))
      // target usage per day
      .hmset(targetUsedAcceptsPerDayHMKey, target.id, 0, "EX", 24 * 60 * 60)
      .exec((err, reply) => {
        if (err) return reject(err);
        return resolve(reply);
      });
  });
  return target;
}

async function updateTargetById(targetId, changes) {
  const target = await redisClient.hmget(targetHMKey, targetId);
  if (!target) {
    throw new Error("Invalid targetId");
  }
  const parsedTarget = JSON.parse(target);
  const oldTarget = { ...parsedTarget };

  // apply changes to the object
  Object.keys(changes).forEach((key) => {
    if (typeof changes[key] === "object") {
      parsedTarget[key] = {
        ...parsedTarget[key],
        ...changes[key],
      };
    } else {
      parsedTarget[key] = changes[key];
    }
  });

  const multi = redisClient.multi();

  if (changes.accept && changes.accept.geoState) {
    const { deletedGeoStateHours, addedGeoStateHours } = getGeoStateHourChange(
      oldTarget,
      changes
    );

    // delete deleted geoState hour
    deletedGeoStateHours.forEach(async (geoStateHour) => {
      const stateHourIdKey = `target:state_hour:id:${geoStateHour}`;
      const stateHourValueKey = `target:state_hour:value:${geoStateHour}`;

      multi
        .srem(stateHourIdKey, parsedTarget.id)
        .zrem(stateHourValueKey, parsedTarget.id);
    });

    // add new geoState hour
    addedGeoStateHours.forEach((geoStateHour) => {
      const stateHourIdKey = `target:state_hour:id:${geoStateHour}`;
      const stateHourValueKey = `target:state_hour:value:${geoStateHour}`;
      multi
        // ids for all targets supporting state:hour
        .sadd(stateHourIdKey, parsedTarget.id)
        // sorted values for all targets supporting state:hour
        .zadd(
          stateHourValueKey,
          parseFloat(parsedTarget.value),
          parsedTarget.id
        );
    });
  }
  // finalize update, add new target info and execute transaction
  await new Promise((resolve, reject) => {
    multi
      // target info
      .hmset(targetHMKey, parsedTarget.id, JSON.stringify(parsedTarget))
      .exec((err, reply) => {
        if (err) return reject(err);
        return resolve(reply);
      });
  });
  //   console.dir({ parsedTarget }, { depth: null });
  return JSON.parse(await redisClient.hmget(targetHMKey, parsedTarget.id));
}

async function getAllTargets() {
  const targets = await redisClient.hgetall(targetHMKey);

  if (!targets) {
    return [];
  }

  const parsedTargets = Object.values(targets).map((target) =>
    JSON.parse(target)
  );
  return parsedTargets;
}

async function getTargetById(targetId) {
  const target = await redisClient.hmget(targetHMKey, targetId);
  if (target) {
    return JSON.parse(target);
  }
  return null;
}

async function getUsableTarget(geoState, hour) {
  const membersKey = `target:state_hour:value:${geoState}:${hour}`;
  //   const membersCount = await redisClient.zcard(membersKey)
  const members = await redisClient.zrevrange(membersKey, 0, -1);

  let acceptedTarget = null;

  for (const memberId of members) {
    const target = JSON.parse(await redisClient.hmget(targetHMKey, memberId));
    const targetUsedAcceptsPerDay = parseFloat(
      await redisClient.hmget(targetUsedAcceptsPerDayHMKey, target.id)
    );

    if (
      target &&
      target.maxAcceptsPerDay &&
      parseInt(target.maxAcceptsPerDay) > parseInt(targetUsedAcceptsPerDay)
    ) {
      acceptedTarget = target;
      await redisClient.hincrby(targetUsedAcceptsPerDayHMKey, target.id, 1);
      break;
    }
  }

  return acceptedTarget;
}

function getGeoStateHourChange(oldTarget, changes) {
  // check for geoState:hour changes
  let oldGeoState = [];
  let oldHours = [];

  let newGeoState = [];
  let newHours = [];

  if (oldTarget.accept) {
    if (oldTarget.accept.geoState && oldTarget.accept.geoState["$in"]) {
      oldGeoState = oldTarget.accept.geoState["$in"];
    }
    if (oldTarget.accept.hour && oldTarget.accept.hour["$in"]) {
      oldHours = oldTarget.accept.hour["$in"];
    }
  }

  if (changes.accept) {
    if (changes.accept.geoState && changes.accept.geoState["$in"]) {
      newGeoState = changes.accept.geoState["$in"];
    }
    if (changes.accept.hour && changes.accept.hour["$in"]) {
      newHours = changes.accept.hour["$in"];
    }
  }

  const oldGeoStateHours = [];
  const newGeoStateHours = [];

  for (const state of oldGeoState) {
    for (const hour of oldHours) {
      oldGeoStateHours.push(`${state}:${hour}`);
    }
  }

  for (const state of newGeoState) {
    for (const hour of newHours) {
      newGeoStateHours.push(`${state}:${hour}`);
    }
  }

  const deletedGeoStateHours = oldGeoStateHours.filter(
    (geoStateHour) => !newGeoStateHours.includes(geoStateHour)
  );
  const addedGeoStateHours = newGeoStateHours.filter(
    (geoStateHour) => !oldGeoStateHours.includes(geoStateHour)
  );

  return { deletedGeoStateHours, addedGeoStateHours };
}

module.exports = {
  addTarget,
  getAllTargets,
  getUsableTarget,
  getTargetById,
  updateTargetById,
};
