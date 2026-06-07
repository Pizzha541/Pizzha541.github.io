const API = "https://pokeapi.co/api/v2";
const MAX_RESULTS = 80;
const CACHE_PREFIX = "pokemon-finder:";
const API_TIMEOUT_MS = 4500;
const STAT_LABELS = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defensa",
  "special-attack": "At. Esp.",
  "special-defense": "Def. Esp.",
  speed: "Velocidad",
};

const form = document.querySelector("#finder-form");
const results = document.querySelector("#results");
const statusTitle = document.querySelector("#status-title");
const statusText = document.querySelector("#status-text");
const loader = document.querySelector("#loader");
const summaryCount = document.querySelector("#summary-count");
const typeFilter = document.querySelector("#type-filter");
const weaknessFilter = document.querySelector("#weakness-filter");
const secretInputs = document.querySelectorAll("input");

let allPokemonNames = [];
let typeRelations = {};
let usingLocalData = true;
let konamiProgress = 0;
let secretChain = [];
const triggeredSecrets = new Set();
const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

init();

async function init() {
  setupLocalData();
  setLoading(false, "Pokedex local lista", "La busqueda usa datos e imagenes locales.");
  renderEmpty("Busca por ejemplo intimidate + earthquake, electric + thunderbolt o dragon-dance.");

  if (window.LOCAL_POKEMON.length > 1000) {
    usingLocalData = true;
    return;
  }

  try {
    setLoading(true, "Ampliando Pokedex", "Intentando conectar con PokeAPI para cargar mas Pokemon.");
    const [pokemonList, moves, abilities, types] = await Promise.all([
      fetchNamedList("pokemon?limit=1302"),
      fetchNamedList("move?limit=10000"),
      fetchNamedList("ability?limit=10000"),
      fetchNamedList("type?limit=100"),
    ]);

    allPokemonNames = pokemonList
      .filter((item) => !item.name.includes("-totem"))
      .map((item) => item.name);

    usingLocalData = false;
    fillDatalist("move-options", moves);
    fillDatalist("ability-options", abilities);
    fillTypeSelects(types);
    await loadTypeRelations(types);

    setLoading(false, "Pokedex completa lista", "PokeAPI cargo bien. Puedes buscar en la lista completa.");
    renderEmpty("Prueba con ataques como earthquake, surf, flamethrower o calm-mind.");
  } catch (error) {
    usingLocalData = true;
    setupLocalData();
    setLoading(false, "Modo local activo", `${friendlyError(error)} Usando una Pokedex local de respaldo.`);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runSearch();
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    summaryCount.textContent = "0";
    setLoading(false, "Listo para buscar", "Escribe uno o varios filtros y pulsa buscar.");
    renderEmpty("Prueba con ataques como earthquake, surf, flamethrower o calm-mind.");
  }, 0);
});

document.querySelector("#clear-moves").addEventListener("click", () => {
  document.querySelectorAll('input[name="move"]').forEach((input) => {
    input.value = "";
  });
});

document.querySelector("#clear-stats").addEventListener("click", () => {
  document.querySelectorAll(".stats-grid input").forEach((input) => {
    input.value = "";
  });
});

secretInputs.forEach((input) => {
  input.addEventListener("input", () => checkSecretPhrase(input.value));
});

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  konamiProgress = key === KONAMI_CODE[konamiProgress] ? konamiProgress + 1 : 0;

  if (konamiProgress === KONAMI_CODE.length) {
    konamiProgress = 0;
    activateSecret("konami");
  }
});

