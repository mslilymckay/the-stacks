import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://jvsjzlvabtffhsnvmcto.supabase.co';
const supabaseKey = 'sb_publishable_H2EPwvAaziQVz8T4yExdEw_bQrB5f3V';
const supabase = createClient(supabaseUrl, supabaseKey);

let globalLibraryData = [];
let currentOpenBookId = null;

const bookGrid = document.getElementById('book-grid');
const sheet = document.querySelector('.bottom-sheet');
const sheetHandle = document.querySelector('.sheet-handle');
const topFab = document.getElementById('top-fab'); 
const bookshelfContainer = document.querySelector('.bookshelf');
const statusDropdown = document.getElementById('status-dropdown');
const stars = document.querySelectorAll('.star');

// 2. Function to update Supabase AND local memory
async function updateBookData(columnName, newValue) {
  if (!currentOpenBookId) return; // Don't do anything if no book is open

  // Tell Supabase to update the specific column for the current book
  const { data, error } = await supabase
    .from('books')
    .update({ [columnName]: newValue })
    .eq('uuid', currentOpenBookId);

  if (error) {
    console.error('Error updating book:', error);
  } else {
    console.log(`Successfully updated ${columnName} to ${newValue}`);
    
    // --- THE FIX: Update local memory ---
    // Find the current book in our global array
    const bookToUpdate = globalLibraryData.find(b => b.uuid === currentOpenBookId);
    
    if (bookToUpdate) {
      // Find the exact key case used in the local object (e.g., 'Status' vs 'status')
      const key = Object.keys(bookToUpdate).find(k => k.toLowerCase() === columnName.toLowerCase()) || columnName;
      // Update the value in local memory
      bookToUpdate[key] = newValue;
    }
  }
}

// 3. Status Dropdown Listener (Now with async/await!)
statusDropdown.addEventListener('change', async (event) => {
  const newStatus = parseInt(event.target.value); 
  
  // PAUSE HERE: Wait for the status to save to Supabase and local memory
  await updateBookData('status', newStatus);

  // --- UX FIX: Handle the Finished Stamp ---
  const stampEl = document.getElementById('completion-stamp');
  const stampDateEl = document.getElementById('stamp-date');

  if (newStatus === 2) { // 2 = Finished
    stampEl.style.display = 'flex'; 
    
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    stampDateEl.textContent = formattedDate;

    // PAUSE HERE: Wait for the read_date to save
    await updateBookData('read_date', today.toISOString());
    
  } else {
    stampEl.style.display = 'none';
    
    // PAUSE HERE: Wait for the read_date to clear
    await updateBookData('read_date', null);
  }
  loadBooks();
});

// --- BATCH 6: REFRESH DATA & MANUAL COVERS ---

const refreshDataBtn = document.getElementById('refresh-data-btn');
const saveCoverBtn = document.getElementById('save-cover-btn');

