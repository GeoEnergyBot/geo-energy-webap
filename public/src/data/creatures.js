// data/creatures.js
// Славянский бестиарий для GeoEnergy — базовый набор существ

export const CREATURES = [
  {
    id: 'domovoi',
    name: 'Домовой',
    title: 'Домовой — хранитель очага',
    rarity: 'common',
    aspect: 'house',
    short: 'Тихий дух дома, который любит порядок и уют.'
  },
  {
    id: 'dvorovoi',
    name: 'Дворовой',
    title: 'Дворовой — страж двора',
    rarity: 'common',
    aspect: 'yard',
    short: 'Следит за двором, любит, когда не мусорят и не шумят по ночам.'
  },
  {
    id: 'ovinnik',
    name: 'Овинник',
    title: 'Овинник — дух амбара',
    rarity: 'common',
    aspect: 'grain',
    short: 'Может оберегать запасы, а может и шалить, если его сердить.'
  },
  {
    id: 'kikimora',
    name: 'Кикимора',
    title: 'Кикимора — ночная шептунья',
    rarity: 'advanced',
    aspect: 'house',
    short: 'Путает нитки, скребётся по ночам и не любит ленивых хозяев.'
  },
  {
    id: 'bannik',
    name: 'Банник',
    title: 'Банник — хозяин бани',
    rarity: 'advanced',
    aspect: 'bath',
    short: 'Живёт в бане, сердится на громкие крики и неблагодарных гостей.'
  },
  {
    id: 'polevik',
    name: 'Полевик',
    title: 'Полевик — дух полей',
    rarity: 'advanced',
    aspect: 'field',
    short: 'Бродит по полям и травам, любит тишину и ровные тропинки.'
  },
  {
    id: 'leshy',
    name: 'Леший',
    title: 'Леший — хозяин леса',
    rarity: 'rare',
    aspect: 'forest',
    short: 'Меняет тропы, сбивает с пути и оберегает свой лес.'
  },
  {
    id: 'rusalka',
    name: 'Русалка',
    title: 'Русалка — дочь воды',
    rarity: 'rare',
    aspect: 'water',
    short: 'Поёт у рек и озёр и любопытно наблюдает за людьми.'
  },
  {
    id: 'vodyanoy',
    name: 'Водяной',
    title: 'Водяной — хозяин глубин',
    rarity: 'rare',
    aspect: 'water',
    short: 'Сидит на дне пруда, ворчит и следит за тем, что тонет в его владениях.'
  },
  {
    id: 'mara',
    name: 'Мара',
    title: 'Мара — дух ночных видений',
    rarity: 'rare',
    aspect: 'night',
    short: 'Приходит с сумерками и приносит тревожные сны, если её не умаслить.'
  }
];

// Простейший детерминированный выбор существа по редкости и сид-строке
function hashString(str){
  let h = 0;
  for (let i = 0; i < str.length; i++){
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function pickFrom(list, seed){
  if (!list || !list.length) return null;
  const h = hashString(String(seed||''));
  return list[h % list.length] || list[0];
}

export function getCreatureById(id){
  return CREATURES.find(c => c.id === id) || null;
}

export function pickCreatureForPoint({ rarity = 'common', seed = '' } = {}){
  const list = CREATURES.filter(c => c.rarity === rarity) || CREATURES;
  const chosen = pickFrom(list, seed);
  return chosen ? chosen.id : null;
}
