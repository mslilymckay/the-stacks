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

async function getCoverUrl(isbn) {
  if (!isbn) return 'https://placehold.co/150x200?text=No+Cover';
  const cleanIsbn = isbn.toString().replace(/[-\s]/g, '');
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
    const data = await response.json();
    if (data.totalItems > 0 && data.items[0].volumeInfo.imageLinks?.thumbnail) {
      return data.items[0].volumeInfo.imageLinks.thumbnail;
    }
  } catch (e) {
    console.error("Cover fetch failed:", e);
  }
  return 'https://placehold.co/150x200?text=No+Cover';
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
    const activeCoverUrl = await getCoverUrl(activeBook.isbn);
    const activeDiv = document.querySelector('.active-read');
    if (activeDiv) {
      activeDiv.innerHTML = `<img src="${activeCoverUrl}" alt="${activeBook.title}" class="cover-image" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px 12px 12px 4px;">`;
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
    entries.forEach(async entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const coverUrl = await getCoverUrl(img.dataset.isbn);
        img.src = coverUrl;
        observer.unobserve(img); // Stop tracking once loaded
      }
    });
  });
  
  lazyCovers.forEach(img => observer.observe(img));
}

// Back to Top FAB Logic
const topFab = document.getElementById('top-fab');
if (topFab) {
  window.addEventListener('scroll', () => {
    // If scrolled down more than 300 pixels, show the button
    if (window.scrollY > 300) {
      topFab.classList.add('visible');
    } else {
      topFab.classList.remove('visible');
    }
  });

  // Smooth scroll to top when clicked
  topFab.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}
