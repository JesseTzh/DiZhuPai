// 道具数据清单：商店售卖、存档校验、规则开关的单一来源。
// 美术（模型/动画/图标/摆放）在 src/assets/items/<id>.js，两处以 id 对应。
export const ITEMS = [
  {
    id: 'frog',
    name: '赖子',
    toy: '好运青蛙',
    price: 20,
    color: '#93d3b0',
    description: '每小局随机一张手牌成为赖子，可代替任意普通点数。',
    effect: '每局一张万能牌',
    rule: 'wildCard',
  },
  {
    id: 'hand',
    name: '三带二',
    toy: '五指玩具手',
    price: 25,
    color: '#f3a6bb',
    description: '三张相同点数，可以带两张点数不同的单牌。',
    effect: '三张 + 两张不同单牌',
    rule: 'looseTriple',
  },
  {
    id: 'dragon',
    name: '大顺',
    toy: '中国龙玩具',
    price: 30,
    color: '#f4b829',
    description: '四张连续点数即可组成顺子，仍不能包含 2 和王。',
    effect: '四张也能成顺子',
    rule: 'shortStraight',
  },
];

// 玩家是否拥有具备某规则效果的道具（rule 字段对应 rules.js 的选项名）。
export const hasItemRule = (game, rule) =>
  game.items.some((id) => ITEMS.find((item) => item.id === id)?.rule === rule);
