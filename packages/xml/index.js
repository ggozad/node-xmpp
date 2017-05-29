'use strict'

const ltx = require('ltx')
const tag = require('./lib/tag')

function xml(...args) {
  return tag(...args)
}

exports = module.exports = xml

Object.assign(exports, ltx)

exports.tag = require('./lib/tag')
exports.ltx = ltx