async function runSearch() {
  const filters = readFilters();
  const hasFilters =
    filters.moves.length ||
    filters.ability ||
    filters.type ||
    filters.weakness ||
    Object.keys(filters.stats).length;

  if (!hasFilters) {
    renderEmpty("Agrega al menos un filtro para evitar una lista enorme.");
    setLoading(false, "Faltan filtros", "Puedes buscar por ataque, habilidad, tipo, debilidad o stats.");
    return;
  }

  setLoading(true, "Buscando coincidencias", "Cruzando filtros con la Pokedex.");
  results.innerHTML = "";

  if (usingLocalData) {
    runLocalSearch(filters);
    return;
  }

  try {
    let candidates = null;

    for (const move of filters.moves) {
      const moveData = await cachedFetch(`move:${move}`, `${API}/move/${move}`);
      const names = moveData.learned_by_pokemon.map((pokemon) => pokemon.name);
      candidates = intersectCandidates(candidates, names);
    }

    if (filters.ability) {
      const abilityData = await cachedFetch(`ability:${filters.ability}`, `${API}/ability/${filters.ability}`);
      const names = abilityData.pokemon.map((entry) => entry.pokemon.name);
      candidates = intersectCandidates(candidates, names);
    }

    if (filters.type) {
      const typeData = await cachedFetch(`type:${filters.type}`, `${API}/type/${filters.type}`);
      const names = typeData.pokemon.map((entry) => entry.pokemon.name);
      candidates = intersectCandidates(candidates, names);
    }

    const namesToCheck = candidates ? [...candidates] : allPokemonNames;
    setLoading(true, "Revisando detalles", `${namesToCheck.length} Pokemon candidatos encontrados.`);

    const pokemon = await fetchPokemonBatch(namesToCheck);
    const filtered = pokemon
      .filter(Boolean)
      .filter((entry) => matchesStats(entry, filters.stats))
      .filter((entry) => matchesWeakness(entry, filters.weakness))
      .sort((a, b) => a.id - b.id);

    summaryCount.textContent = String(filtered.length);

    if (!filtered.length) {
      setLoading(false, "Sin coincidencias", "No hay Pokemon que cumplan todos esos filtros.");
      renderEmpty("Quita un filtro o baja algun stat minimo para ampliar la busqueda.");
      return;
    }

    setLoading(
      false,
      `${filtered.length} coincidencia${filtered.length === 1 ? "" : "s"}`,
      filtered.length > MAX_RESULTS
        ? `Mostrando los primeros ${MAX_RESULTS}. Afina filtros para ver menos resultados.`
        : "Resultados ordenados por numero de Pokedex.",
    );
    renderResults(filtered.slice(0, MAX_RESULTS), filters);
  } catch (error) {
    usingLocalData = true;
    setupLocalData();
    runLocalSearch(filters, friendlyError(error));
  }
}

function runLocalSearch(filters, apiError = "") {
  const filtered = window.LOCAL_POKEMON
    .filter((pokemon) => matchesLocalMoves(pokemon, filters.moves))
    .filter((pokemon) => matchesLocalAbility(pokemon, filters.ability))
    .filter((pokemon) => matchesLocalType(pokemon, filters.type))
    .filter((pokemon) => matchesStats(pokemon, filters.stats))
    .filter((pokemon) => matchesWeakness(pokemon, filters.weakness))
    .sort((a, b) => a.id - b.id);

  summaryCount.textContent = String(filtered.length);

  if (!filtered.length) {
    setLoading(
      false,
      "Sin coincidencias locales",
      apiError || "No hay Pokemon de la base local que cumplan todos esos filtros.",
    );
    renderEmpty("Prueba con menos filtros o usa nombres en ingles como intimidate, thunderbolt o dragon-dance.");
    return;
  }

  setLoading(
    false,
    `${filtered.length} coincidencia${filtered.length === 1 ? "" : "s"} locales`,
    apiError
      ? `${apiError} Mostrando resultados del modo local.`
      : "Resultados de la Pokedex local de respaldo.",
  );
  renderResults(filtered, filters);
}

function readFilters() {
  const moves = [...document.querySelectorAll('input[name="move"]')]
    .map((input) => normalizeName(input.value))
    .filter(Boolean);

  const stats = {};
  Object.keys(STAT_LABELS).forEach((stat) => {
    const value = Number(document.querySelector(`#stat-${stat}`).value);
    if (Number.isFinite(value) && value > 0) stats[stat] = value;
  });

  return {
    moves: [...new Set(moves)],
    ability: normalizeName(document.querySelector("#ability-input").value),
    type: typeFilter.value,
    weakness: weaknessFilter.value,
    stats,
  };
}

function renderResults(pokemon, filters) {
  results.innerHTML = pokemon.map((entry) => pokemonCard(entry, filters)).join("");
}

