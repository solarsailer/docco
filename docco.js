// Converted from CoffeeScript with
// https://github.com/decaffeinate/decaffeinate
// `decaffeinate --keep-commonjs --prefer-const docco.coffee`
const document = function (options, callback) {
  if (options == null) {
    options = {}
  }
  const config = configure(options)

  return fs.mkdirs(config.output, function () {
    if (!callback) {
      callback = function (error) {
        if (error) {
          throw error
        }
      }
    }

    const copyAsset = function (file, callback) {
      if (!fs.existsSync(file)) {
        return callback()
      }
      return fs.copy(
        file,
        path.join(config.output, path.basename(file)),
        callback
      )
    }

    const complete = () =>
      copyAsset(config.css, function (error) {
        if (error) {
          return callback(error)
        }
        if (fs.existsSync(config.public)) {
          return copyAsset(config.public, callback)
        }
        return callback()
      })

    const files = config.sources.slice()

    var nextFile = function () {
      const source = files.shift()
      return fs.readFile(source, function (error, buffer) {
        if (error) {
          return callback(error)
        }

        const code = buffer.toString()
        const sections = parse(source, code, config)
        format(source, sections, config)
        write(source, sections, config)
        if (files.length) {
          return nextFile()
        } else {
          return complete()
        }
      })
    }

    return nextFile()
  })
}

var parse = function (source, code, config) {
  let codeText, docsText
  if (config == null) {
    config = {}
  }
  const lines = code.split('\n')
  const sections = []
  const lang = getLanguage(source, config)

  let hasCode = (docsText = (codeText = ''))
  let isBlock = false

  const save = function () {
    sections.push({docsText, codeText})
    hasCode = (docsText = (codeText = ''))
    isBlock = false

    return hasCode
  }

  if (lang.literate) {
    let maybeCode
    let isText = (maybeCode = true)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = /^([ ]{4}|[ ]{0,3}\t)/.exec(line)

      if (maybeCode && match) {
        isText = false
        lines[i] = line.slice(match[0].length)
      } else if ((maybeCode = /^\s*$/.test(line))) {
        lines[i] = isText ? lang.symbol : ''
      } else {
        isText = true
        lines[i] = lang.symbol + ' ' + line
      }
    }
  }

  const parseSymbol = (line) => {
    if (line.match(lang.commentMatcher) && !line.match(lang.commentFilter)) {
      if (hasCode) {
        save()
      }

      docsText += (line = line.replace(lang.commentMatcher, '')) + '\n'

      if (/^(---+|===+)$/.test(line)) {
        save()
      }
    } else {
      hasCode = true
      codeText += line + '\n'
    }
  }

  const parseBlock = (line) => {
    if (
      isBlock ||
      (
        line.match(lang.commentBlockStartMatcher) &&
        !line.match(lang.commentFilter)
      )
    ) {
      if (hasCode) {
        save()
      }

      // Does not contain the end symbol of a block? It's a block!
      isBlock = !line.match(lang.commentBlockEndMatcher)

      line = line.replace(lang.commentBlockStartMatcher, '')
      line = line.replace(lang.commentBlockEndMatcher, '')
      line = line.trim()

      docsText += line + '\n'

      if (/^(---+|===+)$/.test(line)) {
        save()
      }
    } else {
      hasCode = true
      codeText += line + '\n'
    }
  }

  for (let line of lines) {
    if (lang.block) {
      parseBlock(line)
    } else {
      parseSymbol(line)
    }
  }

  save()

  return sections
}

var format = function (source, sections, config) {
  let code
  const language = getLanguage(source, config)

  let markedOptions = {smartypants: true}

  if (config.marked) {
    markedOptions = config.marked
  }

  marked.setOptions(markedOptions)

  marked.setOptions({
    highlight (code, lang) {
      if (!lang) {
        lang = language.name
      }

      if (highlightjs.getLanguage(lang)) {
        return highlightjs.highlight(lang, code).value
      } else {
        console.warn(
          `docco: couldn't highlight code block with unknown language '${lang}' in ${source}`
        )
        return code
      }
    }
  })

  return Array.from(sections).map((section, i) => {
    code = highlightjs.highlight(language.name, section.codeText).value
    code = code.replace(/\s+$/, '')
    section.codeHtml = `<div class='highlight'><pre>${code}</pre></div>`
    section.docsHtml = marked(section.docsText)
    return section
  })
}

