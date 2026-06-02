import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ==========================================
// 1. SETUP, STATE & GLOBAL VARIABLES
// ==========================================
const supabaseUrl = 'https://jvsjzlvabtffhsnvmcto.supabase.co';
const supabaseKey = 'sb_publishable_H2EPwvAaziQVz8T4yExdEw_bQrB5f3V';
const supabase = createClient(supabaseUrl, supabaseKey);

let globalLibraryData = [];
let currentOpenBookId = null;

// Common DOM Elements
const bookGrid = document.getElementById('book-grid');
const sheet = document.querySelector('.bottom-sheet:not(#wander-sheet)');
const sheetHandle = document.querySelector('.sheet-handle');
const topFab = document.getElementById('top-fab'); 
const bookshelfContainer = document.querySelector('.bookshelf');
const searchResultsContainer = document.getElementById('search-results-container');


// ==========================================
// 2. UTILITY & HELPER FUNCTIONS
// ==========================================

// Highly resilient helper to find data regardless of database capitalization
const getField = (obj, fieldName) => {
  if (!obj) return undefined;
  const key = Object.keys(obj).find(k => k.toLowerCase() === fieldName.toLowerCase());
  return key ? obj[key] : undefined;
};

// Formats DB timestamp to "MM-DD-YY" for the vintage stamp
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${m}-${d}-${y}`;
}

// Fallback cover generator
function getCoverUrl(isbn) {
  if (!isbn || isbn === 'N/A') return 'https://placehold.co/150x200?text=No+Cover';
  const cleanIsbn = String(isbn).replace(/[-\s]/g, '');
  return `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg?default=false`;
}

// Reusable function to update Supabase AND local memory
async function updateBookData(columnName, newValue) {
  if (!currentOpenBookId) return;

  const { data, error } = await supabase
    .from('books')
    .update({ [columnName]: newValue })
    .eq('uuid', currentOpenBookId);

  if (error) {
    console.error('Error updating book:', error);
  } else {
    const bookToUpdate = globalLibraryData.find(b => b.uuid === currentOpenBookId);
    if (bookToUpdate) {
      const key = Object.keys(bookToUpdate).find(k => k.toLowerCase() === columnName.toLowerCase()) || columnName;
      bookToUpdate[key] = newValue;
    }
  }
}


// ==========================================
// 3. CORE LIBRARY RENDERING (Grid, Hero, Stats)
// ==========================================

// Calculate and render Stats Page numbers
function calculateStats() {
  const books = globalLibraryData;
  const timeFilterEl = document.getElementById('stats-timefilter');
  const filter = timeFilterEl ? timeFilterEl.value : 'year';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const activeCount = books.filter(b => Number(getField(b, 'status')) === 0).length;
  
  let periodCount = 0;
  const completedBooks = books.filter(b => Number(getField(b, 'status')) === 1 && getField(b, 'read_date'));
  
  completedBooks.forEach(b => {
    const readDate = new Date(getField(b, 'read_date'));
    if (filter === 'all') periodCount++;
    else if (filter === 'year' && readDate.getFullYear() === currentYear) periodCount++;
    else if (filter === 'month' && readDate.getFullYear() === currentYear && readDate.getMonth() === currentMonth) periodCount++;
  });

  const categoryCounts = {};
  books.forEach(b => {
    const cat = getField(b, 'category');
    if (cat && cat !== 'Uncategorized' && cat !== 'N/A') {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  const sortedCategories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);
  const topCategories = sortedCategories.slice(0, 3); 

  const statActiveEl = document.getElementById('stat-active');
  const statYearlyEl = document.getElementById('stat-yearly');
  const statCategoriesEl = document.getElementById('stat-categories');

  if (statActiveEl) statActiveEl.textContent = activeCount;
  
  if (statYearlyEl) {
    statYearlyEl.textContent = periodCount;
    const labelEl = statYearlyEl.nextElementSibling;
    if (labelEl) {
        labelEl.textContent = filter === 'month' ? 'Books Read This Month' : 
                              filter === 'year' ? 'Books Read This Year' : 
                              'Total Books Read';
    }
  }

  if (statCategoriesEl) {
    if (topCategories.length === 0) {
      statCategoriesEl.innerHTML = '<li>No categories yet</li>';
    } else {
      statCategoriesEl.innerHTML = topCategories.map(cat => `<li>${cat} (${categoryCounts[cat]})</li>`).join('');
    }
  }
}

// --- BATCH 8: STATS LIST VIEW LOGIC ---
function openStatsList(listType) {
  // 1. Force navigation to the Stats Tab if we aren't there already
  const statsNav = document.querySelector('.nav-item[data-target="view-stats"]');
  if (statsNav && !statsNav.classList.contains('active')) statsNav.click();

  const dashboard = document.getElementById('stats-dashboard');
  const listView = document.getElementById('stats-list-view');
  const listTitle = document.getElementById('stats-list-title');
  const listContainer = document.getElementById('stats-list-container');

  if (!dashboard || !listView || !listContainer) return;

  // 2. Toggle the UI
  dashboard.classList.add('hidden');
  listView.classList.remove('hidden');
  listContainer.innerHTML = ''; 

  // 3. Filter Data Based on the Request
  let booksToShow = [];
  if (listType === 'tbr') {
    listTitle.textContent = 'To Be Read';
    booksToShow = globalLibraryData.filter(b => Number(getField(b, 'status')) === 0);
  } else if (listType === 'active') {
    listTitle.textContent = 'Current Reads';
    booksToShow = globalLibraryData.filter(b => Number(getField(b, 'status')) === 1);
  } else if (listType === 'read') {
    listTitle.textContent = 'Completed Books';
    booksToShow = globalLibraryData.filter(b => Number(getField(b, 'status')) === 2);
  } else if (listType === 'read_again') {
    listTitle.textContent = 'Read Again (Favorites)';
    // Pulls Finished books that are rated exactly 5 Stars!
    booksToShow = globalLibraryData.filter(b => Number(getField(b, 'status')) === 2 && Number(getField(b, 'rating')) === 5);
  }

  // 4. Render the Data using the Search Result HTML structure
  if (booksToShow.length === 0) {
    listContainer.innerHTML = '<p style="text-align:center; margin-top: 40px; color: var(--sage-green); font-family: Courier New;">Nothing here yet!</p>';
    return;
  }

  booksToShow.forEach(book => {
    const title = getField(book, 'title') || 'Unknown Title';
    const author = getField(book, 'author') || 'Unknown Author';
    const coverUrl = getField(book, 'cover_url') || 'https://placehold.co/60x90?text=No+Cover';
    const statusVal = Number(getField(book, 'status'));
    
    let statusLabel = 'Waiting';
    if (statusVal === 1) statusLabel = 'Reading';
    if (statusVal === 2) statusLabel = 'Finished';
    if (statusVal === 3) statusLabel = 'Gave Up';

    const card = document.createElement('div');
    card.className = 'search-result-card';
    card.style.cursor = 'pointer'; 
    card.style.marginBottom = '15px'; // Breathing room
    
    card.innerHTML = `
      <img src="${coverUrl}" alt="Cover" style="width: 60px; height: 90px; object-fit: cover; border-radius: 4px;">
      <div class="search-result-info">
        <h3 style="margin: 0 0 5px 0;">${title}</h3>
        <p style="margin: 0; color: var(--text-dark);">${author}</p>
        <span style="display: inline-block; margin-top: 8px; font-size: 11px; font-family: 'Courier New'; color: var(--terracotta); border: 1px solid var(--terracotta); padding: 2px 6px; border-radius: 4px;">${statusLabel}</span>
      </div>
    `;
    
    // Tapping the card opens the details sheet!
    card.addEventListener('click', () => openDetails(book));
    listContainer.appendChild(card);
  });
}

// 5. Wire up the List Back Button & Stat Boxes
const closeStatsListBtn = document.getElementById('close-stats-list');
if (closeStatsListBtn) {
  closeStatsListBtn.addEventListener('click', () => {
    document.getElementById('stats-list-view').classList.add('hidden');
    document.getElementById('stats-dashboard').classList.remove('hidden');
  });
}

const activeStatBox = document.getElementById('active-stat-box');
if (activeStatBox) activeStatBox.addEventListener('click', () => openStatsList('active'));

const completedStatBox = document.getElementById('completed-stat-box');
if (completedStatBox) completedStatBox.addEventListener('click', () => openStatsList('read'));

// Time filter listener
const timeFilterEl = document.getElementById('stats-timefilter');
if (timeFilterEl) {
  timeFilterEl.addEventListener('change', calculateStats);
}

// Dynamic Active Reads Carousel
function renderHeroSection() {
  const carousel = document.getElementById('active-reads-carousel');
  const heroLabel = document.getElementById('hero-label');
  const wrapper = document.getElementById('current-read-section');
  if (!carousel || !heroLabel) return;

  carousel.innerHTML = ''; 

  const createSlimAddBtn = () => {
    const btn = document.createElement('div');
    btn.className = 'carousel-item slim-add-btn';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    btn.addEventListener('click', () => document.querySelector('.nav-item[data-target="view-search"]').click());
    return btn;
  };

  const activeReads = globalLibraryData.filter(b => Number(getField(b, 'status')) === 1);

  // SCENARIO A: Empty State
  if (activeReads.length === 0) {
    heroLabel.textContent = "Start Reading";
    
    const tbrCard = document.createElement('div');
    tbrCard.className = 'carousel-item special-card';
    tbrCard.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      <h3>TBR</h3>
      <p>Check your To Be Read list</p>
    `;
    tbrCard.addEventListener('click', () => openStatsList('tbr'));
    carousel.appendChild(tbrCard);

    const readAgainCard = document.createElement('div');
    readAgainCard.className = 'carousel-item special-card';
    readAgainCard.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        <circle cx="12" cy="9" r="5" fill="var(--card-bg)"></circle>
        <line x1="12" y1="7" x2="12" y2="11" stroke="var(--sage-green)" stroke-width="2"></line>
        <line x1="10" y1="9" x2="14" y2="9" stroke="var(--sage-green)" stroke-width="2"></line>
      </svg>
      <h3>Read Again</h3>
      <p>Revisit an old favorite</p>
    `;
    readAgainCard.addEventListener('click', () => openStatsList('read_again'));
    carousel.appendChild(readAgainCard);
    carousel.appendChild(createSlimAddBtn());

  // SCENARIO B: Exactly 1 Active Read
  } else if (activeReads.length === 1) {
    heroLabel.textContent = "Current Read";
    
    const book = activeReads[0];
    const card = document.createElement('div');
    card.className = 'carousel-item';
    const coverUrl = getField(book, 'cover_url') || 'https://placehold.co/150x200?text=No+Cover';
    card.innerHTML = `<img src="${coverUrl}" alt="${getField(book, 'title')}" class="cover-image">`;
    card.addEventListener('click', () => openDetails(book, card)); 
    carousel.appendChild(card);

    const tbrCard = document.createElement('div');
    tbrCard.className = 'carousel-item special-card';
    tbrCard.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      <h3>TBR</h3>
      <p>Next up...</p>
    `;
    tbrCard.addEventListener('click', () => openStatsList('tbr'));
    carousel.appendChild(tbrCard);
    carousel.appendChild(createSlimAddBtn());

  // SCENARIO C: 2 to 4 Active Reads
  } else {
    heroLabel.textContent = "Current Reads";
    const displayReads = activeReads.slice(0, 4); 

    displayReads.forEach(book => {
      const card = document.createElement('div');
      card.className = 'carousel-item';
      const coverUrl = getField(book, 'cover_url') || 'https://placehold.co/150x200?text=No+Cover';
      card.innerHTML = `<img src="${coverUrl}" alt="${getField(book, 'title')}" class="cover-image">`;
      card.addEventListener('click', () => openDetails(book, card)); 
      carousel.appendChild(card);
    });

    if (activeReads.length > 4) {
      const seeAllCard = document.createElement('div');
      seeAllCard.className = 'carousel-item special-card';
      seeAllCard.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        <h3>See All</h3>
      `;
      seeAllCard.addEventListener('click', () => openStatsList('active'));
      carousel.appendChild(seeAllCard);
    } else {
      carousel.appendChild(createSlimAddBtn());
    }
  }

  // Floating scroll-back arrow logic
  let backArrow = document.getElementById('carousel-back-arrow');
  if (!backArrow) {
    backArrow = document.createElement('button');
    backArrow.id = 'carousel-back-arrow';
    backArrow.className = 'carousel-back-arrow hidden';
    backArrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    wrapper.appendChild(backArrow);

    backArrow.addEventListener('click', () => carousel.scrollTo({ left: 0, behavior: 'smooth' }));

    carousel.addEventListener('scroll', () => {
      if (carousel.scrollLeft > 20) backArrow.classList.remove('hidden');
      else backArrow.classList.add('hidden');
    });
  }
}

// Master load function for Library Grid
async function loadBooks() {
  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .order('title', { ascending: true });

  if (error) { console.error(error); return; }
  
  globalLibraryData = books; 
  calculateStats(); 
  renderHeroSection();
  
  // Instead of drawing the grid here, we trigger the Master Filter!
  applyLibraryFilters();
}

// --- BATCH 7 & 8: MASTER FILTER & SORT LOGIC ---
function applyLibraryFilters() {
  const searchTerm = (document.getElementById('local-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filter-status')?.value || 'all';
  const sortMethod = document.getElementById('sort-library')?.value || 'date_added_desc';

  // 1. FILTERING
  let filteredBooks = globalLibraryData.filter(book => {
    // Search Filter (Title or Author)
    const title = (getField(book, 'title') || '').toLowerCase();
    const author = (getField(book, 'author') || '').toLowerCase();
    const matchesSearch = title.includes(searchTerm) || author.includes(searchTerm);

    // Status Filter
    const status = getField(book, 'status');
    const matchesStatus = statusFilter === 'all' || Number(status) === Number(statusFilter);

    return matchesSearch && matchesStatus;
  });

  // 2. SORTING
  filteredBooks.sort((a, b) => {
    // Title (A-Z)
    if (sortMethod === 'title_asc') {
      const titleA = (getField(a, 'title') || 'Z').toLowerCase(); 
      const titleB = (getField(b, 'title') || 'Z').toLowerCase();
      return titleA.localeCompare(titleB);
    }
    // Author (A-Z)
    else if (sortMethod === 'author_asc') {
      const authorA = (getField(a, 'author') || 'Z').toLowerCase(); 
      const authorB = (getField(b, 'author') || 'Z').toLowerCase();
      return authorA.localeCompare(authorB);
    } 
    // Highest Rated
    else if (sortMethod === 'rating_desc') {
      const ratingA = Number(getField(a, 'rating')) || 0;
      const ratingB = Number(getField(b, 'rating')) || 0;
      return ratingB - ratingA;
    }
    // Recently Read
    else if (sortMethod === 'date_read_desc') {
      const dateA = new Date(getField(a, 'read_date') || 0).getTime();
      const dateB = new Date(getField(b, 'read_date') || 0).getTime();
      return dateB - dateA;
    }
    // Newest Added (Default)
    else {
      const dateA = new Date(getField(a, 'date_added') || getField(a, 'created_at') || 0).getTime();
      const dateB = new Date(getField(b, 'date_added') || getField(b, 'created_at') || 0).getTime();
      return dateB - dateA;
    }
  });

  // Pass the final sliced-and-diced array to the renderer
  renderGrid(filteredBooks);
  updateLibrarySubheading()
}

function updateLibrarySubheading() {
  const subheading = document.getElementById('library-subheading');
  if (!subheading) return;

  const statusMap = {
    'all': 'All Books',
    '1': 'Current Reads',
    '0': 'TBR List',
    '2': 'Finished',
    '3': 'Gave Up'
  };

  const sortMap = {
    'title_asc': 'Title (A-Z)',
    'author_asc': 'Author (A-Z)',
    'date_added_desc': 'Date Added',
    'date_started_desc': 'Date Started',
    'date_finished_desc': 'Date Finished'
  };

  const currentStatus = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';
  const currentSort = document.getElementById('sort-library') ? document.getElementById('sort-library').value : 'title_asc';

  subheading.textContent = `${statusMap[currentStatus] || 'All Books'}, by ${sortMap[currentSort] || 'Title'}`;
}

// --- BATCH 7: GRID RENDERER & EMPTY STATE ---
function renderGrid(booksToRender) {
  if (!bookGrid) return;
  bookGrid.innerHTML = '';

  // EMPTY STATE: If the filter returns nothing!
  if (booksToRender.length === 0) {
    bookGrid.innerHTML = `
      <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; opacity: 0.85;">
        <p style="font-family: 'Courier New', Courier, monospace; color: var(--sage-green); font-size: 1.1rem;">
          Nothing in this stack...
        </p>
      </div>
    `;
    return;
  }

  // Draw the covers
  for (const book of booksToRender) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-cover';
    
    const savedCover = getField(book, 'cover_url');
    const isbn = getField(book, 'isbn');
    const title = getField(book, 'title') || 'Unknown Title';
    const author = getField(book, 'author') || 'Unknown Author';

    if (savedCover && savedCover !== 'https://placehold.co/60x90?text=No+Cover') {
      bookDiv.innerHTML = `
        <img src="${savedCover}" data-isbn="${isbn}" alt="${title}" class="cover-image" onerror="this.src='https://placehold.co/150x200?text=No+Cover'">
        <h3 class="cover-title">${title}</h3>
        <p class="cover-author">${author}</p>
      `;
    } else {
      bookDiv.innerHTML = `
        <img src="https://placehold.co/150x200?text=Loading..." data-isbn="${isbn}" alt="${title}" class="cover-image lazy-cover">
        <h3 class="cover-title">${title}</h3>
        <p class="cover-author">${author}</p>
      `;
    }
    
    bookDiv.addEventListener('click', () => openDetails(book, bookDiv));
    bookGrid.appendChild(bookDiv);
  }

  // Re-attach Lazy loading for missing covers
  const lazyCovers = document.querySelectorAll('.lazy-cover');
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const coverUrl = getCoverUrl(img.dataset.isbn);
        img.src = coverUrl;
        img.onerror = () => { img.src = 'https://placehold.co/150x200?text=No+Cover'; };
        observer.unobserve(img);
      }
    });
  });
  lazyCovers.forEach(img => observer.observe(img));
}

// Attach Event Listeners to Toolbar Inputs
document.getElementById('local-search')?.addEventListener('input', applyLibraryFilters);
document.getElementById('filter-status')?.addEventListener('change', applyLibraryFilters);
document.getElementById('sort-library')?.addEventListener('change', applyLibraryFilters);


// ==========================================
// 4. DETAILS CARD LOGIC (Populate, Status, Stars)
// ==========================================

function openDetails(book, clickedElement) {
  if (clickedElement) clickedElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentOpenBookId = book.uuid;
  
  // Elements
  const titleEl = document.querySelector('.book-title');
  const authorEl = document.querySelector('.book-author');
  const catEl = document.querySelector('.metadata[data-field="category"]');
  const ratingEl = document.querySelector('.metadata[data-field="rating"]');
  const isbnEl = document.querySelector('.metadata[data-field="isbn"]');
  const dateAddedEl = document.querySelector('.metadata[data-field="date-added"]');
  const stampEl = document.getElementById('completion-stamp');
  const stampDateEl = document.getElementById('stamp-date');
  const statusDropdown = document.getElementById('status-dropdown');
  const stars = document.querySelectorAll('.star');

  // Values
  const title = getField(book, 'title') || 'Unknown Title';
  const author = getField(book, 'author') || 'Unknown Author';
  const cat = getField(book, 'category') || 'N/A';
  const rating = getField(book, 'rating');
  const isbn = getField(book, 'isbn') || 'N/A';
  const status = Number(getField(book, 'status'));
  const dateAddedRaw = getField(book, 'date_added');
  const readDateRaw = getField(book, 'read_date');

  // Populate Text
  if(titleEl) titleEl.textContent = title;
  if(authorEl) authorEl.textContent = author;
  if(catEl) catEl.textContent = cat;
  if(ratingEl) ratingEl.textContent = `Rating: ${rating ? rating + ' Stars' : 'No rating'}`;
  if(isbnEl) isbnEl.textContent = `ISBN: ${isbn}`;

  // Date Added formatting
  if (dateAddedRaw) {
    const dateObj = new Date(dateAddedRaw);
    dateAddedEl.textContent = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } else {
    dateAddedEl.textContent = 'Unknown';
  }

  // Stamp logic
  if (status === 2) {
    stampEl.style.display = 'flex';
    if (readDateRaw) {
      const dateObj = new Date(readDateRaw);
      stampDateEl.textContent = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else {
      stampDateEl.textContent = 'Unknown Date';
    }
  } else {
    stampEl.style.display = 'none';
  }
  
  // Status Dropdown sync
  statusDropdown.value = !isNaN(status) ? status.toString() : "0"; 

  // Stars sync
  const numericRating = Number(rating) || 0; 
  stars.forEach(s => {
    if (parseInt(s.getAttribute('data-value')) <= numericRating) s.classList.add('active');
    else s.classList.remove('active');
  });

  // Open the card & trigger history state (Only if it isn't already open!)
  if(sheet) {
    if (!sheet.classList.contains('open')) {
      sheet.classList.add('open');
      window.history.pushState({ detailsOpen: true }, ''); 
    }
  }
  if (topFab) topFab.classList.remove('visible');
}

// Event: Status Dropdown Changes
const statusDropdown = document.getElementById('status-dropdown');
statusDropdown.addEventListener('change', async (event) => {
  const newStatus = parseInt(event.target.value); 
  await updateBookData('status', newStatus);

  const stampEl = document.getElementById('completion-stamp');
  const stampDateEl = document.getElementById('stamp-date');

  if (newStatus === 2) { 
    stampEl.style.display = 'flex'; 
    const today = new Date();
    stampDateEl.textContent = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    await updateBookData('read_date', today.toISOString());
  } else {
    stampEl.style.display = 'none';
    await updateBookData('read_date', null);
  }
  
  // Update local memory and apply filters to redraw instantly
  calculateStats();
  renderHeroSection();
  applyLibraryFilters();
  
  // Auto-close with delay
  setTimeout(() => {
    if (sheet && sheet.classList.contains('open')) {
      window.history.back(); // Triggers popstate to close cleanly
      if (bookshelfContainer && bookshelfContainer.scrollTop > 300 && topFab) topFab.classList.add('visible');
    }
  }, 800); 
});

// Event: Star Rating Clicks
const stars = document.querySelectorAll('.star');
stars.forEach(star => {
  star.addEventListener('click', (event) => {
    const ratingValue = parseInt(event.target.getAttribute('data-value'));
    stars.forEach(s => {
      if (parseInt(s.getAttribute('data-value')) <= ratingValue) s.classList.add('active');
      else s.classList.remove('active');
    });
    updateBookData('rating', ratingValue);
  });
});

// Event: Google Refresh Data Button
const refreshDataBtn = document.getElementById('refresh-data-btn');
if (refreshDataBtn) {
  refreshDataBtn.addEventListener('click', async () => {
    if (!currentOpenBookId) return;
    const book = globalLibraryData.find(b => b.uuid === currentOpenBookId);
    if (!book) return;

    const isbn = getField(book, 'isbn');
    const title = getField(book, 'title') || '';
    const author = getField(book, 'author') || '';

    refreshDataBtn.style.opacity = '0.5';

    try {
      // 1. Fixed Query Logic (Ensuring ISBNs are prefixed properly)
      let query = '';
      const cleanIsbn = String(isbn).replace(/[-\s]/g, '');
      if (cleanIsbn && cleanIsbn !== 'N/A' && cleanIsbn !== 'undefined') {
        query = `isbn:${cleanIsbn}`;
      } else {
        query = `intitle:${title.replace(/ /g, '+')}+inauthor:${author.replace(/ /g, '+')}`;
      }

      const apiKey = 'AIzaSyD8cH6KE9JXatD9t0tyc6QETNMrtJP-Pt4';
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&key=${apiKey}`);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        let updatesMade = false;

        if (volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail) {
          await updateBookData('cover_url', volumeInfo.imageLinks.thumbnail.replace('http:', 'https:'));
          updatesMade = true;
        }
        if (volumeInfo.pageCount) {
          await updateBookData('pages', volumeInfo.pageCount);
          updatesMade = true;
        }
        if (volumeInfo.categories && volumeInfo.categories.length > 0) {
          await updateBookData('category', volumeInfo.categories[0]);
          updatesMade = true;
        }
        
        // 2. Live-Update the UI!
        if (updatesMade) {
          refreshDataBtn.style.color = 'var(--sage-green)';
          
          // Redraw both the Grid AND the Hero Carousel!
          renderHeroSection(); 
          applyLibraryFilters(); 
          
          // Re-populate the open details card with the fresh data
          const updatedBook = globalLibraryData.find(b => b.uuid === currentOpenBookId);
          openDetails(updatedBook); 
        }
      }
    } catch (error) {
      console.error('API Error:', error);
    } finally {
      setTimeout(() => { 
        refreshDataBtn.style.opacity = '1'; 
        refreshDataBtn.style.color = 'var(--terracotta)'; 
      }, 3000);
    }
  });
}

