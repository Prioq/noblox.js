// Includes
const http = require('./http.js').func

// Args
exports.required = ['url', 'query', 'limit']
exports.optional = ['jar', 'sortOrder']

// Docs
/**
 * ✅ Handle pagination returned by Roblox.
 * @category Utility
 * @alias getPageResults
 * @param {string} url - The url to retrieve the page results from.
 * @param {string} query - Any query parameters to add to the url.
 * @param {SortOrder=} sortOrder - The order to sort the results by.
 * @param {Limit=} limit - The maximum number of results to return. Following 'pages' of results will be requested until
 * this limit of results is reached.
 * @param {string=} pageCursor - Current page index
 * @returns {Promise<Array>}
 * @example const noblox = require("noblox.js")
 * const inventory = await noblox.getPageResults("//inventory.roblox.com/v2/users/1/inventory", "Shirt", "Asc", 100)
**/

// Define
function getPageResults (jar, url, query, sortOrder, limit, pageCursor, results) {
  return new Promise((resolve, reject) => {
    const allowedLimits = [10, 25, 50, 100]

    const httpOpt = {
      url,
      options: {
        qs: {
          limit: limit <= 100 ? allowedLimits.reduce((prev, curr) => Math.abs(curr - limit) < Math.abs(prev - limit) ? curr : prev) : 100,
          cursor: pageCursor || '',
          ...query
        },
        method: 'GET',
        resolveWithFullResponse: true,
        jar,
        json: true
      }
    }

    return http(httpOpt).then((res) => {
      if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
        let body = res.body

        if (typeof (body) === 'string') {
          try {
            body = JSON.parse(body.trim())
          } catch (error) {
            return reject(new Error('Failed to parse JSON response'))
          }
        }

        const data = body.data

        if (body.errors && body.errors.length > 0) {
          const errors = body.errors.map((e) => e.message)
          return reject(new Error(`${res.statusCode} ${errors.join(', ')}`))
        }

        results = results ? results.concat(data) : data

        if (results.length > limit) {
          results = results.slice(0, limit)
        }

        if (results.length >= limit || data.length === 0 || !body.nextPageCursor) {
          return resolve(results)
        }

        resolve(getPageResults(jar, url, query, sortOrder, limit, body.nextPageCursor, results))
      } else {
        reject(new Error('Non-JSON response received'))
      }
    })
      .catch(error => reject(error))
  })
}

function parseDates (results) {
  return new Promise((resolve, reject) => {
    if (!results) return resolve([])

    resolve(results.map(result => {
      if (result.created) result.created = new Date(result.created)
      if (result.updated) result.updated = new Date(result.updated)
      return result
    }))
  })
}

exports.func = function (args) {
  return getPageResults(args.jar, args.url, args.query, args.sortOrder, args.limit).then(results => {
    return parseDates(results)
  })
}