var write = function (source, sections, config) {
  let first
  const destination = file =>
    path.join(config.output, path.basename(file, path.extname(file)) + '.html')

  const firstSection = _.find(sections, section => section.docsText.length > 0)
  if (firstSection) {
    first = marked.lexer(firstSection.docsText)[0]
  }
  const hasTitle = first && first.type === 'heading' && first.depth === 1
  const title = hasTitle ? first.text : path.basename(source)

  const html = config.template({
    sources: config.sources,
    css: path.basename(config.css),
    title,
    hasTitle,
    sections,
    path,
    destination
  })

  console.log(`docco: ${source} -> ${destination(source)}`)
  return fs.writeFileSync(destination(source), html)
}

const defaults = {
  layout: 'parallel',
  output: 'docs',
  template: null,
  css: null,
  extension: null,
  languages: {},
  marked: null
}

var configure = function (options) {
  const config = _.extend(
    {},
    defaults,
    _.pick(options, ...Array.from(_.keys(defaults)))
  )

  config.languages = buildMatchers(config.languages)

  if (options.template) {
    if (!options.css) {
      console.warn('docco: no stylesheet file specified')
    }
    config.layout = null
  } else {
    const dir = (config.layout = path.join(
      __dirname,
      'resources',
      config.layout
    ))
    if (fs.existsSync(path.join(dir, 'public'))) {
      config.public = path.join(dir, 'public')
    }
    config.template = path.join(dir, 'docco.jst')
    config.css = options.css || path.join(dir, 'docco.css')
  }
  config.template = _.template(fs.readFileSync(config.template).toString())

  if (options.marked) {
    config.marked = JSON.parse(fs.readFileSync(options.marked))
  }

  config.sources = options.args
    .filter(function (source) {
      const lang = getLanguage(source, config)
      if (!lang) {
        console.warn(`docco: skipped unknown type (${path.basename(source)})`)
      }
      return lang
    })
    .sort()

  return config
}

var _ = require('underscore')
var fs = require('fs-extra')
var path = require('path')
var marked = require('marked')
const commander = require('commander')
var highlightjs = require('highlight.js')

let languages = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'resources', 'languages.json'))
)

var buildMatchers = function (languages) {
  for (let ext in languages) {
    const l = languages[ext]

    if (l.block) {
      l.commentBlockStartMatcher = new RegExp(`^\\s*${l.block.start}\\s?`)
      l.commentBlockEndMatcher = new RegExp(`\\s*${l.block.end}\\s*$`)
    }

    if (l.symbol) {
      l.commentMatcher = new RegExp(`^\\s*${l.symbol}\\s?`)
    }

    l.commentFilter = /(^#![/]|^\s*#\{)/
  }
  return languages
}
languages = buildMatchers(languages)

var getLanguage = function (source, config) {
  const ext = config.extension || path.extname(source) || path.basename(source)
  let lang = (config.languages != null ? config.languages[ext] : undefined) ||
    languages[ext]
  if (lang && lang.name === 'markdown') {
    let codeLang
    const codeExt = path.extname(path.basename(source, ext))
    if (codeExt && (codeLang = languages[codeExt])) {
      lang = _.extend({}, codeLang, {literate: true})
    }
  }
  return lang
}

const {version} = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'))
)

const run = function (args) {
  if (args == null) {
    args = process.argv
  }
  const c = defaults
  commander
    .version(version)
    .usage('[options] files')
    .option(
      '-L, --languages [file]',
      'use a custom languages.json',
      _.compose(JSON.parse, fs.readFileSync)
    )
    .option(
      '-l, --layout [name]',
      'choose a layout (parallel, linear or classic)',
      c.layout
    )
    .option('-o, --output [path]', 'output to a given folder', c.output)
    .option('-c, --css [file]', 'use a custom css file', c.css)
    .option('-t, --template [file]', 'use a custom .jst template', c.template)
    .option(
      '-e, --extension [ext]',
      'assume a file extension for all inputs',
      c.extension
    )
    .option('-m, --marked [file]', 'use custom marked options', c.marked)
    .parse(args).name = 'docco'
  if (commander.args.length) {
    return document(commander)
  } else {
    return console.log(commander.helpInformation())
  }
}

module.exports = {run, document, parse, format, version}