// Swipe-to-Close Gestures
let touchStartY = 0;
let touchCurrentY = 0;
let isSwiping = false;

sheet.addEventListener('touchstart', (e) => {
  const cardContent = document.querySelector('.card-content');
  if (cardContent && cardContent.scrollTop > 0) return; 
  touchStartY = e.touches[0].clientY;
  isSwiping = true;
  sheet.style.transition = 'none'; 
}, { passive: true });

sheet.addEventListener('touchmove', (e) => {
  if (!isSwiping) return;
  touchCurrentY = e.touches[0].clientY;
  const deltaY = touchCurrentY - touchStartY;
  if (deltaY > 0) {
    if (e.cancelable) e.preventDefault(); 
    sheet.style.transform = `translateY(${deltaY}px)`;
  }
}, { passive: false });

sheet.addEventListener('touchend', () => {
  if (!isSwiping) return;
  isSwiping = false;
  const deltaY = touchCurrentY - touchStartY;
  sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'; 

  if (deltaY > 100) {
    window.history.back(); // Triggers popstate
    if (bookshelfContainer && bookshelfContainer.scrollTop > 300 && topFab) topFab.classList.add('visible');
  } 
  sheet.style.transform = ''; 
});

// Explicit handle click closes card
if (sheetHandle) {
  sheetHandle.addEventListener('click', () => {
    window.history.back();
    if (bookshelfContainer && bookshelfContainer.scrollTop > 300 && topFab) topFab.classList.add('visible');
  });
}


