// DOM Elements
const shortcutsContainer = document.getElementById("shortcuts-container");
const addShortcutBtn = document.getElementById("add-shortcut-btn");
const modal = document.getElementById("shortcut-modal");
const cancelBtn = document.getElementById("cancel-shortcut");
const saveBtn = document.getElementById("save-shortcut");
const nameInput = document.getElementById("shortcut-name-input");
const urlInput = document.getElementById("shortcut-url-input");
const bgImage = document.getElementById("bg-image");
const bgVideo = document.getElementById("bg-video");
const chargingCanvas = document.getElementById("charging-canvas");

const loginOverlay = document.getElementById("login-overlay");
const mainContent = document.getElementById("main-content");
const loginBtn = document.getElementById("login-btn");

const engineToggle = document.getElementById("engine-toggle");
const engineDropdown = document.getElementById("engine-dropdown");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchHistory = document.getElementById("search-history");
const editWallpaperBtn = document.getElementById("edit-wallpaper-btn");
const wallpaperUpload = document.getElementById("wallpaper-upload");

const API_URL = window.location.origin && window.location.origin.startsWith("http")
  ? window.location.origin
  : "http://localhost:8000";

const IS_SERVERLESS = window.location.hostname.endsWith("github.io") || window.location.protocol === "file:";
const NEWS_API_KEY = "2839ee89fc5c46eba93a331b89440397";

// State
let shortcuts = JSON.parse(localStorage.getItem("shortcuts")) || [
  { name: "Google", url: "https://www.google.com", icon: "fab fa-google" },
  { name: "YouTube", url: "https://www.youtube.com", icon: "fab fa-youtube" },
  { name: "GitHub", url: "https://github.com", icon: "fab fa-github" },
  { name: "Reddit", url: "https://www.reddit.com", icon: "fab fa-reddit" },
  { name: "Twitter", url: "https://twitter.com", icon: "fab fa-twitter" },
];

const engines = [
  { name: "Google", icon: "fab fa-google", url: "https://www.google.com/search" },
  { name: "Bing", icon: "fab fa-microsoft", url: "https://www.bing.com/search" },
  { name: "DuckDuckGo", icon: "fas fa-search", url: "https://duckduckgo.com/" },
];

const WALLPAPER_VARIATIONS = [
  { color: "rgba(255, 255, 255, 0.9)", count: 120, speed: 0.5 }, // Classic White
  { color: "rgba(0, 210, 255, 0.9)", count: 150, speed: 0.8 },   // Cyber Blue
  { color: "rgba(255, 165, 0, 0.9)", count: 100, speed: 0.3 },   // Amber Energy
  { color: "rgba(180, 255, 0, 0.9)", count: 130, speed: 0.6 },   // Lime Ghost
];

let currentVariation = WALLPAPER_VARIATIONS[0];
let currentEngineIndex = parseInt(localStorage.getItem("searchEngineIndex")) || 0;
let historyData = JSON.parse(localStorage.getItem("searchHistory")) || [];
let customWallpaperUrl = null;

// IndexedDB Helper
const DB_NAME = "WallpaperDB";
const STORE_NAME = "wallpapers";
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
  });
}
async function saveWallpaperDB(blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, "custom_wallpaper");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getWallpaperDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get("custom_wallpaper");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
let animationId;
let particles = [];
const ctx = chargingCanvas.getContext("2d");

const CREDENTIALS = {
  username: "sid.soid",
  password: "1234567",
};

// Functions
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, "0");

  document.getElementById("clock").textContent = `${hoursStr}:${minutes} ${ampm}`;

  const options = { weekday: "long", month: "long", day: "numeric" };
  document.getElementById("date").textContent = now.toLocaleDateString(
    undefined,
    options,
  );
}

