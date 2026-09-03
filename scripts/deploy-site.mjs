#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assessDeploymentSource } from './deploy-site-policy.mjs'

const PROJECT_NAME = 'wx2md'
const PRODUCTION_BRANCH = 'main'
const SITE_DIRECTORY = 'site'
const WRANGLER_VERSION = '4.80.0'
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const options = new Set(process.argv.slice(2))

if (options.has('--help')) {
  showHelp()
  process.exit(0)
}

for (const option of options) {
  if (option !== '--dry-run') fail(`未知参数：${option}\n\n运行 npm run deploy:site -- --help 查看用法。`)
}

const dryRun = options.has('--dry-run')
process.chdir(projectRoot)

console.log(`\n准备部署 Cloudflare Pages 项目 ${PROJECT_NAME}`)
console.log(`站点目录：${resolve(projectRoot, SITE_DIRECTORY)}`)

const branch = capture('git', ['branch', '--show-current'])
const commitHash = capture('git', ['rev-parse', 'HEAD'])
const commitMessage = capture('git', ['log', '-1', '--pretty=%s'])
const changes = capture('git', ['status', '--porcelain'])
const sourceAssessment = assessDeploymentSource({ branch, changes, productionBranch: PRODUCTION_BRANCH })

for (const message of sourceAssessment.warnings) warn(message)
if (dryRun && sourceAssessment.blocker) warn('工作区存在未提交改动；正式部署会拒绝继续。')
if (!dryRun && sourceAssessment.blocker) fail(sourceAssessment.blocker)

runStep('检查官网链接、元数据和发布资源', 'npm', ['run', 'test:site'])
runStep('运行自动化测试', 'npm', ['test'])
runStep('验证 TypeScript 和生产构建', 'npm', ['run', 'build'])

const deployArguments = [
  'pages', 'deploy', SITE_DIRECTORY,
  `--project-name=${PROJECT_NAME}`,
  `--branch=${PRODUCTION_BRANCH}`,
  `--commit-hash=${commitHash}`,
  `--commit-message=${commitMessage}`,
  '--commit-dirty=false',
]

if (dryRun) {
  console.log('\n✓ 发布前检查全部通过')
  console.log(`预演完成：未连接 Cloudflare，也没有上传文件。`)
  console.log('正式部署：提交当前改动、确保工作区干净，再运行 npm run deploy:site')
  process.exit(0)
}

runStep(
  '检查 Cloudflare 登录状态',
  'npx',
  ['--yes', `wrangler@${WRANGLER_VERSION}`, 'whoami'],
  `未登录时运行：npx wrangler@${WRANGLER_VERSION} login`,
)
runStep(
  `发布 ${SITE_DIRECTORY}/ 到 ${PROJECT_NAME} 的生产环境`,
  'npx',
  ['--yes', `wrangler@${WRANGLER_VERSION}`, ...deployArguments],
  '修复网络或 Cloudflare 登录问题后，重新运行：npm run deploy:site',
)

console.log(`\n✓ 官网部署完成：https://wx2md.com/`)
console.log(`版本：${commitHash.slice(0, 12)} ${commitMessage}`)

function runStep(label, command, args, recovery = '') {
  console.log(`\n→ ${label}`)
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) fail(`${label}无法启动：${result.error.message}${recovery ? `\n${recovery}` : ''}`)
  if (result.status !== 0) fail(`${label}失败，部署已停止。${recovery ? `\n${recovery}` : ''}`, result.status || 1)
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.error) fail(`无法运行 ${command}：${result.error.message}`)
  if (result.status !== 0) fail((result.stderr || `运行 ${command} 失败`).trim(), result.status || 1)
  return result.stdout.trim()
}

function warn(message) {
  console.warn(`⚠ ${message}`)
}

function fail(message, exitCode = 1) {
  console.error(`\n✗ ${message}`)
  process.exit(exitCode)
}

function showHelp() {
  console.log(`用法：
  npm run deploy:site               检查并部署 site/ 到 Cloudflare Pages 生产环境
  npm run deploy:site -- --dry-run  只运行发布前检查，不登录或上传

正式部署要求：
  - Git 工作区没有未提交改动
  - 已通过 npx wrangler@${WRANGLER_VERSION} login 登录 Cloudflare

脚本允许从任意 Git 分支部署当前 commit，并固定发布到 Cloudflare 的 ${PRODUCTION_BRANCH} 生产分支。
`)
}
