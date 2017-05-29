'use strict'

const LtxParser = require('ltx/lib/parsers/ltx')
const escape = require('ltx').escapeXML
const {Element} = require('ltx')

module.exports = function tag(literals, ...substitutions) {
  const parser = new LtxParser()

  let el
  let tree
  let i
  parser.on('startElement', (name, attrs) => {
    const child = new Element(name, attrs)
    if (el) {
      el = el.cnode(child)
    } else {
      el = child
    }
  })
  parser.on('endElement', name => {
    if (name === el.name) {
      if (el.parent) {
        el = el.parent
      } else if (!tree) {
        tree = el
        el = undefined
      }
    }
  })
  parser.on('text', str => {
    if (!el) {
      return
    }

    if (substitutions[i - 1] === str) {
      el.t(str)
    } else {
      str = str.trim()
      if (str) {
        el.t(str)
      }
    }
  })

  for (i = 0; i < substitutions.length; i++) {
    parser.write(literals[i])
    parser.write(escape(substitutions[i]))
  }
  parser.end(literals[literals.length - 1])

  return tree
}
