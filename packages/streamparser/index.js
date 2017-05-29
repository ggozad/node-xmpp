'use strict'

const EventEmitter = require('events')
const LtxParser = require('ltx/lib/parsers/ltx')
const {Element} = require('@xmpp/xml')

/**
 * Recognizes <stream:stream> and collects stanzas used for ordinary
 * TCP streams and Websockets.
 *
 * API: write(data) & end(data)
 * Events: streamStart, stanza, end, error
 */
module.exports = class StreamParser extends EventEmitter {
  constructor(options) {
    super()
    const ElementInterface = (options && options.Element) || Element
    const ParserInterface = (options && options.Parser) || LtxParser
    this.maxStanzaSize = options && options.maxStanzaSize
    this.parser = new ParserInterface()

    /* Count traffic for entire life-time */
    this.bytesParsed = 0
    /* Will be reset upon first stanza, but enforce maxStanzaSize until it is parsed */
    this.bytesParsedOnStanzaBegin = 0

    this.parser.on('startElement', (name, attrs) => {
      if (!this.element) {
        this.emit('startElement', name, attrs)
        this.emit('start', new Element(name, attrs))
      }

      // TODO: refuse anything but <stream:stream>
      if (!this.element && (name === 'stream:stream')) {
        this.emit('streamStart', attrs)
      } else {
        let child
        if (!this.element) { // eslint-disable-line no-negated-condition
          /* A new stanza */
          child = new ElementInterface(name, attrs)
          this.element = child
          /* For maxStanzaSize enforcement */
          this.bytesParsedOnStanzaBegin = this.bytesParsed
        } else {
          /* A child element of a stanza */
          child = new ElementInterface(name, attrs)
          this.element = this.element.cnode(child)
        }
      }
    })

    this.parser.on('endElement', name => {
      if (!this.element) {
        this.emit('endElement', name)
      }

      if (!this.element && (name === 'stream:stream')) {
        this.end()
      } else if (this.element && (name === this.element.name)) {
        if (this.element.parent) {
          this.element = this.element.parent
        } else {
          /* Element complete */
          this.emit('element', this.element)
          this.emit('stanza', this.element) // FIXME deprecate
          delete this.element
          /* MaxStanzaSize doesn't apply until next startElement */
          delete this.bytesParsedOnStanzaBegin
        }
      } else {
        this.error('xml-not-well-formed', 'XML parse error')
      }
    })

    this.parser.on('text', str => {
      if (this.element) {
        this.element.t(str)
      }
    })

    this.parser.on('entityDecl', () => {
      /* Entity declarations are forbidden in XMPP. We must abort to
       * avoid a billion laughs.
       */
      this.error('xml-not-well-formed', 'No entity declarations allowed')
      this.end()
    })

    this.parser.on('error', this.emit.bind(this, 'error'))
  }

  /*
   * Hack for most usecases, do we have a better idea?
   *   catch the following:
   *   <?xml version="1.0"?>
   *   <?xml version="1.0" encoding="UTF-8"?>
   *   <?xml version="1.0" encoding="UTF-16" standalone="yes"?>
   */
  checkXMLHeader(data) {
    // Check for xml tag
    const index = data.indexOf('<?xml')

    if (index !== -1) {
      const end = data.indexOf('?>')
      if (index >= 0 && end >= 0 && index < end + 2) {
        const search = data.substring(index, end + 2)
        data = data.replace(search, '')
      }
    }

    return data
  }

  write(data) {
    // If (/^<stream:stream [^>]+\/>$/.test(data)) {
    //   data = data.replace(/\/>$/, ">")
    // }
    if (this.parser) {
      data = data.toString('utf8')
      data = this.checkXMLHeader(data)

      /* If a maxStanzaSize is configured, the current stanza must consist only of this many bytes */
      if (this.bytesParsedOnStanzaBegin && this.maxStanzaSize &&
        this.bytesParsed > this.bytesParsedOnStanzaBegin + this.maxStanzaSize) {
        this.error('policy-violation', 'Maximum stanza size exceeded')
        return
      }
      this.bytesParsed += data.length

      this.parser.write(data)
    }
  }

  end(data) {
    if (data) {
      this.write(data)
    }
    /* Get GC'ed */
    delete this.parser
    this.emit('end')
  }

  error(condition, message) {
    const e = new Error(message)
    e.condition = condition
    this.emit('error', e)
  }
}