function pokemonCard(pokemon, filters) {
  const sprite =
    pokemon.sprites.other?.["official-artwork"]?.front_default ||
    pokemon.sprites.front_default ||
    "";
  const types = pokemon.types.map((slot) => slot.type.name);
  const abilities = pokemon.abilities.map((slot) => slot.ability.name.replaceAll("-", " "));
  const weaknesses = calculateWeaknesses(types);
  const requestedMoves = filters.moves.filter((move) =>
    pokemon.moves.some((entry) => entry.move.name === move),
  );

  return `
    <article class="pokemon-card">
      <div class="card-top">
        <div class="sprite-wrap">
          ${sprite ? `<img src="${sprite}" alt="${pokemon.name}" loading="lazy" />` : ""}
        </div>
        <div>
          <div class="dex-number">#${String(pokemon.id).padStart(4, "0")}</div>
          <h3 class="pokemon-name">${formatName(pokemon.name)}</h3>
          <div class="badge-row">
            ${types.map((type) => `<span class="badge type">${type}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="info-block">
          <strong>Habilidades</strong>
          <div class="badge-row">${abilities.map((ability) => `<span class="badge">${ability}</span>`).join("")}</div>
        </div>
        ${
          requestedMoves.length
            ? `<div class="info-block"><strong>Ataques encontrados</strong><div class="badge-row">${requestedMoves
                .map((move) => `<span class="badge match">${move.replaceAll("-", " ")}</span>`)
                .join("")}</div></div>`
            : ""
        }
        <div class="info-block">
          <strong>Stats base</strong>
          <div class="stats-list">${pokemon.stats.map(statLine).join("")}</div>
        </div>
        <div class="info-block">
          <strong>Debilidades</strong>
          <div class="badge-row">${
            weaknesses.length
              ? weaknesses.map((type) => `<span class="badge">${type}</span>`).join("")
              : `<span class="badge match">sin debilidad x2</span>`
          }</div>
        </div>
      </div>
    </article>
  `;
}

function statLine(entry) {
  const name = entry.stat.name;
  const value = entry.base_stat;
  const width = Math.min(100, Math.round((value / 180) * 100));
  return `
    <div class="stat-line">
      <span>${STAT_LABELS[name]}</span>
      <div class="stat-bar"><span style="width:${width}%"></span></div>
      <span>${value}</span>
    </div>
  `;
}

async function fetchPokemonBatch(names) {
  const queue = [...names];
  const output = [];
  const workers = Array.from({ length: 16 }, async () => {
    while (queue.length) {
      const name = queue.shift();
      try {
        output.push(await cachedFetch(`pokemon:${name}`, `${API}/pokemon/${name}`));
      } catch {
        output.push(null);
      }
    }
  });
  await Promise.all(workers);
  return output;
}

async function fetchNamedList(path) {
  const data = await cachedFetch(`list:${path}`, `${API}/${path}`);
  return data.results || [];
}

async function cachedFetch(key, url) {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`No se encontro ${url.split("/").at(-1)}`);

  const data = await response.json();
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    clearOldCache();
  }
  return data;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function fillDatalist(id, items) {
  const list = document.querySelector(`#${id}`);
  list.innerHTML = items.map((item) => `<option value="${item.name}"></option>`).join("");
}

function fillTypeSelects(types) {
  typeFilter.innerHTML = '<option value="">Cualquier tipo</option>';
  weaknessFilter.innerHTML = '<option value="">Cualquier debilidad</option>';
  const realTypes = types
    .map((item) => (typeof item === "string" ? item : item.name))
    .filter((name) => !["unknown", "shadow"].includes(name))
    .sort();

  for (const type of realTypes) {
    typeFilter.insertAdjacentHTML("beforeend", `<option value="${type}">${type}</option>`);
    weaknessFilter.insertAdjacentHTML("beforeend", `<option value="${type}">${type}</option>`);
  }
}

function setupLocalData() {
  const localMoves = uniqueLocalValues((pokemon) => pokemon.moves.map((entry) => entry.move.name));
  const localAbilities = uniqueLocalValues((pokemon) =>
    pokemon.abilities.map((entry) => entry.ability.name),
  );

  allPokemonNames = window.LOCAL_POKEMON.map((pokemon) => pokemon.name);
  typeRelations = window.LOCAL_TYPE_RELATIONS;
  fillDatalist(
    "move-options",
    localMoves.map((name) => ({ name })),
  );
  fillDatalist(
    "ability-options",
    localAbilities.map((name) => ({ name })),
  );
  fillTypeSelects(window.LOCAL_TYPES);
}

function uniqueLocalValues(selector) {
  return [...new Set(window.LOCAL_POKEMON.flatMap(selector))].sort();
}

