#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const { execSync } = require('child_process')

const log = console.log.bind('pure/module')
function mkdir (dir) {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o755 })
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
}

function dirIsEmpty (directory) {
  try {
    const files = readdirSync(directory)
    return !files.length
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
  return true
}

function readGit (prop) {
  const v = execSync(`git config --global ${prop}`)
  return v.slice(0, v.length - 1).toString('utf8')
}

function generate (dst, moduleName, desc, readme) {
  if (!dirIsEmpty(dst)) throw new Error('Destination path not empty, refusing to overwrite')
  if (!moduleName) throw new Error('Please specify a module name')
  log(`Generating module ${dst}...`)

  readme = (readme || readFileSync(join(__dirname, 'README.md'))).toString('utf8')
  const license = readFileSync(join(__dirname, 'LICENSE')).toString('utf8')
  const substitues = {
    MODULE_NAME: moduleName,
    MODULE_DESC: desc || 'Tagline goes here',
    LICENSE_SPDX: 'AGPL-3.0-or-later',
    LICENSE_TEXT: license,
    AUTHOR: `${readGit('user.name')} <${readGit('user.email')}>` // get this from git
  }

  let blockBuffer = ''
  let sectionTemplates = false
  let insideBlock = false
  let outFile = null
  for (const line of readme.split('\n')) {
    if (line.match(/^## Templates/i)) {
      sectionTemplates = true
      continue
    }
    if (!sectionTemplates) continue

    if (!insideBlock) {
      if (line.match(/^## /)) break // Exit loop
      let m = null
      if ((m = line.match(/^###\s*`(.+)`/))) outFile = m[1]
      if (line.match(/^```\S*$/)) insideBlock = true
    } else if (line.match(/^```$/)) {
      const tgt = join(dst, outFile)
      for (const k in substitues) {
        blockBuffer = blockBuffer.replace(new RegExp(k, 'g'), substitues[k])
      }
      writeFileSync(tgt, blockBuffer)
      log('Wrote', tgt, '\n', blockBuffer)
      blockBuffer = ''
      insideBlock = false
      outFile = null
    } else blockBuffer += '\n' + line
  }
  log('done!\n')
}
module.exports = generate
module.exports.readGitConfig = readGit

try {
  if (process.mainModule.filename === __filename) {
    const dst = join(process.cwd(), process.argv[2] || '.')
    const moduleName = process.argv[2]
    generate(dst, moduleName)
  }
} catch (err) {
  log(err.message)
  process.exit(1)
}