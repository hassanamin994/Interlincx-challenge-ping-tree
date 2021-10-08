process.env.NODE_ENV = "test";

var test = require("ava");
var servertest = require("servertest");

var server = require("../lib/server")();

var target = require("./mocks/target.json");

test.serial.cb("healthcheck", function (t) {
  var url = "/health";
  servertest(server, url, { encoding: "json" }, function (err, res) {
    t.falsy(err, "no error");

    t.is(res.statusCode, 200, "correct statusCode");
    t.is(res.body.status, "OK", "status is ok");
    t.end();
  });
});

// add target

test.serial.cb("POST /api/targets", function (t) {
  var url = "/api/targets";

  var addTargetStream = servertest(server, url, {
    method: "POST",
    encoding: "json",
  });

  addTargetStream.write(JSON.stringify(target));
  addTargetStream.end();

  let response = "";
  addTargetStream.on("data", (chunk) => {
    response += chunk;
  });
  addTargetStream.on("end", () => {
    const parsedResponse = JSON.parse(response);
    t.deepEqual(parsedResponse, target, "Invalid response");
    t.end();
  });
});

test.serial.cb("GET /api/targets", function (t) {
  var url = "/api/targets";

  servertest(server, url, { encoding: "json" }, function (err, res) {
    t.is(res.statusCode, 200);
    t.deepEqual([target], res.body);
    t.end();
  });
});

test.serial.cb("GET /api/targets/:id", function (t) {
  var url = "/api/targets/1";

  servertest(server, url, { encoding: "json" }, function (err, res) {
    t.is(res.statusCode, 200);
    t.deepEqual(target, res.body);
    t.end();
  });
});

test.serial.cb("POST /api/targets/:id", function (t) {
  var url = "/api/targets/1";

  var updateTargetStream = servertest(server, url, {
    method: "POST",
    encoding: "json",
  });

  updateTargetStream.write(JSON.stringify({ maxAcceptsPerDay: 15 }));
  updateTargetStream.end();

  let response = "";
  updateTargetStream.on("data", (chunk) => {
    response += chunk;
  });
  updateTargetStream.on("end", () => {
    const parsedResponse = JSON.parse(response);
    t.is(parsedResponse.maxAcceptsPerDay, 15);
    t.end();
  });
});

test.serial.cb("POST /route", function (t) {
  var url = "/route";

  var updateTargetStream = servertest(server, url, {
    method: "POST",
    encoding: "json",
  });

  updateTargetStream.write(
    JSON.stringify({
      geoState: "ca",
      publisher: "abc",
      timestamp: "2018-07-19T14:28:59.513Z",
    })
  );
  updateTargetStream.end();

  let response = "";
  updateTargetStream.on("data", (chunk) => {
    response += chunk;
  });
  updateTargetStream.on("end", () => {
    const parsedResponse = JSON.parse(response);
    t.is(parsedResponse.url, target.url);
    t.end();
  });
});
