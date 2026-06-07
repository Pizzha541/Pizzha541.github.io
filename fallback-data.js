const LOCAL_TYPES = [
  "bug",
  "dark",
  "dragon",
  "electric",
  "fairy",
  "fighting",
  "fire",
  "flying",
  "ghost",
  "grass",
  "ground",
  "ice",
  "normal",
  "poison",
  "psychic",
  "rock",
  "steel",
  "water",
];

const LOCAL_TYPE_RELATIONS = {
  normal: { doubleTo: [], halfTo: ["rock", "steel"], noTo: ["ghost"] },
  fire: { doubleTo: ["bug", "grass", "ice", "steel"], halfTo: ["dragon", "fire", "rock", "water"], noTo: [] },
  water: { doubleTo: ["fire", "ground", "rock"], halfTo: ["dragon", "grass", "water"], noTo: [] },
  electric: { doubleTo: ["flying", "water"], halfTo: ["dragon", "electric", "grass"], noTo: ["ground"] },
  grass: { doubleTo: ["ground", "rock", "water"], halfTo: ["bug", "dragon", "fire", "flying", "grass", "poison", "steel"], noTo: [] },
  ice: { doubleTo: ["dragon", "flying", "grass", "ground"], halfTo: ["fire", "ice", "steel", "water"], noTo: [] },
  fighting: { doubleTo: ["dark", "ice", "normal", "rock", "steel"], halfTo: ["bug", "fairy", "flying", "poison", "psychic"], noTo: ["ghost"] },
  poison: { doubleTo: ["fairy", "grass"], halfTo: ["ghost", "ground", "poison", "rock"], noTo: ["steel"] },
  ground: { doubleTo: ["electric", "fire", "poison", "rock", "steel"], halfTo: ["bug", "grass"], noTo: ["flying"] },
  flying: { doubleTo: ["bug", "fighting", "grass"], halfTo: ["electric", "rock", "steel"], noTo: [] },
  psychic: { doubleTo: ["fighting", "poison"], halfTo: ["psychic", "steel"], noTo: ["dark"] },
  bug: { doubleTo: ["dark", "grass", "psychic"], halfTo: ["fairy", "fighting", "fire", "flying", "ghost", "poison", "steel"], noTo: [] },
  rock: { doubleTo: ["bug", "fire", "flying", "ice"], halfTo: ["fighting", "ground", "steel"], noTo: [] },
  ghost: { doubleTo: ["ghost", "psychic"], halfTo: ["dark"], noTo: ["normal"] },
  dragon: { doubleTo: ["dragon"], halfTo: ["steel"], noTo: ["fairy"] },
  dark: { doubleTo: ["ghost", "psychic"], halfTo: ["dark", "fairy", "fighting"], noTo: [] },
  steel: { doubleTo: ["fairy", "ice", "rock"], halfTo: ["electric", "fire", "steel", "water"], noTo: [] },
  fairy: { doubleTo: ["dark", "dragon", "fighting"], halfTo: ["fire", "poison", "steel"], noTo: [] },
};