async function fetchBackground() {
  // 1. Try fetching from Supabase database via FastAPI backend (with cache buster)
  if (!IS_SERVERLESS) {
    try {
      const response = await fetch(`${API_URL}/wallpapers/?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.wallpapers && data.wallpapers.length > 0) {
          const latest = data.wallpapers[0];
          const wallpaperUrl = latest.filepath.startsWith("http") || latest.filepath.startsWith("data:")
            ? latest.filepath
            : `${API_URL}${latest.filepath}`;

          const isVideo = latest.content_type 
            ? latest.content_type.startsWith("video/") 
            : latest.filepath.match(/\.(mp4|webm|ogg|mov)$/i);

          if (customWallpaperUrl) {
            URL.revokeObjectURL(customWallpaperUrl);
            customWallpaperUrl = null;
          }

          if (isVideo) {
            bgImage.style.display = "none";
            bgVideo.style.display = "block";
            bgVideo.style.opacity = "1";
            bgVideo.src = wallpaperUrl;
            bgVideo.play().catch(e => console.warn("Video autoplay failed:", e));
          } else {
            bgVideo.style.display = "none";
            bgVideo.pause();
            bgVideo.src = "";
            bgImage.style.display = "block";
            bgImage.style.opacity = "1";
            bgImage.src = wallpaperUrl;
          }
          return;
        }
      }
    } catch (e) {
      console.warn("Could not connect to backend database, falling back to local DB:", e.message);
    }
  }

  // 2. Fallback to local IndexedDB
  try {
    const blob = await getWallpaperDB();
    if (blob) {
      if (customWallpaperUrl) URL.revokeObjectURL(customWallpaperUrl);
      customWallpaperUrl = URL.createObjectURL(blob);
      
      const isVideo = blob.type && blob.type.startsWith("video/");
      
      if (isVideo) {
        bgImage.style.display = "none";
        bgVideo.style.display = "block";
        bgVideo.style.opacity = "1";
        bgVideo.src = customWallpaperUrl;
        bgVideo.play().catch(e => console.warn("Video autoplay failed:", e));
      } else {
        bgVideo.style.display = "none";
        bgVideo.pause();
        bgVideo.src = "";
        bgImage.style.display = "block";
        bgImage.style.opacity = "1";
        bgImage.src = customWallpaperUrl;
      }
      return;
    }
  } catch (e) {
    console.error("Failed to load wallpaper from local DB", e);
  }

  // 3. Fallback to random image
  bgVideo.style.display = "none";
  bgVideo.pause();
  bgVideo.src = "";
  bgImage.style.display = "block";
  bgImage.style.opacity = "1";
  const randomSeed = Math.floor(Math.random() * 1000);
  bgImage.src = `https://picsum.photos/seed/${randomSeed}/1920/1080`;
}

function renderShortcuts() {
  const existingShortcuts = shortcutsContainer.querySelectorAll(".shortcut:not(.add-shortcut-btn)");
  existingShortcuts.forEach((s) => s.remove());

  shortcuts.forEach((shortcut, index) => {
    const shortcutEl = document.createElement("div");
    shortcutEl.className = "shortcut";
    let iconClass = shortcut.icon || "fas fa-link";
    if (!shortcut.icon) {
      if (shortcut.url.includes("google")) iconClass = "fab fa-google";
      else if (shortcut.url.includes("youtube")) iconClass = "fab fa-youtube";
      else if (shortcut.url.includes("github")) iconClass = "fab fa-github";
      else if (shortcut.url.includes("reddit")) iconClass = "fab fa-reddit";
      else if (shortcut.url.includes("twitter") || shortcut.url.includes("x.com")) iconClass = "fab fa-twitter";
    }

    shortcutEl.innerHTML = `
      <a href="${shortcut.url}" class="shortcut-link">
        <div class="shortcut-icon"><i class="${iconClass}"></i></div>
        <span class="shortcut-name">${shortcut.name}</span>
      </a>
      <div class="shortcut-delete" data-index="${index}"><i class="fas fa-times"></i></div>
    `;

    shortcutEl.querySelector(".shortcut-delete").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteShortcut(index);
    });

    shortcutsContainer.insertBefore(shortcutEl, addShortcutBtn);
  });
}

function deleteShortcut(index) {
  shortcuts.splice(index, 1);
  localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
  renderShortcuts();
}

function addShortcut() {
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  if (!name || !url) return;
  if (!url.startsWith("http")) url = "https://" + url;
  shortcuts.push({ name, url });
  localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
  renderShortcuts();
  closeModal();
}

const closeModal = () => {
  modal.style.display = "none";
  nameInput.value = "";
  urlInput.value = "";
};

// Particle Class
class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * chargingCanvas.width;
    this.y = Math.random() * chargingCanvas.height;
    this.vx = (Math.random() - 0.5) * currentVariation.speed;
    this.vy = (Math.random() - 0.5) * currentVariation.speed;
    this.radius = Math.random() * 2.5 + 1; // Increased size range
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > chargingCanvas.width || this.y < 0 || this.y > chargingCanvas.height) this.reset();
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = currentVariation.color;
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  for (let i = 0; i < currentVariation.count; i++) particles.push(new Particle());
}