async function loadTypeRelations(types) {
  const realTypes = types
    .map((item) => item.name)
    .filter((name) => !["unknown", "shadow"].includes(name));

  const data = await Promise.all(
    realTypes.map(async (type) => [type, await cachedFetch(`type:${type}`, `${API}/type/${type}`)]),
  );

  typeRelations = Object.fromEntries(
    data.map(([type, details]) => [
      type,
      {
        doubleTo: details.damage_relations.double_damage_to.map((entry) => entry.name),
        halfTo: details.damage_relations.half_damage_to.map((entry) => entry.name),
        noTo: details.damage_relations.no_damage_to.map((entry) => entry.name),
      },
    ]),
  );
}

function matchesStats(pokemon, filters) {
  return Object.entries(filters).every(([statName, minimum]) => {
    const stat = pokemon.stats.find((entry) => entry.stat.name === statName);
    return stat && stat.base_stat >= minimum;
  });
}

function matchesWeakness(pokemon, attackingType) {
  if (!attackingType) return true;
  return typeEffectiveness(attackingType, pokemon.types.map((entry) => entry.type.name)) > 1;
}

function matchesLocalMoves(pokemon, moves) {
  if (!moves.length) return true;
  const knownMoves = new Set(pokemon.moves.map((entry) => entry.move.name));
  return moves.every((move) => knownMoves.has(move));
}

function matchesLocalAbility(pokemon, ability) {
  if (!ability) return true;
  return pokemon.abilities.some((entry) => entry.ability.name === ability);
}

function matchesLocalType(pokemon, type) {
  if (!type) return true;
  return pokemon.types.some((entry) => entry.type.name === type);
}

function calculateWeaknesses(defendingTypes) {
  return Object.keys(typeRelations)
    .filter((attackingType) => typeEffectiveness(attackingType, defendingTypes) > 1)
    .sort();
}

