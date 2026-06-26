import { TurboMemory, type MemorySearchResult } from "turbomem/browser";

const SCOPE = { userId: "browser-demo" } as const;
const API_KEY_STORAGE = "turbomem-demo-api-key";

const apiKeyInput = document.querySelector<HTMLInputElement>("#api-key")!;
const initBtn = document.querySelector<HTMLButtonElement>("#init-btn")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const memoryPanel = document.querySelector<HTMLElement>("#memory-panel")!;
const factInput = document.querySelector<HTMLInputElement>("#fact")!;
const addBtn = document.querySelector<HTMLButtonElement>("#add-btn")!;
const queryInput = document.querySelector<HTMLInputElement>("#query")!;
const searchBtn = document.querySelector<HTMLButtonElement>("#search-btn")!;
const resultsEl = document.querySelector<HTMLUListElement>("#results")!;

let memory: TurboMemory | null = null;

const savedKey = sessionStorage.getItem(API_KEY_STORAGE);
if (savedKey) {
  apiKeyInput.value = savedKey;
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function renderResults(results: MemorySearchResult[]): void {
  resultsEl.replaceChildren();
  if (results.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No matching memories.";
    resultsEl.append(li);
    return;
  }

  for (const { memory: item, score } of results) {
    const li = document.createElement("li");
    const scoreSpan = document.createElement("span");
    scoreSpan.className = "score";
    scoreSpan.textContent = `[${score.toFixed(3)}] `;
    li.append(scoreSpan, document.createTextNode(item.content));
    resultsEl.append(li);
  }
}

async function initMemory(apiKey: string): Promise<TurboMemory> {
  const instance = new TurboMemory({
    storage: "pglite",
    pglite: {
      dataDir: "idb://turbomem-demo",
      relaxedDurability: true,
    },
    embeddings: "google",
    google: {
      apiKey,
      dimensions: 768,
    },
    extraction: {
      provider: "google",
      model: "gemini-3.5-flash",
      apiKey,
    },
  });

  await instance.init();
  return instance;
}

initBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    setStatus("Enter a Google API key to continue.");
    return;
  }

  initBtn.disabled = true;
  setStatus("Initialising PGlite (IndexedDB)…");

  try {
    if (memory) {
      await memory.close();
    }
    memory = await initMemory(apiKey);
    sessionStorage.setItem(API_KEY_STORAGE, apiKey);
    memoryPanel.hidden = false;
    setStatus("Ready — memories persist in IndexedDB for this origin.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
    memory = null;
    memoryPanel.hidden = true;
  } finally {
    initBtn.disabled = false;
  }
});

addBtn.addEventListener("click", async () => {
  if (!memory) return;
  const fact = factInput.value.trim();
  if (!fact) return;

  addBtn.disabled = true;
  setStatus("Embedding and storing fact…");

  try {
    await memory.addFacts([fact], SCOPE);
    factInput.value = "";
    setStatus("Fact saved. Try searching or reload the page to verify persistence.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    addBtn.disabled = false;
  }
});

searchBtn.addEventListener("click", async () => {
  if (!memory) return;
  const query = queryInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  setStatus("Searching…");

  try {
    const results = await memory.search(query, { ...SCOPE, limit: 5 });
    renderResults(results);
    setStatus(`Found ${results.length} result(s).`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    searchBtn.disabled = false;
  }
});
