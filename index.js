require('dotenv').config()

const express = require('express')
const apicache = require('apicache')
const crypto = require('crypto')
const morgan = require('morgan')
const { createProxyMiddleware } = require('http-proxy-middleware')

// Configuration
const PORT = process.env.PORT
const API_SERVICE_URL = process.env.API_SERVICE_URL
const CACHE_DURATION = process.env.CACHE_DURATION
const CACHE_DEBUG = process.env.CACHE_DEBUG
const CACHE_HEADER = process.env.CACHE_HEADER

// Create Express Server
let app = express()

// Define cache
let cache = apicache.middleware

// Re-stream parsed body before proxying
let fixRequestBody = function(proxyReq, req, res, options) {
    if (req.body) {
        let bodyData = JSON.stringify(req.body)
        // incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
        proxyReq.setHeader('Content-Type','application/json')
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
        // stream the content
        proxyReq.write(bodyData)
    }
}

app
    .use(morgan('dev'))
    .use(express.json({limit: '50mb'}))
    .use(function (req, res, next) {

        // Hash the request body
        let bodyString = JSON.stringify(req.body)
        let hash =  crypto.createHash('sha256').update(bodyString, 'binary').digest('base64')

        // Define cache options
        apicache.options({
            appendKey: (req) => req.headers[CACHE_HEADER] + hash,
            debug: CACHE_DEBUG,
            statusCode: {
                include: [200]
            },
            headers: {
                'accept-encoding': 'gzip,deflate'
            }
        })
        next()
    })
    .use(cache(CACHE_DURATION))

// Proxy the request
app.use('*', createProxyMiddleware({
    target: API_SERVICE_URL,
    onProxyReq: fixRequestBody,
    changeOrigin: true
}));

app.listen(PORT, () => {
    console.log(`Listening on port:${PORT}`)
});
