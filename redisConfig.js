const redis = require('redis');
let client;

(async () => {
  client = redis.createClient();
  client.on("error", error => console.log(`Error: ${error}`));
  client.on('connect', () => {
    console.log('Connected to Redis');
  });
  await client.connect();
})();

module.exports = client;

