require('dotenv').config()

module.exports = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    ...(process.env.PASSWORD ? {password: process.env.PASSWORD} : {}),
    // password: process.env.REDIS_PASSWORD,
    ...(process.env.NODE_ENV === 'test' ? { fast: true } : {})
  }
}
