import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://jvsjzlvabtffhsnvmcto.supabase.co';
const supabaseKey = 'sb_publishable_H2EPwvAaziQVz8T4yExdEw_bQrB5f3V';
const supabase = createClient(supabaseUrl, supabaseKey);

let globalLibraryData = []; 

const bookGrid = document.getElementById('book-grid');
const sheet = document.querySelector('.bottom-sheet');
const sheetHandle = document.querySelector('.sheet-handle');

if (sheetHandle) {
  sheetHandle.addEventListener('click', () => {
    sheet.classList.remove('open');
  });
}

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

  const titleEl = document.querySelector('.book-title');
  const authorEl = document.querySelector('.book-author');
  const catEl = document.querySelector('.metadata[data-field="category"]');
  const ratingEl = document.querySelector('.metadata[data-field="rating"]');
  const isbnEl = document.querySelector('.metadata[data-field="isbn"]');
  const stampEl = document.getElementById('completion-stamp');
  const stampDateEl = document.getElementById('stamp-date');

  // Resilient checks for capitalization
  const cat = book.category || book.Category || 'N/A';
  const rating = book.rating || book.Rating;
  const readDate = book.read_date || book.Read_Date || book.Read_date;
  const status = Number(book.status !== undefined ? book.status : book.Status);

  if(titleEl) titleEl.textContent = book.title;
  if(authorEl) authorEl.textContent = book.author;
  if(catEl) catEl.textContent = `Category: ${cat}`;
  if(ratingEl) ratingEl.textContent = `Rating: ${rating ? rating + ' Stars' : 'No rating'}`;
  if(isbnEl) isbnEl.textContent = `ISBN: ${book.isbn || 'N/A'}`;

  if (status === 1 && readDate) {
    if(stampDateEl) stampDateEl.textContent = formatDate(readDate);
    if(stampEl) stampEl.classList.add('visible');
  } else {
    if(stampEl) stampEl.classList.remove('visible');
  }

  if(sheet) sheet.classList.add('open');
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

  // Resilient Helpers
  const getStatus = (b) => Number(b.status !== undefined ? b.status : b.Status);
  const getReadDate = (b) => b.read_date || b.Read_Date || b.Read_date;
  const getCategory = (b) => b.category || b.Category;

  // 1. Calculate active reads (Loose equality ensures string "0" matches number 0)
  const activeCount = books.filter(b => getStatus(b) === 0).length;
  
  // 2. Calculate finished books
  let periodCount = 0;
  const completedBooks = books.filter(b => getStatus(b) === 1 && getReadDate(b));
  
  completedBooks.forEach(b => {
    const readDate = new Date(getReadDate(b));
    if (filter === 'all') {
      periodCount++;
    } else if (filter === 'year' && readDate.getFullYear() === currentYear) {
      periodCount++;
    } else if (filter === 'month' && readDate.getFullYear() === currentYear && readDate.getMonth() === currentMonth) {
      periodCount++;
    }
  });

  // 3. Count categories
  const categoryCounts = {};
  books.forEach(b => {
    const cat = getCategory(b);
    if (cat && cat !== 'Uncategorized' && cat !== 'N/A') {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  const sortedCategories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);
  const topCategories = sortedCategories.slice(0, 3); 

  // 4. Update DOM
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
  
  // DIAGNOSTIC LOG: Check your Chrome console to see exact column capitalization!
  console.log("DB SCHEMA CHECK (Look at the keys here):", books[0]);

  globalLibraryData = books; 
  calculateStats(); 
  
  if(bookGrid) bookGrid.innerHTML = '';

  const getStatus = (b) => Number(b.status !== undefined ? b.status : b.Status);
  const activeBook = books.find(b => getStatus(b) === 0) || books.find(b => getStatus(b) !== 1) || books[0];
  
  if (activeBook) {
    const activeCoverUrl = getCoverUrl(activeBook.isbn);
    const activeDiv = document.querySelector('.active-read');
    if (activeDiv) {
      activeDiv.innerHTML = `
        <img src="${activeCoverUrl}" alt="${activeBook.title}" class="cover-image" onerror="this.src='https://placehold.co/150x200?text=No+Cover'">
        <h3 class="cover-title">${activeBook.title}</h3>
        <p class="cover-author">${activeBook.author}</p>
      `;
      activeDiv.addEventListener('click', () => openDetails(activeBook, activeDiv));
    }
  }

  for (const book of books) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-cover';
    
    bookDiv.innerHTML = `
      <img src="https://placehold.co/150x200?text=Loading..." data-isbn="${book.isbn}" alt="${book.title}" class="cover-image lazy-cover">
      <h3 class="cover-title">${book.title}</h3>
      <p class="cover-author">${book.author}</p>
    `;
    
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
    const apiKey = 'AIzaSyD8cH6KE9JXatD9t0tyc6QETNMrtJP-Pt4'; // <--- PASTE YOUR KEY HERE
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
      card.innerHTML = `
        <img src="${thumbnail}" alt="Cover" style="width: 60px; height: 90px; object-fit: cover; border-radius: 2px;">
        <div class="search-result-info">
          <h3>${title}</h3>
          <p>${author}</p>
          <button class="add-book-btn" data-title="${encodeURIComponent(title)}" data-author="${encodeURIComponent(author)}" data-isbn="${isbn}" data-category="${encodeURIComponent(category)}">+ Add</button>
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
        
        // --------------------------------------------------------------------------
        // IMPORTANT MANUAL FIX: If your Console Schema Check showed that 
        // your column is capitalized (e.g., "Category"), you MUST change the 
        // word "category" below to "Category" so Supabase accepts it!
        // --------------------------------------------------------------------------
        const { error } = await supabase
          .from('books')
          .insert([
            {
              uuid: crypto.randomUUID(), 
              title: decodeURIComponent(button.dataset.title),
              author: decodeURIComponent(button.dataset.author),
              isbn: button.dataset.isbn,
              category: decodeURIComponent(button.dataset.category), // <-- Check capitalization here!
              status: 0 
            }
          ]);

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
const topFab = document.getElementById('top-fab');
const bookshelfContainer = document.querySelector('.bookshelf'); 

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(btn => btn.classList.remove('active'));
    item.classList.add('active');

    const targetId = item.getAttribute('data-target');
    pageViews.forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(targetId);
    if(targetView) targetView.classList.add('active');

    if (bookshelfContainer) {
      bookshelfContainer.scrollTo({ top: 0, behavior: 'instant' });
    }
    
    if (topFab) {
      topFab.classList.remove('visible');
    }
    
    if (sheet && sheet.classList.contains('open')) {
      sheet.classList.remove('open');
    }
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