function animateWallpaper() {
  ctx.clearRect(0, 0, chargingCanvas.width, chargingCanvas.height);
  particles.forEach((p1, i) => {
    p1.update();
    p1.draw();
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 130) { // Increased distance to 130
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = currentVariation.color.replace("0.9", (1 - dist / 130) * 0.7); // Strengthened connection opacity
        ctx.lineWidth = 0.8; // Increased line width
        ctx.stroke();
      }
    }
  });
  animationId = requestAnimationFrame(animateWallpaper);
}

function handleBattery(battery) {
  const updateBatteryStatus = () => {
    chargingCanvas.style.display = "none";
    cancelAnimationFrame(animationId);
    animationId = null;
    fetchBackground();
  };
  battery.addEventListener("chargingchange", updateBatteryStatus);
  updateBatteryStatus();
}

function resizeCanvas() {
  chargingCanvas.width = window.innerWidth;
  chargingCanvas.height = window.innerHeight;
  if (particles.length > 0) initParticles();
}

async function getWeather(useGeolocation = false) {
  const tempEl = document.querySelector(".temp");
  const locationEl = document.querySelector(".location");

  const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  const updateWeather = async (lat, lon) => {
    try {
      console.log(`[Weather] Fetching for: ${lat ? lat + "," + lon : "detected IP"}`);
      tempEl.textContent = "Loading...";
      const query = lat && lon ? `${lat},${lon}` : "";
      const response = await fetchWithTimeout(`https://wttr.in/${query}?format=j1`);
      
      if (!response.ok) throw new Error("Weather API Error");
      
      const data = await response.json();
      
      if (data.current_condition && data.current_condition[0] && 
          data.nearest_area && data.nearest_area[0]) {
        const temp = data.current_condition[0].temp_C;
        const city = data.nearest_area[0].areaName[0].value;
        const country = data.nearest_area[0].country[0].value;

        tempEl.textContent = `${temp}°C`;
        locationEl.textContent = `${city}, ${country}`;
        console.log(`[Weather] Success: ${city}, ${temp}C`);
      } else {
        throw new Error("Invalid Weather Data Structure");
      }
    } catch (error) {
      console.error("[Weather] Update failed:", error);
      tempEl.textContent = "--°C";
      locationEl.textContent = "Location not found";
    }
  };

  const fallbackToIP = async () => {
    console.log("[Location] Trying Primary IP Fallback (ipapi.co)...");
    locationEl.textContent = "Locating (IP 1)...";
    
    try {
      const response = await fetchWithTimeout("https://ipapi.co/json/");
      const data = await response.json();
      if (data.latitude && data.longitude) {
        console.log(`[Location] ipapi.co success: ${data.city}`);
        return updateWeather(data.latitude, data.longitude);
      }
      throw new Error("ipapi.co returned incomplete data");
    } catch (e) {
      console.warn("[Location] Primary IP Fallback failed, trying Secondary (ip-api.com)...", e.message);
      locationEl.textContent = "Locating (IP 2)...";
      
      try {
        const response = await fetchWithTimeout("http://ip-api.com/json/");
        const data = await response.json();
        if (data.lat && data.lon) {
          console.log(`[Location] ip-api.com success: ${data.city}`);
          return updateWeather(data.lat, data.lon);
        }
        throw new Error("ip-api.com returned incomplete data");
      } catch (e2) {
        console.error("[Location] All IP fallbacks failed. Using internal IP detection.", e2.message);
        locationEl.textContent = "Fetching Weather...";
        updateWeather(); // Ultimate fallback to wttr.in internal IP logic
      }
    }
  };

  const isLocalFile = window.location.protocol === "file:";

  if (useGeolocation && "geolocation" in navigator && !isLocalFile) {
    console.log("[Location] Triggering GPS Detection...");
    locationEl.textContent = "Locating (GPS)...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("[Location] GPS Success");
        updateWeather(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("[Location] GPS Failed or Denied:", err.code, err.message);
        fallbackToIP();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  } else if (useGeolocation) {
    if (isLocalFile) console.log("[Location] Local file detected, skipping GPS, jumping to IP.");
    fallbackToIP();
  } else {
    updateWeather();
  }
}

function checkLogin() {
  loginOverlay.style.display = "flex";
  mainContent.classList.remove("content-visible");
}

function handleLogin() {
  showContent();
}

function showContent() {
  loginOverlay.style.opacity = "0";
  setTimeout(() => {
    loginOverlay.style.display = "none";
    mainContent.classList.add("content-visible");
  }, 500);
}

function updateSearchEngine() {
  const engine = engines[currentEngineIndex];
  searchForm.action = engine.url;
  searchInput.placeholder = `Search ${engine.name}...`;
  engineToggle.innerHTML = `<i class="${engine.icon}"></i>`;
  localStorage.setItem("searchEngineIndex", currentEngineIndex);
  
  engineDropdown.innerHTML = "";
  engines.forEach((e, idx) => {
    const opt = document.createElement("div");
    opt.className = "engine-option";
    opt.innerHTML = `<i class="${e.icon}"></i> <span>${e.name}</span>`;
    opt.onclick = () => {
      currentEngineIndex = idx;
      updateSearchEngine();
      engineDropdown.style.display = "none";
    };
    engineDropdown.appendChild(opt);
  });
}

function saveSearch(query) {
  if (!query) return;
  historyData = historyData.filter((q) => q !== query);
  historyData.unshift(query);
  historyData = historyData.slice(0, 10);
  localStorage.setItem("searchHistory", JSON.stringify(historyData));
  renderHistory();
}

function renderHistory() {
  if (historyData.length === 0) {
    searchHistory.innerHTML = '<div class="history-item" style="cursor: default; opacity: 0.6;">No history yet</div>';
    return;
  }
  searchHistory.innerHTML = "";
  historyData.forEach((query, index) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <span class="history-text">${query}</span>
      <div class="history-delete" data-index="${index}"><i class="fas fa-times"></i></div>
    `;
    item.onclick = (e) => {
      if (e.target.closest(".history-delete")) return;
      searchInput.value = query;
      searchForm.submit();
      searchInput.value = "";
      searchHistory.style.display = "none";
    };
    item.querySelector(".history-delete").onclick = (e) => {
      e.stopPropagation();
      deleteHistoryItem(index);
    };
    searchHistory.appendChild(item);
  });
}

function deleteHistoryItem(index) {
  historyData.splice(index, 1);
  localStorage.setItem("searchHistory", JSON.stringify(historyData));
  renderHistory();
}

// Event Listeners
addShortcutBtn.onclick = () => { modal.style.display = "flex"; nameInput.focus(); };
cancelBtn.onclick = closeModal;
saveBtn.onclick = addShortcut;
window.onclick = (e) => { if (e.target === modal) closeModal(); };
document.getElementById("get-location").onclick = (e) => { 
  e.stopPropagation(); 
  getWeather(true); 
};

const weatherWidget = document.querySelector(".weather-widget");
weatherWidget.onclick = () => {
  const locationText = document.querySelector(".location").textContent;
  if (locationText && locationText !== "Location not found" && locationText !== "Locating...") {
    const query = encodeURIComponent(`weather ${locationText}`);
    window.location.href = `https://www.google.com/search?q=${query}`;
  }
};

loginBtn.addEventListener("click", handleLogin);

document.getElementById("news-title-link").onclick = (e) => {
  e.preventDefault();
  const query = e.currentTarget.textContent;
  if (query && query !== "Loading sports & important news...") {
    saveSearch(query);
    searchInput.value = query;
    searchForm.submit();
    searchInput.value = "";
  }
};

engineToggle.onclick = (e) => {
  e.stopPropagation();
  engineDropdown.style.display = engineDropdown.style.display === "flex" ? "none" : "flex";
};

editWallpaperBtn.onclick = () => {
  wallpaperUpload.click();
};

wallpaperUpload.onchange = async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      // 1. Cache locally first
      await saveWallpaperDB(file);
      
      // 2. Upload to Supabase backend database if not serverless
      if (!IS_SERVERLESS) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const response = await fetch(`${API_URL}/upload-wallpaper/`, {
            method: "POST",
            body: formData
          });
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
        } catch (uploadErr) {
          console.warn("Failed to upload wallpaper to backend database, saved locally:", uploadErr);
        }
      }
      
      // 3. Update background
      fetchBackground();
    } catch (err) {
      console.error("Failed to save wallpaper", err);
    }
  }
};

