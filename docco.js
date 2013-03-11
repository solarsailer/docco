// Generated by CoffeeScript 1.6.1
(function() {
  var Docco, commander, defaults, document, ensureDirectory, exec, ext, fs, generateDocumentation, generateHtml, getLanguage, getResource, highlight, highlightEnd, highlightStart, htmlEscape, l, languages, marked, parse, path, run, spawn, version, _, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  generateDocumentation = function(source, config, callback) {
    return fs.readFile(source, function(error, buffer) {
      var code, sections;
      if (error) {
        throw error;
      }
      code = buffer.toString();
      sections = parse(source, code, config);
      return highlight(source, sections, config, function() {
        generateHtml(source, sections, config);
        return callback();
      });
    });
  };

  document = function(sources, options, callback) {
    var config, doccoStyles, key, m, value, _i, _len;
    if (options == null) {
      options = {};
    }
    if (callback == null) {
      callback = null;
    }
    config = {};
    for (key in defaults) {
      value = defaults[key];
      config[key] = defaults[key];
    }
    if (key in defaults) {
      for (key in options) {
        value = options[key];
        config[key] = value;
      }
    }
    config.sources = sources.filter(function(source) {
      return getLanguage(source, config);
    }).sort();
    for (_i = 0, _len = sources.length; _i < _len; _i++) {
      m = sources[_i];
      if (__indexOf.call(config.sources, m) < 0) {
        console.log("docco: skipped unknown type (" + m + ")");
      }
    }
    config.doccoTemplate = _.template(fs.readFileSync(config.template).toString());
    doccoStyles = fs.readFileSync(config.css).toString();
    return ensureDirectory(config.output, function() {
      var files, nextFile;
      fs.writeFileSync(path.join(config.output, path.basename(config.css)), doccoStyles);
      files = config.sources.slice();
      nextFile = function() {
        if ((callback != null) && !files.length) {
          callback();
        }
        if (files.length) {
          return generateDocumentation(files.shift(), config, nextFile);
        }
      };
      return nextFile();
    });
  };

  parse = function(source, code, config) {
    var codeText, docsText, hasCode, i, language, line, lines, match, prev, save, sections, _i, _j, _len, _len1;
    lines = code.split('\n');
    sections = [];
    language = getLanguage(source, config);
    hasCode = docsText = codeText = '';
    save = function() {
      sections.push({
        docsText: docsText,
        codeText: codeText
      });
      return hasCode = docsText = codeText = '';
    };
    if (language.literate) {
      for (i = _i = 0, _len = lines.length; _i < _len; i = ++_i) {
        line = lines[i];
        lines[i] = /^\s*$/.test(line) ? '' : (match = /^([ ]{4}|\t)/.exec(line)) ? line.slice(match[0].length) : '# ' + line;
      }
    }
    for (_j = 0, _len1 = lines.length; _j < _len1; _j++) {
      line = lines[_j];
      if ((!line && prev === 'text') || (line.match(language.commentMatcher) && !line.match(language.commentFilter))) {
        if (hasCode) {
          save();
        }
        docsText += (line = line.replace(language.commentMatcher, '')) + '\n';
        if (/^(---+|===+)$/.test(line)) {
          save();
        }
        prev = 'text';
      } else {
        hasCode = true;
        codeText += line + '\n';
        prev = 'code';
      }
    }
    save();
    return sections;
  };

  highlight = function(source, sections, config, callback) {
    var code, docs, language, output, pygments, section;
    language = getLanguage(source, config);
    pygments = spawn('pygmentize', ['-l', language.name, '-f', 'html', '-O', 'encoding=utf-8,tabsize=2']);
    output = '';
    code = ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sections.length; _i < _len; _i++) {
        section = sections[_i];
        _results.push(section.codeText);
      }
      return _results;
    })()).join(language.codeSplitText);
    docs = ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sections.length; _i < _len; _i++) {
        section = sections[_i];
        _results.push(section.docsText);
      }
      return _results;
    })()).join(language.docsSplitText);
    pygments.stderr.on('data', function() {});
    pygments.stdin.on('error', function() {});
    pygments.stdout.on('data', function(result) {
      if (result) {
        return output += result;
      }
    });
    pygments.on('exit', function() {
      var codeFragments, docsFragments, i, _i, _len;
      output = output.replace(highlightStart, '').replace(highlightEnd, '');
      if (output === '') {
        codeFragments = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = sections.length; _i < _len; _i++) {
            section = sections[_i];
            _results.push(htmlEscape(section.codeText));
          }
          return _results;
        })();
      } else {
        codeFragments = output.split(language.codeSplitHtml);
      }
      docsFragments = marked(docs).split(language.docsSplitHtml);
      for (i = _i = 0, _len = sections.length; _i < _len; i = ++_i) {
        section = sections[i];
        section.codeHtml = highlightStart + codeFragments[i] + highlightEnd;
        section.docsHtml = docsFragments[i];
      }
      return callback();
    });
    if (pygments.stdin.writable) {
      pygments.stdin.write(code);
      return pygments.stdin.end();
    }
  };

  htmlEscape = function(string) {
    return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
  };

  generateHtml = function(source, sections, config) {
    var dest, destination, html, title;
    destination = function(filepath) {
      return path.join(config.output, path.basename(filepath, path.extname(filepath)) + '.html');
    };
    title = path.basename(source);
    dest = destination(source);
    html = config.doccoTemplate({
      title: title,
      sections: sections,
      sources: config.sources,
      path: path,
      destination: destination,
      css: path.basename(config.css)
    });
    console.log("docco: " + source + " -> " + dest);
    return fs.writeFileSync(dest, html);
  };

  _ = require('underscore');

  fs = require('fs');

  path = require('path');

  marked = require('marked');

  commander = require('commander');

  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;

  getResource = function(name) {
    var fullPath;
    fullPath = path.join(__dirname, 'resources', name);
    return fs.readFileSync(fullPath).toString();
  };

  languages = JSON.parse(getResource('languages.json'));

  for (ext in languages) {
    l = languages[ext];
    l.commentMatcher = RegExp("^\\s*" + l.symbol + "\\s?");
    l.commentFilter = /(^#![/]|^\s*#\{)/;
    l.codeSplitText = "\n" + l.symbol + "DIVIDER\n";
    l.codeSplitHtml = RegExp("\\n*<span\\sclass=\"c1?\">" + l.symbol + "DIVIDER<\\/span>\\n*");
    l.docsSplitText = "\n#" + l.name + "DOCDIVIDER\n";
    l.docsSplitHtml = RegExp("<h1>" + l.name + "DOCDIVIDER</h1>");
  }

  getLanguage = function(source, config) {
    var codeExt, codeLang, lang;
    ext = config.extension || path.extname(source);
    lang = languages[ext];
    if (lang.name === 'markdown') {
      codeExt = path.extname(path.basename(source, ext));
      if (codeExt && (codeLang = languages[codeExt])) {
        lang = _.extend({}, codeLang, {
          literate: true
        });
      }
    }
    return lang;
  };

  ensureDirectory = function(dir, cb, made) {
    var mode;
    if (made == null) {
      made = null;
    }
    mode = parseInt('0777', 8);
    return fs.mkdir(dir, mode, function(er) {
      if (!er) {
        return cb(null, made || dir);
      }
      if (er.code === 'ENOENT') {
        return ensureDirectory(path.dirname(dir), function(er, made) {
          if (er) {
            return cb(er, made);
          } else {
            return ensureDirectory(dir, cb, made);
          }
        });
      }
      return cb(er, made);
    });
  };

  highlightStart = '<div class="highlight"><pre>';

  highlightEnd = '</pre></div>';

  version = JSON.parse(fs.readFileSync("" + __dirname + "/package.json")).version;

  defaults = {
    template: "" + __dirname + "/resources/docco.jst",
    css: "" + __dirname + "/resources/docco.css",
    output: "docs/",
    extension: null
  };

  run = function(args) {
    if (args == null) {
      args = process.argv;
    }
    commander.version(version).usage("[options] <filePattern ...>").option("-c, --css [file]", "use a custom css file", defaults.css).option("-o, --output [path]", "use a custom output path", defaults.output).option("-t, --template [file]", "use a custom .jst template", defaults.template).option("-e, --extension <ext>", "use the given file extension for all inputs", defaults.extension).parse(args).name = "docco";
    if (commander.args.length) {
      return document(commander.args.slice(), commander);
    } else {
      return console.log(commander.helpInformation());
    }
  };

  Docco = module.exports = {
    run: run,
    document: document,
    parse: parse,
    version: version
  };

}).call(this);