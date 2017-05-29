'use strict'

const test = require('ava')
const xml = require('..')
const tag = require('../lib/tag')

test('exported correctly', t => {
  t.is(xml.tag, tag)
})

test('return an instance of Element', t => {
  t.true(tag`<message/>` instanceof xml.Element)
})

test('strips whitespaces', t => {
  t.is(xml`
    <foo>
        hello
      <bar/>
    </foo>
  `.toString(), '<foo>hello<bar/></foo>')
})

test('does not strips whitespaces for substitutions', t => {
  t.is(xml`
    <foo>${'  yo  '}</foo>
  `.toString(), '<foo>  yo  </foo>')

  t.is(xml`
    <foo>${' foo '}<bar>${' bar '}</bar></foo>
  `.toString(), '<foo> foo <bar> bar </bar></foo>')

  t.skip.is(xml`
    <foo>${' foo '}${' bar '}</foo>
  `.toString(), '<foo> foo  bar </foo>')
})

test('escapes substitutions', t => {
  t.is(xml`
    <foo>${'<'}</foo>
  `.toString(), '<foo>&lt;</foo>')
})