const LOCAL_POKEMON = [
  makeLocalPokemon(3, "venusaur", ["grass", "poison"], ["overgrow", "chlorophyll"], ["solar-beam", "sludge-bomb", "earthquake", "sleep-powder", "growth", "giga-drain"], [80, 82, 83, 100, 100, 80]),
  makeLocalPokemon(6, "charizard", ["fire", "flying"], ["blaze", "solar-power"], ["flamethrower", "air-slash", "dragon-dance", "earthquake", "solar-beam", "fire-blast"], [78, 84, 78, 109, 85, 100]),
  makeLocalPokemon(9, "blastoise", ["water"], ["torrent", "rain-dish"], ["surf", "hydro-pump", "ice-beam", "rapid-spin", "earthquake", "dark-pulse"], [79, 83, 100, 85, 105, 78]),
  makeLocalPokemon(25, "pikachu", ["electric"], ["static", "lightning-rod"], ["thunderbolt", "volt-switch", "quick-attack", "iron-tail", "surf", "grass-knot"], [35, 55, 40, 50, 50, 90]),
  makeLocalPokemon(59, "arcanine", ["fire"], ["intimidate", "flash-fire", "justified"], ["flare-blitz", "extreme-speed", "crunch", "wild-charge", "will-o-wisp", "close-combat"], [90, 110, 80, 100, 80, 95]),
  makeLocalPokemon(94, "gengar", ["ghost", "poison"], ["cursed-body"], ["shadow-ball", "sludge-bomb", "thunderbolt", "focus-blast", "will-o-wisp", "energy-ball"], [60, 65, 60, 130, 75, 110]),
  makeLocalPokemon(130, "gyarados", ["water", "flying"], ["intimidate", "moxie"], ["waterfall", "dragon-dance", "earthquake", "ice-fang", "crunch", "bounce"], [95, 125, 79, 60, 100, 81]),
  makeLocalPokemon(143, "snorlax", ["normal"], ["immunity", "thick-fat", "gluttony"], ["body-slam", "earthquake", "crunch", "rest", "curse", "heavy-slam"], [160, 110, 65, 65, 110, 30]),
  makeLocalPokemon(149, "dragonite", ["dragon", "flying"], ["inner-focus", "multiscale"], ["dragon-dance", "earthquake", "fire-punch", "extreme-speed", "hurricane", "ice-spinner"], [91, 134, 95, 100, 100, 80]),
  makeLocalPokemon(197, "umbreon", ["dark"], ["synchronize", "inner-focus"], ["foul-play", "wish", "protect", "toxic", "moonlight", "calm-mind"], [95, 65, 110, 60, 130, 65]),
  makeLocalPokemon(248, "tyranitar", ["rock", "dark"], ["sand-stream", "unnerve"], ["stone-edge", "crunch", "earthquake", "dragon-dance", "ice-punch", "fire-punch"], [100, 134, 110, 95, 100, 61]),
  makeLocalPokemon(282, "gardevoir", ["psychic", "fairy"], ["synchronize", "trace", "telepathy"], ["moonblast", "psychic", "calm-mind", "thunderbolt", "shadow-ball", "energy-ball"], [68, 65, 65, 125, 115, 80]),
  makeLocalPokemon(376, "metagross", ["steel", "psychic"], ["clear-body", "light-metal"], ["meteor-mash", "zen-headbutt", "earthquake", "bullet-punch", "ice-punch", "agility"], [80, 135, 130, 95, 90, 70]),
  makeLocalPokemon(445, "garchomp", ["dragon", "ground"], ["sand-veil", "rough-skin"], ["earthquake", "dragon-claw", "swords-dance", "stone-edge", "fire-fang", "stealth-rock"], [108, 130, 95, 80, 85, 102]),
  makeLocalPokemon(448, "lucario", ["fighting", "steel"], ["steadfast", "inner-focus", "justified"], ["close-combat", "aura-sphere", "extreme-speed", "swords-dance", "flash-cannon", "meteor-mash"], [70, 110, 70, 115, 70, 90]),
  makeLocalPokemon(658, "greninja", ["water", "dark"], ["torrent", "protean"], ["hydro-pump", "surf", "dark-pulse", "ice-beam", "water-shuriken", "spikes"], [72, 95, 67, 103, 71, 122]),
  makeLocalPokemon(778, "mimikyu", ["ghost", "fairy"], ["disguise"], ["play-rough", "shadow-claw", "swords-dance", "shadow-sneak", "will-o-wisp", "trick-room"], [55, 90, 80, 50, 105, 96]),
  makeLocalPokemon(887, "dragapult", ["dragon", "ghost"], ["clear-body", "infiltrator", "cursed-body"], ["dragon-darts", "shadow-ball", "u-turn", "thunderbolt", "flamethrower", "will-o-wisp"], [88, 120, 75, 100, 75, 142]),
];

function makeLocalPokemon(id, name, types, abilities, moves, stats) {
  const statNames = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
  return {
    id,
    name,
    sprites: {
      front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
      other: {
        "official-artwork": {
          front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        },
      },
    },
    types: types.map((type, index) => ({ slot: index + 1, type: { name: type } })),
    abilities: abilities.map((ability) => ({ ability: { name: ability } })),
    moves: moves.map((move) => ({ move: { name: move } })),
    stats: stats.map((value, index) => ({ base_stat: value, stat: { name: statNames[index] } })),
  };
}

window.LOCAL_TYPES = LOCAL_TYPES;
window.LOCAL_TYPE_RELATIONS = LOCAL_TYPE_RELATIONS;
window.LOCAL_POKEMON = LOCAL_POKEMON;