function typeEffectiveness(attackingType, defendingTypes) {
  const relation = typeRelations[attackingType];
  if (!relation) return 1;

  return defendingTypes.reduce((multiplier, defendingType) => {
    if (relation.noTo.includes(defendingType)) return multiplier * 0;
    if (relation.doubleTo.includes(defendingType)) return multiplier * 2;
    if (relation.halfTo.includes(defendingType)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

function intersectCandidates(current, names) {
  const next = new Set(names);
  if (!current) return next;
  return new Set([...current].filter((name) => next.has(name)));
}

function normalizeName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function formatName(value) {
  return value.replaceAll("-", " ");
}

function setLoading(isLoading, title, text) {
  loader.hidden = !isLoading;
  statusTitle.textContent = title;
  statusText.textContent = text;
}

function renderEmpty(message) {
  results.innerHTML = `<div class="empty-state">${message}</div>`;
}

function checkSecretPhrase(value) {
  const phrase = normalizeName(value);
  const secretMap = {
    obsidian: "obsidian",
    "obsidian-studios": "obsidian-studios",
    pizzha: "pizzha",
    create: "create",
    "la-noche-eterna": "la-noche-eterna",
    "un-dia-mas": "la-noche-eterna",
    aero: "aero",
    aerocraft: "aero",
    zeus: "zeus",
    "desafio-obsidian": "desafio-obsidian",
    agmez: "agmez",
    omnitrix: "agmez",
    shiny: "shiny",
    missingno: "missingno",
    masterball: "masterball",
  };

  if (secretMap[phrase]) {
    activateSecret(secretMap[phrase]);
  }
}

function activateSecret(secret) {
  if (!["obsidian-studios", "pizzha", "zeus"].includes(secret) && triggeredSecrets.has(secret)) {
    return;
  }

  triggeredSecrets.add(secret);
  updateSecretChain(secret);

  const actions = {
    konami: () => {
      document.body.classList.add("obsidian-takeover");
      showToast("Obsidian Studios ha tomado el control de la Pokedex.", "Konami Code");
      window.setTimeout(() => document.body.classList.remove("obsidian-takeover"), 6500);
    },
    obsidian: () => {
      showToast("Fundado por Pizzha. Donde las ideas se convierten en proyectos imposibles.", "Obsidian Studios");
      renderSecretPokemon();
    },
    "obsidian-studios": () => {
      showToast("Pokedex experimental de Obsidian Studios activada.", "Obsidian Dex");
      document.body.classList.add("obsidian-takeover");
      window.setTimeout(() => document.body.classList.remove("obsidian-takeover"), 6500);
    },
    pizzha: () => {
      const lines = [
        "Pokemon favorito: cualquiera que sobreviva al primer gimnasio.",
        "Error 404: El ingeniero esta ocupado usando Create.",
      ];
      showToast(lines[Math.floor(Math.random() * lines.length)], "Pizzha");
    },
    create: () => {
      showToast("Demasiados engranajes detectados.", "Create");
      temporaryBodyClass("create-spin", 5200);
    },
    "la-noche-eterna": () => {
      showToast("Los zombis estan mas cerca de lo que crees.", "Un Dia Mas");
      temporaryBodyClass("eternal-night", 8000);
    },
    aero: () => {
      showToast("Proxima parada: una fabrica de Create innecesariamente grande.", "AeroCraft");
      temporaryBodyClass("train-pass", 4200);
    },
    zeus: () => {
      showToast("Nivel de energia: Infinito.", "Zeus");
      temporaryBodyClass("zeus-charge", 4500);
    },
    "desafio-obsidian": () => {
      showQuizToast();
    },
    agmez: () => {
      showToast("Todos los Pokemon reciben temporalmente un Omnitrix.", "Agmez");
      temporaryBodyClass("omnitrix-mode", 7000);
    },
    shiny: () => {
      showToast("Probabilidad aumentada... o eso quieres creer.", "Shiny Luck");
      temporaryBodyClass("shiny-mode", 7000);
    },
    missingno: () => {
      showToast("Algo salio mal en la Pokedex... o quiza demasiado bien.", "MissingNo");
      renderMissingNo();
    },
    masterball: () => {
      showToast("Captura garantizada: se muestran todos los Pokemon locales.", "Master Ball");
      renderResults(window.LOCAL_POKEMON, { moves: [] });
      summaryCount.textContent = String(window.LOCAL_POKEMON.length);
    },
  };

  actions[secret]?.();
}

function updateSecretChain(secret) {
  if (!["obsidian-studios", "pizzha", "zeus"].includes(secret)) return;

  secretChain.push(secret);
  secretChain = secretChain.slice(-3);

  if (secretChain.join(">") === "obsidian-studios>pizzha>zeus") {
    showToast("Veterano de Obsidian Studios: conoces demasiado lore para ser una persona normal.", "Logro desbloqueado");
    temporaryBodyClass("achievement-unlocked", 7000);
    secretChain = [];
  }
}

function showToast(message, title = "Secreto desbloqueado") {
  let toast = document.querySelector(".secret-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "secret-toast";
    document.body.append(toast);
  }

  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 5200);
}

function showQuizToast() {
  showToast("Pregunta: quien fundo Obsidian Studios? Respuesta correcta: Pizzha.", "UliQuiz");
}

function temporaryBodyClass(className, duration) {
  document.body.classList.add(className);
  window.setTimeout(() => document.body.classList.remove(className), duration);
}

function renderSecretPokemon() {
  const secret = window.LOCAL_POKEMON.filter((pokemon) =>
    pokemon.types.some((entry) => ["rock", "dark"].includes(entry.type.name)),
  );
  const chosen = secret[Math.floor(Math.random() * secret.length)] || window.LOCAL_POKEMON[0];
  renderResults([chosen], { moves: [] });
  summaryCount.textContent = "1";
  setLoading(false, "Pokemon de Obsidian encontrado", "Tipo Roca/Siniestro detectado en el laboratorio.");
}

function renderMissingNo() {
  results.innerHTML = `
    <article class="pokemon-card missingno-card">
      <div class="card-top">
        <div class="sprite-wrap missingno-sprite">???</div>
        <div>
          <div class="dex-number">#0000</div>
          <h3 class="pokemon-name">missingno</h3>
          <div class="badge-row">
            <span class="badge type">glitch</span>
            <span class="badge type">???</span>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="info-block">
          <strong>Estado</strong>
          <div class="badge-row">
            <span class="badge match">datos corruptos</span>
            <span class="badge">stats ???</span>
          </div>
        </div>
      </div>
    </article>
  `;
  summaryCount.textContent = "?";
  setLoading(false, "Error imposible", "La Pokedex encontro algo que no deberia existir.");
}

function friendlyError(error) {
  const message = `${error.name || ""} ${error.message || error}`;
  if (message.includes("AbortError")) {
    return "PokeAPI tardo demasiado en responder.";
  }
  if (message.includes("Failed to fetch")) {
    return "No hay conexion con PokeAPI en este momento.";
  }
  return error.message || "Ocurrio un error inesperado.";
}

function clearOldCache() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(CACHE_PREFIX))
    .slice(0, 80)
    .forEach((key) => localStorage.removeItem(key));
}