searchForm.onsubmit = (e) => {
  const query = searchInput.value.trim();
  if (query) {
    saveSearch(query);
    setTimeout(() => { searchInput.value = ""; }, 100);
  }
};

searchInput.onfocus = () => { renderHistory(); searchHistory.style.display = "flex"; };
document.addEventListener("click", (e) => { 
  if (!e.target.closest(".search-container")) {
    searchHistory.style.display = "none"; 
    engineDropdown.style.display = "none";
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "/" || (e.ctrlKey && e.key === "k")) {
    if (document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); }
  }
});

// Theme Toggle Logic
const themeToggleBtn = document.getElementById("theme-toggle-btn");

function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
  } else {
    document.body.classList.remove("light-mode");
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    themeToggleBtn.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  });
}

// Helper to calculate relative time
function getRelativeTime(dateStr) {
  if (!dateStr) return "Just now";
  try {
    const pubDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now - pubDate;
    
    if (diffMs < 0) return "Just now";
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch (e) {
    return "Recently";
  }
}

// News Widget State & Logic
let newsList = [
  {
    "title": "Loading real-time NewsAPI...",
    "source": "NewsAPI",
    "link": "#",
    "pub_date": ""
  }
];
let currentNewsIndex = 0;
let newsIntervalId = null;

function displayNews(index) {
  if (!newsList || newsList.length === 0) return;
  const item = newsList[index];
  const titleEl = document.getElementById("news-title-link");
  const sourceEl = document.getElementById("news-source");
  const timeEl = document.getElementById("news-time");
  const widget = document.querySelector(".news-widget");
  
  if (widget) {
    widget.style.opacity = "0.4";
    
    setTimeout(() => {
      if (titleEl) {
        titleEl.textContent = item.title;
        titleEl.href = item.link;
      }
      if (sourceEl) {
        sourceEl.textContent = item.source || "Google News";
      }
      if (timeEl) {
        timeEl.textContent = getRelativeTime(item.pub_date);
      }
      widget.style.opacity = "1";
    }, 400);
  }
}

function cycleNews() {
  displayNews(currentNewsIndex);
  currentNewsIndex = (currentNewsIndex + 1) % newsList.length;
}

function resetNewsTimer() {
  if (newsIntervalId) clearInterval(newsIntervalId);
  newsIntervalId = setInterval(cycleNews, 20000);
}

async function fetchNews() {
  let fetchedNews = null;
  let activeSource = "Google News Tech";
  
  // 1. Try backend first if not serverless
  if (!IS_SERVERLESS) {
    try {
      const response = await fetch(`${API_URL}/news/?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.news && data.news.length > 0) {
          fetchedNews = data.news;
          // If it was backend, check if it used NewsAPI
          const firstItem = fetchedNews[0];
          if (firstItem && firstItem.source === "NewsAPI") {
            activeSource = "NewsAPI Tech";
          }
        }
      }
    } catch (e) {
      console.warn("Could not load fresh news from backend, falling back to client-side fetch:", e.message);
    }
  }
  
  // 2. Client-side fetch fallback
  if (!fetchedNews) {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    
    // A. Try NewsAPI directly on localhost if key is configured
    if (isLocalhost && NEWS_API_KEY && NEWS_API_KEY !== "YOUR_API_KEY") {
      try {
        const response = await fetch(`https://newsapi.org/v2/top-headlines?country=in&category=technology&apiKey=${NEWS_API_KEY}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "ok" && data.articles && data.articles.length > 0) {
            fetchedNews = data.articles.slice(0, 15).map(article => {
              const titleText = article.title || "";
              let cleanTitle = titleText;
              const lastDash = titleText.lastIndexOf(" - ");
              if (lastDash !== -1) {
                cleanTitle = titleText.substring(0, lastDash);
              }
              return {
                title: cleanTitle,
                source: article.source?.name || "NewsAPI",
                link: article.url || "#",
                pub_date: article.publishedAt || ""
              };
            });
            activeSource = "NewsAPI Tech";
          }
        }
      } catch (e) {
        console.warn("Client-side NewsAPI fetch failed, trying Google News RSS...", e.message);
      }
    }
    
    // B. Fetch Google News RSS via CORS Proxy
    if (!fetchedNews) {
      const rssUrl = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
      try {
        let xmlText = "";
        
        // Try corsproxy.io first
        try {
          const proxyResponse = await fetch(`https://corsproxy.io/?${encodeURIComponent(rssUrl)}`);
          if (proxyResponse.ok) {
            xmlText = await proxyResponse.text();
          } else {
            throw new Error(`corsproxy.io returned status: ${proxyResponse.status}`);
          }
        } catch (proxy1Err) {
          console.warn("corsproxy.io failed, trying allorigins...", proxy1Err.message);
          // Try allorigins second
          const proxyResponse = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`);
          if (proxyResponse.ok) {
            const data = await proxyResponse.json();
            xmlText = data.contents;
          } else {
            throw new Error(`allorigins returned status: ${proxyResponse.status}`);
          }
        }
        
        if (xmlText) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          const items = xmlDoc.querySelectorAll("item");
          if (items && items.length > 0) {
            fetchedNews = [];
            items.forEach((item, index) => {
              if (index >= 15) return;
              const titleText = item.querySelector("title")?.textContent || "";
              const linkText = item.querySelector("link")?.textContent || "";
              const pubDateText = item.querySelector("pubDate")?.textContent || "";
              const sourceText = item.querySelector("source")?.textContent || "";
              
              let cleanTitle = titleText;
              let sourceName = sourceText || "Google News";
              
              const lastDash = titleText.lastIndexOf(" - ");
              if (lastDash !== -1) {
                cleanTitle = titleText.substring(0, lastDash);
                sourceName = titleText.substring(lastDash + 3);
              }
              
              fetchedNews.push({
                title: cleanTitle,
                source: sourceName,
                link: linkText,
                pub_date: pubDateText
              });
            });
            activeSource = "Google News Tech";
          }
        }
      } catch (rssErr) {
        console.error("All news fetch methods failed:", rssErr);
      }
    }
  }
  
  // Update newsList if we fetched anything successfully
  if (fetchedNews && fetchedNews.length > 0) {
    newsList = fetchedNews;
    currentNewsIndex = 0;
  } else {
    // Fallback to offline message
    newsList = [
      {
        title: "News is temporarily unavailable. Check back later.",
        source: "News Hub",
        link: "https://news.google.com",
        pub_date: ""
      }
    ];
    currentNewsIndex = 0;
    activeSource = "Google News";
  }
  
  // Update the widget brand header text
  const brandTextEl = document.querySelector(".news-brand-text");
  if (brandTextEl) {
    brandTextEl.textContent = activeSource;
  }
  
  cycleNews();
  resetNewsTimer();

  const prevBtn = document.getElementById("news-prev-btn");
  const nextBtn = document.getElementById("news-next-btn");
  if (prevBtn && nextBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      currentNewsIndex = (currentNewsIndex - 2 + newsList.length) % newsList.length;
      cycleNews();
      resetNewsTimer();
    };
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      cycleNews();
      resetNewsTimer();
    };
  }
}

// Initialize
checkLogin();
initTheme();
updateClock();
setInterval(updateClock, 1000);
renderShortcuts();
updateSearchEngine();
getWeather();
fetchNews();
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
if ("getBattery" in navigator) {
  navigator.getBattery().then(handleBattery);
} else {
  fetchBackground();
}



