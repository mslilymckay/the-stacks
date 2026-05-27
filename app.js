import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://jvsjzlvabtffhsnvmcto.supabase.co';
const supabaseKey = 'sb_publishable_H2EPwvAaziQVz8T4yExdEw_bQrB5f3V';
const supabase = createClient(supabaseUrl, supabaseKey);

const bookGrid = document.getElementById('book-grid');
const sheet = document.querySelector('.bottom-sheet');
const sheetHandle = document.querySelector('.sheet-handle');

sheetHandle.addEventListener('click', () => {
  sheet.classList.remove('open');
});

// Helper to format the date to MM-DD-YY
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${m}-${d}-${y}`;
}

// Updated to accept clickedElement for smooth scrolling
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

  titleEl.textContent = book.title;
  authorEl.textContent = book.author;
  catEl.textContent = `Category: ${book.category || 'N/A'}`;
  ratingEl.textContent = `Rating: ${book.rating ? book.rating + ' Stars' : 'No rating'}`;
  isbnEl.textContent = `ISBN: ${book.isbn || 'N/A'}`;

  // Logic for the Vintage Stamp
  if (book.status === 1 && book.read_date) {
    stampDateEl.textContent = formatDate(book.read_date);
    stampEl.classList.add('visible');
  } else {
    stampEl.classList.remove('visible');
  }

  sheet.classList.add('open');
}

function getCoverUrl(isbn) {
  // If there is no ISBN, return the placeholder
  if (!isbn) return 'https://placehold.co/150x200?text=No+Cover';

  // Remove dashes and spaces from the ISBN
  const cleanIsbn = String(isbn).replace(/[-\s]/g, '');

  // Add '?default=false' to force a 404 error if the cover is missing
  return `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg?default=false`;
}

async function loadBooks() {
  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .order('title', { ascending: true });

  if (error) { console.error(error); return; }
  bookGrid.innerHTML = '';

  // 1. Hero Book (With a fallback to the first book if none are active)
  const activeBook = books.find(b => b.status === 0) || books.find(b => b.status !== 1) || books[0];
  if (activeBook) {
    const activeCoverUrl = getCoverUrl(activeBook.isbn); // Note: Removed 'await' since getCoverUrl is now synchronous!
    const activeDiv = document.querySelector('.active-read');
    if (activeDiv) {
      // Inject the image, title, and author to match the library cards exactly
      activeDiv.innerHTML = `
        <img src="${activeCoverUrl}" alt="${activeBook.title}" class="cover-image">
        <h3 class="cover-title">${activeBook.title}</h3>
        <p class="cover-author">${activeBook.author}</p>
      `;
      activeDiv.addEventListener('click', () => openDetails(activeBook, activeDiv));
    }
  }

  // 2. Library Grid (Properly Lazy Loaded)
  for (const book of books) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-cover';
    
    // Notice there is NO 'await getCoverUrl' here anymore!
    bookDiv.innerHTML = `
      <img src="https://placehold.co/150x200?text=Loading..." data-isbn="${book.isbn}" alt="${book.title}" class="cover-image lazy-cover">
      <h3 class="cover-title">${book.title}</h3>
      <p class="cover-author">${book.author}</p>
    `;
    
    bookDiv.addEventListener('click', () => openDetails(book, bookDiv));
    bookGrid.appendChild(bookDiv);
  }

  // 3. The Lazy Loader Logic
  const lazyCovers = document.querySelectorAll('.lazy-cover');
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const coverUrl = getCoverUrl(img.dataset.isbn);
        
        // Set the image source to the Open Library URL
        img.src = coverUrl;

        // Fallback: If Open Library doesn't have the cover, it sometimes returns a 1x1 pixel blank image.
        // We can listen for an error and swap back to our placeholder if it fails.
        img.onerror = () => {
          img.src = 'https://placehold.co/150x200?text=No+Cover';
        };

        observer.unobserve(img); // Stop tracking once loaded
      }
    });
  });
  
  lazyCovers.forEach(img => observer.observe(img));
}

loadBooks();

// --- FIX: Focus Mode Toggle --- //
const readerToggle = document.getElementById('reader-toggle');
if (readerToggle) {
  readerToggle.addEventListener('click', () => {
    readerToggle.classList.toggle('fullscreen-focus');
  });
}

// --- FIX: Scrolling and Navigation Logic --- //
const navItems = document.querySelectorAll('.nav-item');
const pageViews = document.querySelectorAll('.page-view');
const topFab = document.getElementById('top-fab');
const bookshelfContainer = document.querySelector('.bookshelf'); // The element that actually scrolls

// 1. Navigation Clicks
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(btn => btn.classList.remove('active'));
    item.classList.add('active');

    const targetId = item.getAttribute('data-target');
    pageViews.forEach(view => view.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');

    // Reset scroll on the bookshelf div, not the window
    if (bookshelfContainer) {
      bookshelfContainer.scrollTo({ top: 0, behavior: 'instant' });
    }
    
    if (topFab) {
      topFab.classList.remove('visible');
    }
    
    if (sheet.classList.contains('open')) {
      sheet.classList.remove('open');
    }
  });
});

// 2. FAB Scroll Listener
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
