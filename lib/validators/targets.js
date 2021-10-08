const validator = require("validator").default;

function isTargetIdValid(id) {
  if (!validator.isNumeric((id || "").toString())) {
    return false;
  }
  return true;
}

function isTargetUrlValid(url) {
  if (!validator.isURL(url || "")) {
    return false;
  }
  return true;
}

function isTargetValueValid(value) {
  if (!validator.isNumeric((value || "").toString())) {
    return false;
  }
  return true;
}

function isTargetMaxAcceptsPerDayValid(maxAcceptsPerDay) {
  if (
    !validator.isNumeric((maxAcceptsPerDay || "").toString()) ||
    parseInt(maxAcceptsPerDay || -1) < 0
  ) {
    return false;
  }
  return true;
}

function isTargetAcceptValid(accept) {
  if (!accept) {
    return false;
  }

  if (
    !accept.geoState ||
    !accept.geoState["$in"] ||
    !Array.isArray(accept.geoState["$in"])
  ) {
    return false;
  }

  if (
    !accept.hour ||
    !accept.hour["$in"] ||
    !Array.isArray(accept.hour["$in"])
  ) {
    return false;
  }
  return true;
}

function isPostTargetValid(target) {
  if (!target) {
    return {
      valid: false,
      message: "Empty body",
    };
  }
  if (!isTargetIdValid(target.id)) {
    return {
      valid: false,
      message: "Invalid target id",
    };
  }
  if (!isTargetUrlValid(target.url)) {
    return {
      valid: false,
      message: "Invalid target url",
    };
  }
  if (!isTargetValueValid(target.value)) {
    return {
      valid: false,
      message: "Invalid target value",
    };
  }
  if (!isTargetMaxAcceptsPerDayValid(target.maxAcceptsPerDay)) {
    return {
      valid: false,
      message: "Invalid target maxAcceptsPerDay",
    };
  }
  if (!isTargetAcceptValid(target.accept)) {
    return { valid: false, message: "Invalid target accept" };
  }

  return { valid: true };
}

function isUpdateTargetValid(changes) {
  if (
    !changes ||
    typeof changes !== "object" ||
    Object.keys(changes).length === 0
  ) {
    return {
      valid: false,
      message: "Empty body",
    };
  }
  if (
    typeof parseInt(changes.maxAcceptsPerDay) === "number" &&
    !isTargetMaxAcceptsPerDayValid(changes.maxAcceptsPerDay)
  ) {
    return {
      valid: false,
      message: "Invalid target maxAcceptsPerDay",
    };
  }
  if (changes.url && !isTargetUrlValid(changes.url)) {
    return {
      valid: false,
      message: "Invalid target url",
    };
  }
  if (changes.value && !isTargetValueValid(changes.value)) {
    return {
      valid: false,
      message: "Invalid target value",
    };
  }
  if (changes.accept && !isTargetAcceptValid(changes.accept)) {
    return {
      valid: false,
      message: "Invalid target accept",
    };
  }
  return { valid: true };
}

module.exports = {
  isPostTargetValid,
  isUpdateTargetValid,
};
