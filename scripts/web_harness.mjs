// 网页匹配核心的 node 测试通道：加载真实的 web/data.js 与 web/app.js（浏览器外模式），
// 从 stdin 读入用例 JSON（[{text, ...}]），逐条跑 analyze + toConverted 后输出 JSON。
// 由 scripts/web_check.py 调用；用例断言在 Python 侧做，这里只负责执行真实前端代码。
import { readFileSync } from 'node:fs';

const cases = JSON.parse(readFileSync(0, 'utf8'));

globalThis.window = {};
eval(readFileSync(new URL('../web/data.js', import.meta.url), 'utf8'));
eval(readFileSync(new URL('../web/app.js', import.meta.url), 'utf8'));
const M = globalThis.window.TrafficMatcher;
if (!M) {
  console.error('TrafficMatcher 未导出：app.js 结构可能被改动');
  process.exit(2);
}

const results = cases.map((c) => {
  if ('region' in c) M.setRegion(c.region || null);
  const r = M.analyze(c.text);
  const firstSeg = r.segments.find((s) => s.type === 'match');
  return {
    text: c.text,
    converted: M.toConverted(r.segments),
    firstId: firstSeg ? globalThis.window.TRAFFIC_DATA.entries[firstSeg.ids[0]].id : null,
    nTerms: r.terms.length,
  };
});
console.log(JSON.stringify(results));
