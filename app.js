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

function openDetails(book) {
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

  // 1. Find and inject the "Currently Reading" book (assuming status 0 is reading)
  const activeBook = books.find(b => b.status === 0) || books.find(b => b.status !== 1);
  if (activeBook) {
    const activeCoverUrl = await getCoverUrl(activeBook.isbn);
    const activeDiv = document.querySelector('.active-read');
    if (activeDiv) {
      activeDiv.innerHTML = `<img src="${activeCoverUrl}" alt="${activeBook.title}" class="cover-image" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px 12px 12px 4px;">`;
      activeDiv.addEventListener('click', () => openDetails(activeBook));
    }
  }

  // 2. Load the rest of the library grid
  for (const book of books) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-cover';
    
    const coverUrl = await getCoverUrl(book.isbn);
    
    bookDiv.innerHTML = `
      <img src="${coverUrl}" alt="${book.title}" class="cover-image">
      <h3 class="cover-title">${book.title}</h3>
      <p class="cover-author">${book.author}</p>
    `;
    
    bookDiv.addEventListener('click', () => openDetails(book));
    bookGrid.appendChild(bookDiv);
  }
}

loadBooks();
