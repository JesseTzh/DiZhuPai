import { execFileSync } from 'node:child_process';

export function buildVersion({ now = new Date(), sha, channel }) {
  if (!['prod', 'test'].includes(channel)) throw new Error('构建环境必须是 prod 或 test');
  if (!/^[a-f0-9]{7,40}$/i.test(sha)) throw new Error('构建版本需要有效的 Git SHA');
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  return `Version:${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}-${sha.slice(0, 7)}-${channel}`;
}

export function currentBuildInfo(root) {
  const git = (...args) => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return '';
    }
  };
  const sha = process.env.BUILD_SHA || git('rev-parse', 'HEAD') || '0000000';
  const branch =
    process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git('branch', '--show-current');
  const channel = process.env.BUILD_CHANNEL || (branch === 'main' ? 'prod' : 'test');
  const now = new Date();
  return { version: buildVersion({ now, sha, channel }), sha, channel, builtAt: now.toISOString() };
}
