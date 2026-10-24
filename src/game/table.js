export const TABLES = [
  { id: 'planks', name: '旧木板', color: '#bc9162', note: '磨损的边角 · 裸露的铁钉' },
  { id: 'walnut', name: '胡桃木', color: '#96633f', note: '温润木纹 · 黄铜镶边' },
  { id: 'marble', name: '大理石', color: '#d9e4d9', note: '青玉石纹 · 金色嵌饰' },
];
export const world = (u, v, z = 0) => [(u + v) / Math.SQRT2, (v - u) / Math.SQRT2, z];
