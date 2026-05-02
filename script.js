// DOM Elements
const shortcutsContainer = document.getElementById("shortcuts-container");
const addShortcutBtn = document.getElementById("add-shortcut-btn");
const modal = document.getElementById("shortcut-modal");
const cancelBtn = document.getElementById("cancel-shortcut");
const saveBtn = document.getElementById("save-shortcut");
const nameInput = document.getElementById("shortcut-name-input");
const urlInput = document.getElementById("shortcut-url-input");
const bgImage = document.getElementById("bg-image");
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
let customWallpaper = localStorage.getItem("customWallpaper") || null;
let historyData = JSON.parse(localStorage.getItem("searchHistory")) || [];
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

function fetchBackground() {
  if (customWallpaper) {
    bgImage.src = customWallpaper;
    bgImage.onload = () => {
      bgImage.style.opacity = "1";
    };
    return;
  }
  const randomSeed = Math.floor(Math.random() * 1000);
  bgImage.src = `https://picsum.photos/seed/${randomSeed}/1920/1080`;
  
  bgImage.onload = () => {
    bgImage.style.opacity = "1";
  };
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
    if (battery.charging) {
      bgImage.style.display = "none";
      chargingCanvas.style.display = "block";
      // Pick a random variation when charging starts
      currentVariation = WALLPAPER_VARIATIONS[Math.floor(Math.random() * WALLPAPER_VARIATIONS.length)];
      initParticles();
      if (!animationId) animateWallpaper();
    } else {
      bgImage.style.display = "block";
      chargingCanvas.style.display = "none";
      cancelAnimationFrame(animationId);
      animationId = null;
    }
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

engineToggle.onclick = (e) => {
  e.stopPropagation();
  engineDropdown.style.display = engineDropdown.style.display === "flex" ? "none" : "flex";
};

editWallpaperBtn.onclick = () => {
  wallpaperUpload.click();
};

wallpaperUpload.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      customWallpaper = event.target.result;
      localStorage.setItem("customWallpaper", customWallpaper);
      fetchBackground();
    };
    reader.readAsDataURL(file);
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

// Initialize
checkLogin();
updateClock();
setInterval(updateClock, 1000);
fetchBackground();
renderShortcuts();
updateSearchEngine();
getWeather();
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
if ("getBattery" in navigator) { navigator.getBattery().then(handleBattery); }