// ==========================================
// 5. SEARCH & BARCODE SCANNER LOGIC
// ==========================================

const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const scannerContainer = document.getElementById('scanner-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
let html5QrcodeScanner;

if (startScanBtn) {
  startScanBtn.addEventListener('click', () => {
    scannerContainer.classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 };

    html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        html5QrcodeScanner.stop().then(() => {
          scannerContainer.classList.add('hidden');
          searchInput.value = `${decodedText}`;
          if(searchBtn) searchBtn.click();
        });
      },
      (err) => { /* Ignore constant read errors */ }
    ).catch((err) => {
      console.error("Camera access denied or error:", err);
      alert("Could not access the camera. Please ensure permissions are granted.");
      scannerContainer.classList.add('hidden');
    });
  });
}

if (stopScanBtn) {
  stopScanBtn.addEventListener('click', () => {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().then(() => scannerContainer.classList.add('hidden')).catch(err => console.error(err));
    }
  });
}

async function searchGoogleBooks(query) {
  if (!query) return;

  if(searchResultsContainer) searchResultsContainer.innerHTML = '<p style="text-align:center; color: var(--sage-green); font-family: Courier New;">Searching the archives...</p>';

  try {
    const apiKey = 'AIzaSyD8cH6KE9JXatD9t0tyc6QETNMrtJP-Pt4'; 
    const typeRadio = document.querySelector('input[name="search-type"]:checked');
    const searchType = typeRadio ? typeRadio.value : 'intitle:';
    
    // --- PASTE THIS NEW LOGIC ---
    let finalQuery = '';
    const cleanString = query.trim();
    const numbersOnly = cleanString.replace(/[-\s]/g, '');

    // 1. If the query already starts with "isbn:" (typed manually)
    if (cleanString.toLowerCase().startsWith('isbn:')) {
      finalQuery = encodeURIComponent(cleanString);
    } 
    // 2. If it's purely a 10 or 13 digit number, force the "isbn:" prefix!
    else if (/^\d{10}(\d{3})?$/.test(numbersOnly)) {
      finalQuery = encodeURIComponent(`isbn:${numbersOnly}`);
    } 
    // 3. Otherwise, use the Title or Author radio button
    else {
      finalQuery = `${searchType}${encodeURIComponent(cleanString)}`;
    }
    
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${finalQuery}&maxResults=10&key=${apiKey}`);
    
    const data = await response.json();

    if(searchResultsContainer) searchResultsContainer.innerHTML = ''; 

    if (!data.items || data.items.length === 0) {
      if(searchResultsContainer) searchResultsContainer.innerHTML = '<p style="text-align:center; color: var(--sage-green); font-family: Courier New;">No books found. Try a different search.</p>';
      return;
    }

    data.items.forEach(item => {
      const info = item.volumeInfo;
      const title = info.title || 'Unknown Title';
      const author = info.authors ? info.authors.join(', ') : 'Unknown Author';
      const category = info.categories ? info.categories[0] : 'Uncategorized';
      const thumbnail = info.imageLinks?.thumbnail ? info.imageLinks.thumbnail.replace('http:', 'https:') : 'https://placehold.co/60x90?text=No+Cover';
      const infoLink = info.infoLink || '#';
      
      let isbn = '';
      if (info.industryIdentifiers) {
        const isbnObj = info.industryIdentifiers.find(id => id.type === 'ISBN_13') || info.industryIdentifiers.find(id => id.type === 'ISBN_10');
        if (isbnObj) isbn = isbnObj.identifier;
      }

      const card = document.createElement('div');
      card.className = 'search-result-card';
      
      card.innerHTML = `
        <img src="${thumbnail}" alt="Cover" style="width: 60px; height: 90px; object-fit: cover; border-radius: 2px;">
        <div class="search-result-info">
          <h3>${title}</h3>
          <p>${author}</p>
          <button class="add-book-btn" 
            data-title="${encodeURIComponent(title)}" 
            data-author="${encodeURIComponent(author)}" 
            data-isbn="${encodeURIComponent(isbn)}" 
            data-category="${encodeURIComponent(category)}"
            data-cover="${encodeURIComponent(thumbnail)}">+ Add</button>
          <a href="${infoLink}" target="_blank" class="google-books-link">View on Google Books ↗</a>
        </div>
      `;

      if(searchResultsContainer) searchResultsContainer.appendChild(card);
    });

    // Add Book Listeners
    document.querySelectorAll('.add-book-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.target;
        button.textContent = 'Saving...';
        button.style.backgroundColor = 'var(--terracotta)';
        button.disabled = true;
        
        const schema = globalLibraryData.length > 0 ? Object.keys(globalLibraryData[0]) : [];
        const getKey = (name) => schema.find(k => k.toLowerCase() === name.toLowerCase()) || name;

        const payload = {};
        payload[getKey('uuid')] = crypto.randomUUID();
        payload[getKey('title')] = decodeURIComponent(button.dataset.title);
        payload[getKey('author')] = decodeURIComponent(button.dataset.author);
        payload[getKey('status')] = 0; // Default to Waiting
        payload[getKey('isbn')] = decodeURIComponent(button.dataset.isbn);
        payload[getKey('category')] = decodeURIComponent(button.dataset.category);
        payload[getKey('cover_url')] = decodeURIComponent(button.dataset.cover);

        // Database Insert
        const { data, error } = await supabase.from('books').insert([payload]).select();

        if (error) {
          console.error('Error adding book:', error);
          button.textContent = 'Error!';
        } else {
          button.textContent = 'Saved!';
          button.style.backgroundColor = 'var(--sage-green)';
          
          if (data && data.length > 0) {
            const savedBook = data[0];
            globalLibraryData.push(savedBook);
            
            // Auto-open card and refresh grid
            setTimeout(() => { openDetails(savedBook); }, 600);
            loadBooks(); 
          }
        }
      });
    });
  } catch (error) {
    console.error("Search failed:", error);
    if(searchResultsContainer) searchResultsContainer.innerHTML = '<p style="text-align:center; color: #a34e4e;">Something went wrong. Please try again.</p>';
  }
}

if (searchBtn) searchBtn.addEventListener('click', () => searchGoogleBooks(searchInput.value));
if (searchInput) {
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchGoogleBooks(searchInput.value);
  });
}


// ==========================================
// 6. FOCUS TIMER & AUDIO
// ==========================================

const timerDisplay = document.getElementById('timer-display');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const focusDurationSelect = document.getElementById('focus-duration');
const focusCloseBtn = document.getElementById('focus-close-btn');

let focusInterval;
let timeRemaining = 1200; // Default 20 mins
let isTimerRunning = false;
let audioCtx; 

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  if(timerDisplay) timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

if(playPauseBtn) {
  playPauseBtn.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (isTimerRunning) {
      clearInterval(focusInterval);
      isTimerRunning = false;
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      timerDisplay.style.color = "var(--text-dark)";
    } else {
      if (timeRemaining <= 0) timeRemaining = parseInt(focusDurationSelect.value);
      isTimerRunning = true;
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      timerDisplay.style.color = "var(--sage-green)"; 
      
      focusInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
          clearInterval(focusInterval);
          isTimerRunning = false;
          playIcon.style.display = 'block';
          pauseIcon.style.display = 'none';
          timerDisplay.style.color = "var(--text-dark)";
          playCozyChime(); 
        }
      }, 1000);
    }
  });
}

if (focusDurationSelect) {
  focusDurationSelect.addEventListener('change', () => {
    clearInterval(focusInterval);
    isTimerRunning = false;
    if(playIcon) playIcon.style.display = 'block';
    if(pauseIcon) pauseIcon.style.display = 'none';
    if(timerDisplay) timerDisplay.style.color = "var(--text-dark)";
    
    timeRemaining = parseInt(focusDurationSelect.value);
    updateTimerDisplay();
  });
}

function playCozyChime() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime); 
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 3); 
  osc.start();
  osc.stop(audioCtx.currentTime + 3);
}

if (focusCloseBtn) {
  focusCloseBtn.addEventListener('click', () => {
    const prevNavBtn = document.querySelector(`.nav-item[data-target="${previousViewId}"]`);
    if (prevNavBtn) prevNavBtn.click();
  });
}


// ==========================================
// 7. NAVIGATION & SYSTEM
// ==========================================

const navItems = document.querySelectorAll('.nav-item');
const pageViews = document.querySelectorAll('.page-view');
let previousViewId = 'view-library'; 

// --- BATCH 8: HEADER & FEEDBACK LOGIC ---

// 1. Header Scroll-to-Top
const headerScrollTrigger = document.getElementById('header-scroll-trigger');
if (headerScrollTrigger) {
  headerScrollTrigger.addEventListener('click', () => {
    const activeView = document.querySelector('.page-view.active');
    if (activeView) activeView.scrollTo({ top: 0, behavior: 'smooth' });
    if (bookshelfContainer) bookshelfContainer.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// 2. Feedback Modal Logic
const feedbackTriggerBtn = document.getElementById('feedback-trigger-btn');
const feedbackModal = document.getElementById('feedback-modal');
const closeFeedbackBtn = document.getElementById('close-feedback-btn');
const submitFeedbackBtn = document.getElementById('submit-feedback-btn');
const feedbackText = document.getElementById('feedback-text');

if (feedbackTriggerBtn && feedbackModal) {
  feedbackTriggerBtn.addEventListener('click', () => {
    feedbackModal.classList.remove('hidden');
    feedbackText.focus();
  });

  closeFeedbackBtn.addEventListener('click', () => {
    feedbackModal.classList.add('hidden');
    feedbackText.value = ''; // Clear text
  });

  submitFeedbackBtn.addEventListener('click', async () => {
    const text = feedbackText.value.trim();
    if (!text) return;

    // UI Feedback
    const originalText = submitFeedbackBtn.textContent;
    submitFeedbackBtn.textContent = 'Sending...';
    submitFeedbackBtn.disabled = true;

    // Send to Supabase 'feedback' table
    const { error } = await supabase
      .from('feedback')
      .insert([{ message: text }]);

    if (error) {
      console.error('Error sending feedback:', error);
      submitFeedbackBtn.textContent = 'Error!';
      submitFeedbackBtn.style.backgroundColor = 'red';
    } else {
      submitFeedbackBtn.textContent = 'Sent!';
      submitFeedbackBtn.style.backgroundColor = 'var(--sage-green)';
      
      // Close modal after success
      setTimeout(() => {
        feedbackModal.classList.add('hidden');
        feedbackText.value = '';
        submitFeedbackBtn.textContent = originalText;
        submitFeedbackBtn.style.backgroundColor = 'var(--terracotta)';
        submitFeedbackBtn.disabled = false;
      }, 1500);
    }
  });
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetId = item.getAttribute('data-target');
    window.history.pushState({ view: targetId }, '');
    
    const currentActive = document.querySelector('.page-view.active');
    if (currentActive && currentActive.id !== 'view-focus' && targetId === 'view-focus') {
      previousViewId = currentActive.id;
    }

    navItems.forEach(btn => btn.classList.remove('active'));
    item.classList.add('active');

    pageViews.forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(targetId);
    if(targetView) targetView.classList.add('active');

    if (bookshelfContainer) bookshelfContainer.scrollTo({ top: 0, behavior: 'instant' });
    if (topFab) topFab.classList.remove('visible');
    if (sheet && sheet.classList.contains('open')) sheet.classList.remove('open');
  });
});

if (topFab && bookshelfContainer) {
  bookshelfContainer.addEventListener('scroll', () => {
    if (bookshelfContainer.scrollTop > 300) topFab.classList.add('visible');
    else topFab.classList.remove('visible');
  });

  topFab.addEventListener('click', () => {
    bookshelfContainer.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// History API for Native Back Swipe
window.addEventListener('popstate', (event) => {
  if (sheet && sheet.classList.contains('open')) {
    sheet.classList.remove('open');
    if (bookshelfContainer && bookshelfContainer.scrollTop > 300 && topFab) topFab.classList.add('visible');
    return; 
  }
  
  if (event.state && event.state.view) {
    const navBtn = document.querySelector(`.nav-item[data-target="${event.state.view}"]`);
    if (navBtn) {
      navItems.forEach(btn => btn.classList.remove('active'));
      navBtn.classList.add('active');
      pageViews.forEach(view => view.classList.remove('active'));
      document.getElementById(event.state.view).classList.add('active');
    }
  }
});


// ==========================================
// 8. INITIALIZE APP
// ==========================================
loadBooks();

// ==========================================
// 9. PHASE 1: WANDER DRAWER LOGIC
// ==========================================

const wanderTriggerBtn = document.getElementById('wander-trigger-btn');
const wanderSheet = document.getElementById('wander-sheet');
const statusFilterSelect = document.getElementById('filter-status');
const sortLibrarySelect = document.getElementById('sort-library');
const applyWanderBtn = document.getElementById('apply-wander-btn');
const clearWanderBtn = document.getElementById('clear-wander-btn');
const localSearchInput = document.getElementById('local-search');
const clearSearchBtn = document.getElementById('clear-search-btn');

if (wanderTriggerBtn && wanderSheet) {
  wanderTriggerBtn.addEventListener('click', () => wanderSheet.classList.add('open'));

  const wanderHandle = wanderSheet.querySelector('.sheet-handle');
  if (wanderHandle) wanderHandle.addEventListener('click', () => wanderSheet.classList.remove('open'));
  if (sheetHandle) sheetHandle.addEventListener('click', () => wanderSheet.classList.remove('open'));

  // Quick Filters Logic
  const quickBtns = wanderSheet.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (statusFilterSelect) statusFilterSelect.value = e.target.getAttribute('data-status');
      if (sortLibrarySelect) sortLibrarySelect.value = e.target.getAttribute('data-sort');

      quickBtns.forEach(b => {
        b.style.background = 'var(--bg-color)';
        b.style.color = 'var(--sage-green)';
      });
      e.target.style.background = 'var(--sage-green)';
      e.target.style.color = '#fff';
    });
  });

  // Inline Search Clear Button Logic
  if (localSearchInput && clearSearchBtn) {
    localSearchInput.addEventListener('input', () => {
      clearSearchBtn.style.display = localSearchInput.value.length > 0 ? 'block' : 'none';
    });

    clearSearchBtn.addEventListener('click', () => {
      localSearchInput.value = '';
      clearSearchBtn.style.display = 'none';
    });
  }

  // "Wander" (Apply) Logic
  if (applyWanderBtn) {
    applyWanderBtn.addEventListener('click', () => {
      applyLibraryFilters(); 
      updateLibrarySubheading(); // Updates the text under "Your Stacks"
      wanderSheet.classList.remove('open');
      if (bookshelfContainer) bookshelfContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // "Clear" Defaults Logic
  if (clearWanderBtn) {
    clearWanderBtn.addEventListener('click', () => {
      // 1. Reset inputs
      if (localSearchInput) {
        localSearchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      }
      if (statusFilterSelect) statusFilterSelect.value = 'all';
      if (sortLibrarySelect) sortLibrarySelect.value = 'title_asc';
      
      // 2. Remove green highlights from quick buttons
      quickBtns.forEach(b => {
        b.style.background = 'var(--bg-color)';
        b.style.color = 'var(--sage-green)';
      });

      // 3. Execute and stay open
      applyLibraryFilters();
      updateLibrarySubheading();
      if (bookshelfContainer) bookshelfContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