// 1. Refresh Data from Google Books
refreshDataBtn.addEventListener('click', async () => {
  if (!currentOpenBookId) return;
  
  const book = globalLibraryData.find(b => b.uuid === currentOpenBookId);
  if (!book) return;

  const isbn = getField(book, 'isbn');
  const title = getField(book, 'title');
  const author = getField(book, 'author');

  // UI Feedback: Dim the icon while loading
  refreshDataBtn.style.opacity = '0.5';

  try {
    let query = '';
    if (isbn && isbn !== 'N/A') {
      query = `isbn:${isbn}`;
    } else {
      query = `intitle:${title.replace(/ /g, '+')}+inauthor:${author.replace(/ /g, '+')}`;
    }

    // FIX: Added your API key to bypass the 429 Rate Limit
    const apiKey = 'AIzaSyD8cH6KE9JXatD9t0tyc6QETNMrtJP-Pt4';
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&key=${apiKey}`);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      let updatesMade = false;

      if (volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail) {
        const secureUrl = volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
        await updateBookData('cover_url', secureUrl);
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

      if (updatesMade) {
        // UI Feedback: Turn terracotta on success
        refreshDataBtn.style.color = 'var(--sage-green)';
        loadBooks(); // Uncomment this to redraw the UI!
      }
    }
  } catch (error) {
    console.error('API Error:', error);
  } finally {
    // Reset the button visual state after 3 seconds
    setTimeout(() => { 
      refreshDataBtn.style.opacity = '1'; 
      refreshDataBtn.style.color = 'var(--terracotta)'; // Reset to default
    }, 3000);
  }
});

// Star Rating Logic
stars.forEach(star => {
  star.addEventListener('click', (event) => {
    // Get the value of the clicked star (1 through 5)
    const ratingValue = parseInt(event.target.getAttribute('data-value'));
    
    // Update the UI: Loop through all stars and color them in up to the clicked value
    stars.forEach(s => {
      const starValue = parseInt(s.getAttribute('data-value'));
      if (starValue <= ratingValue) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    // Send the new rating to Supabase
    updateBookData('rating', ratingValue);
  });
});

// Closes the bottom sheet and brings the FAB back if you are scrolled down
if (sheetHandle) {
  sheetHandle.addEventListener('click', () => {
    sheet.classList.remove('open');
    if (bookshelfContainer && bookshelfContainer.scrollTop > 300 && topFab) {
      topFab.classList.add('visible');
    }
  });
}

// --- BATCH 6: SWIPE-TO-CLOSE GESTURE ---
let touchStartY = 0;
let touchCurrentY = 0;
let isSwiping = false;

// Listen for the start of a touch anywhere on the bottom sheet
sheet.addEventListener('touchstart', (e) => {
  const cardContent = document.querySelector('.card-content');
  
  // If the user has scrolled down to read a long description, don't trigger the swipe!
  // Only trigger if they are at the very top of the card.
  if (cardContent && cardContent.scrollTop > 0) return; 

  touchStartY = e.touches[0].clientY;
  isSwiping = true;
  
  // Remove the smooth CSS transition temporarily so the card sticks perfectly to her finger
  sheet.style.transition = 'none'; 
}, { passive: true });

// Listen for the finger dragging
sheet.addEventListener('touchmove', (e) => {
  if (!isSwiping) return;
  
  touchCurrentY = e.touches[0].clientY;
  const deltaY = touchCurrentY - touchStartY;

  // Only move the sheet if she is swiping DOWN (deltaY is positive)
  if (deltaY > 0) {
    // Prevent the background from scrolling while we drag the card
    if (e.cancelable) e.preventDefault(); 
    sheet.style.transform = `translateY(${deltaY}px)`;
  }
}, { passive: false });

// Listen for the finger letting go
sheet.addEventListener('touchend', () => {
  if (!isSwiping) return;
  isSwiping = false;
  
  const deltaY = touchCurrentY - touchStartY;
  
  // Restore the smooth CSS transition so it animates beautifully
  sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'; 

  // If she swiped down more than 100 pixels, dismiss the card!
  if (deltaY > 100) {
    sheet.classList.remove('open');
    
    // Bring the floating action button (FAB) back if she is scrolled down the page
    if (bookshelfContainer && bookshelfContainer.scrollTop > 300 && topFab) {
      topFab.classList.add('visible');
    }
  } 
  
  // Clear the inline transform so your default CSS takes over again
  // (This either snaps it back to the top, or allows the 'open' class removal to slide it off screen)
  sheet.style.transform = ''; 
});

// --- BATCH 7: FOCUS TIMER & AUDIO ---
const timerDisplay = document.getElementById('timer-display');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const focusDurationSelect = document.getElementById('focus-duration');
const focusCloseBtn = document.getElementById('focus-close-btn');

let focusInterval;
let timeRemaining = 1200; // Default to 20 minutes (1200 seconds)
let isTimerRunning = false;
let audioCtx; 

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 1. Play/Pause Toggle
playPauseBtn.addEventListener('click', () => {
  // Initialize audio context on first interaction to satisfy browser security
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (isTimerRunning) {
    // PAUSE the timer
    clearInterval(focusInterval);
    isTimerRunning = false;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    timerDisplay.style.color = "var(--text-dark)";
  } else {
    // START or RESUME the timer
    // If it hit 0 previously, reset to the current dropdown value before starting
    if (timeRemaining <= 0) {
      timeRemaining = parseInt(focusDurationSelect.value);
    }
    
    isTimerRunning = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    timerDisplay.style.color = "var(--terracotta)"; // Active color
    
    focusInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();
      
      if (timeRemaining <= 0) {
        // TIMER FINISHED
        clearInterval(focusInterval);
        isTimerRunning = false;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        timerDisplay.style.color = "var(--text-dark)";
        playCozyChime(); // Ring the alarm!
      }
    }, 1000);
  }
});

// 2. Native Select Change Listener
focusDurationSelect.addEventListener('change', () => {
  // If the user selects a new time, stop the clock and reset it
  clearInterval(focusInterval);
  isTimerRunning = false;
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
  timerDisplay.style.color = "var(--text-dark)";
  
  // Pull the new time (in seconds) directly from the option value
  timeRemaining = parseInt(focusDurationSelect.value);
  updateTimerDisplay();
});

// 3. The Alarm Sound Generator
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

// 4. The Close "X" Button
focusCloseBtn.addEventListener('click', () => {
  const prevNavBtn = document.querySelector(`.nav-item[data-target="${previousViewId}"]`);
  if (prevNavBtn) prevNavBtn.click();
});

// 5. The Close "X" Button
focusCloseBtn.addEventListener('click', () => {
  // Find the nav button for whatever page they were on previously, and click it!
  const prevNavBtn = document.querySelector(`.nav-item[data-target="${previousViewId}"]`);
  if (prevNavBtn) prevNavBtn.click();
});

// A highly resilient helper to find data regardless of database capitalization
const getField = (obj, fieldName) => {
  if (!obj) return undefined;
  const key = Object.keys(obj).find(k => k.toLowerCase() === fieldName.toLowerCase());
  return key ? obj[key] : undefined;
};

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${m}-${d}-${y}`;
}

function openDetails(book, clickedElement) {
  if (clickedElement) {
    clickedElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  currentOpenBookId = book.uuid;
  const titleEl = document.querySelector('.book-title');
  const authorEl = document.querySelector('.book-author');
  const catEl = document.querySelector('.metadata[data-field="category"]');
  const ratingEl = document.querySelector('.metadata[data-field="rating"]');
  const isbnEl = document.querySelector('.metadata[data-field="isbn"]');
  const dateAddedEl = document.querySelector('.metadata[data-field="date-added"]');
  const stampEl = document.getElementById('completion-stamp');
  const stampDateEl = document.getElementById('stamp-date');
  const title = getField(book, 'title') || 'Unknown Title';
  const author = getField(book, 'author') || 'Unknown Author';
  const cat = getField(book, 'category') || 'N/A';
  const rating = getField(book, 'rating');
  const isbn = getField(book, 'isbn') || 'N/A';
  const readDate = getField(book, 'read_date');
  const status = Number(getField(book, 'status'));
  const dateAddedRaw = getField(book, 'date_added');
  const coverUrlRaw = getField(book, 'cover_url') || '';

  // --- BATCH 6: DISPLAY DATE ADDED ---
  if (dateAddedRaw) {
    // Converts the database timestamp into a cozy, readable format like "Oct 12, 2026"
    const dateObj = new Date(dateAddedRaw);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    dateAddedEl.textContent = formattedDate;
  } else {
    dateAddedEl.textContent = 'Unknown';
  }

  // --- UX FIX: Show/Hide Stamp on Load ---
  const readDateRaw = getField(book, 'read_date');

  if (status === 2) {
    stampEl.style.display = 'flex';
    
    if (readDateRaw) {
      // If there is a date in the DB, format and display it
      const dateObj = new Date(readDateRaw);
      stampDateEl.textContent = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      stampDateEl.textContent = 'Unknown Date';
    }
  } else {
    // Ensure the stamp is hidden for Waiting, Reading, or Gave Up
    stampEl.style.display = 'none';
  }
  
  // --- BATCH 6: POPULATE UI WITH CURRENT BOOK DATA ---
  
  // 1. Sync the Dropdown
  const statusDropdown = document.getElementById('status-dropdown');
  // Check if status is a valid number, otherwise default to "0" (Waiting)
  if (!isNaN(status)) {
    statusDropdown.value = status.toString();
  } else {
    statusDropdown.value = "0"; 
  }

  // 2. Sync the Stars
  const stars = document.querySelectorAll('.star');
  // Ensure rating is a number, default to 0 if not rated
  const numericRating = Number(rating) || 0; 
  
  stars.forEach(s => {
    const starValue = parseInt(s.getAttribute('data-value'));
    // If the star's value is less than or equal to the book's rating, color it in
    if (starValue <= numericRating) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });

  if(titleEl) titleEl.textContent = title;
  if(authorEl) authorEl.textContent = author;
  if(catEl) catEl.textContent = cat;
  if(ratingEl) ratingEl.textContent = `Rating: ${rating ? rating + ' Stars' : 'No rating'}`;
  if(isbnEl) isbnEl.textContent = `ISBN: ${isbn}`;

  if (status === 1 && readDate) {
    if(stampDateEl) stampDateEl.textContent = formatDate(readDate);
    if(stampEl) stampEl.classList.add('visible');
  } else {
    if(stampEl) stampEl.classList.remove('visible');
  }

  if(sheet) sheet.classList.add('open');
  
  // Cleanly hide the FAB when the details card is open
  if (topFab) topFab.classList.remove('visible');
}

function getCoverUrl(isbn) {
  if (!isbn) return 'https://placehold.co/150x200?text=No+Cover';
  const cleanIsbn = String(isbn).replace(/[-\s]/g, '');
  return `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg?default=false`;
}

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

const timeFilterEl = document.getElementById('stats-timefilter');
if (timeFilterEl) {
  timeFilterEl.addEventListener('change', calculateStats);
}

async function loadBooks() {
  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .order('title', { ascending: true });

  if (error) { console.error(error); return; }
  
  globalLibraryData = books; 
  calculateStats(); 
  
  if(bookGrid) bookGrid.innerHTML = '';

  const activeBook = books.find(b => Number(getField(b, 'status')) === 1) || 
                     books.find(b => Number(getField(b, 'status')) === 0) || 
                     books[0];  
  if (activeBook) {
    const savedCover = getField(activeBook, 'cover_url');
    const activeCoverUrl = (savedCover && savedCover !== 'https://placehold.co/60x90?text=No+Cover') 
      ? savedCover 
      : getCoverUrl(getField(activeBook, 'isbn'));
      
    const activeDiv = document.querySelector('.active-read');
    const title = getField(activeBook, 'title') || 'Unknown Title';
    const author = getField(activeBook, 'author') || 'Unknown Author';

    if (activeDiv) {
      activeDiv.innerHTML = `
        <img src="${activeCoverUrl}" alt="${title}" class="cover-image" onerror="this.src='https://placehold.co/150x200?text=No+Cover'">
        <h3 class="cover-title">${title}</h3>
        <p class="cover-author">${author}</p>
      `;
      activeDiv.addEventListener('click', () => openDetails(activeBook, activeDiv));
    }
  }

  for (const book of books) {
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
    if(bookGrid) bookGrid.appendChild(bookDiv);
  }

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

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResultsContainer = document.getElementById('search-results-container');

async function searchGoogleBooks(query) {
  if (!query) return;

  if(searchResultsContainer) searchResultsContainer.innerHTML = '<p style="text-align:center; color: var(--sage-green); font-family: Courier New;">Searching the archives...</p>';

  try {
    const apiKey = 'AIzaSyD8cH6KE9JXatD9t0tyc6QETNMrtJP-Pt4'; 
    const typeRadio = document.querySelector('input[name="search-type"]:checked');
    const searchType = typeRadio ? typeRadio.value : 'intitle:';
    
    const cleanQuery = query.replace(/[-\s]/g, '');
    const isIsbn = /^\d{10}(\d{3})?$/.test(cleanQuery);
    
    let finalQuery = '';
    if (isIsbn) {
      finalQuery = `isbn:${encodeURIComponent(cleanQuery)}`;
    } else {
      finalQuery = `${searchType}${encodeURIComponent(query)}`;
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
      
      let isbn = '';
      if (info.industryIdentifiers) {
        const isbnObj = info.industryIdentifiers.find(id => id.type === 'ISBN_13') || 
                        info.industryIdentifiers.find(id => id.type === 'ISBN_10');
        if (isbnObj) isbn = isbnObj.identifier;
      }

      const card = document.createElement('div');
      card.className = 'search-result-card';
      
      // We encode every single piece of data to prevent special characters from breaking the HTML
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
        </div>
      `;

      if(searchResultsContainer) searchResultsContainer.appendChild(card);
    });

    document.querySelectorAll('.add-book-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.target;
        
        button.textContent = 'Saving...';
        button.style.backgroundColor = 'var(--terracotta)';
        button.disabled = true;
        
        // This dynamically maps our payload to your exact database capitalization
        const schema = globalLibraryData.length > 0 ? Object.keys(globalLibraryData[0]) : [];
        const getKey = (name) => schema.find(k => k.toLowerCase() === name.toLowerCase()) || name;

        const payload = {};
        payload[getKey('uuid')] = crypto.randomUUID();
        payload[getKey('title')] = decodeURIComponent(button.dataset.title);
        payload[getKey('author')] = decodeURIComponent(button.dataset.author);
        payload[getKey('status')] = 0;
        payload[getKey('isbn')] = decodeURIComponent(button.dataset.isbn);
        payload[getKey('category')] = decodeURIComponent(button.dataset.category);
        payload[getKey('cover_url')] = decodeURIComponent(button.dataset.cover);

        const { error } = await supabase.from('books').insert([payload]);

        if (error) {
          console.error("Database save failed:", error);
          button.textContent = 'Error';
          button.style.backgroundColor = '#a34e4e'; 
          button.disabled = false; 
        } else {
          button.textContent = 'Saved!';
          loadBooks(); 
        }
      });
    });

  } catch (error) {
    console.error("Search failed:", error);
    if(searchResultsContainer) searchResultsContainer.innerHTML = '<p style="text-align:center; color: #a34e4e;">Something went wrong. Please try again.</p>';
  }
}

if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    searchGoogleBooks(searchInput.value);
  });
}

if (searchInput) {
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchGoogleBooks(searchInput.value);
    }
  });
}

const readerToggle = document.getElementById('reader-toggle');
if (readerToggle) {
  readerToggle.addEventListener('click', () => {
    readerToggle.classList.toggle('fullscreen-focus');
  });
}

const navItems = document.querySelectorAll('.nav-item');
const pageViews = document.querySelectorAll('.page-view');

let previousViewId = 'view-library'; // Tracks history for the Focus close button

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetId = item.getAttribute('data-target');
    
    // Save previous view (unless they are currently on Focus)
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
    if (bookshelfContainer.scrollTop > 300) {
      topFab.classList.add('visible');
    } else {
      topFab.classList.remove('visible');
    }
  });

  topFab.addEventListener('click', () => {
    bookshelfContainer.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

loadBooks();
