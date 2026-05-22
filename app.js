import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://jvsjzlvabtffhsnvmcto.supabase.co';
const supabaseKey = 'sb_publishable_H2EPwvAaziQVz8T4yExdEw_bQrB5f3V';
const supabase = createClient(supabaseUrl, supabaseKey);

const bookGrid = document.getElementById('book-grid');

// Function to open and populate the bottom sheet
function openDetails(book) {
  const sheet = document.querySelector('.bottom-sheet');
  const titleEl = document.querySelector('.book-title');
  const authorEl = document.querySelector('.book-author');
  const catEl = document.querySelector('.metadata[data-field="category"]');
  const ratingEl = document.querySelector('.metadata[data-field="rating"]');

  // Update text content
  titleEl.textContent = book.title;
  authorEl.textContent = book.author;
  catEl.textContent = `Category: ${book.category || 'N/A'}`;
  ratingEl.textContent = `Rating: ${book.rating ? book.rating + ' Stars' : 'No rating'}`;

  // Slide up
  sheet.classList.add('open');
}

// Helper to fetch covers from Google Books API
async function getCoverUrl(isbn) {
  if (!isbn) return 'https://via.placeholder.com/150x200?text=No+Cover';
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await response.json();
    if (data.totalItems > 0) {
      return data.items[0].volumeInfo.imageLinks?.thumbnail || 'https://via.placeholder.com/150x200?text=No+Cover';
    }
  } catch (e) {
    console.error("Cover fetch failed", e);
  }
  return 'https://via.placeholder.com/150x200?text=No+Cover';
}

// Main function to fetch and render
async function loadBooks() {
  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching books:', error);
    return;
  }

  bookGrid.innerHTML = '';

  // Use for...of to handle the async/await inside the loop correctly
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

// Run on load
loadBooks();
