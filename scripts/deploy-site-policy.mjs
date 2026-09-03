export function assessDeploymentSource({ branch, changes, productionBranch }) {
  const warnings = []

  if (branch !== productionBranch) {
    warnings.push(`当前 commit 来自 ${branch || 'detached HEAD'}；将显式发布到 Cloudflare 生产分支 ${productionBranch}。`)
  }

  return {
    warnings,
    blocker: changes
      ? '工作区存在未提交改动。请先提交或移走这些改动，再重新部署。\n检查命令：git status --short'
      : '',
  }
}
