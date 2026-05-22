import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://jvsjzlvabtffhsnvmcto.supabase.co';
const supabaseKey = 'sb_publishable_H2EPwvAaziQVz8T4yExdEw_bQrB5f3V';
const supabase = createClient(supabaseUrl, supabaseKey);

const bookGrid = document.getElementById('book-grid');

// Function to fetch and render books
async function loadBooks() {
  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .order('title', { ascending: true }); // Alphabetical order

  if (error) {
    console.error('Error fetching books:', error);
    return;
  }

  // Clear existing content
  bookGrid.innerHTML = '';

  // Generate cards
  books.forEach(book => {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-cover';
    bookDiv.innerHTML = `
      <h3 class="cover-title">${book.title}</h3>
      <p class="cover-author">${book.author}</p>
    `;
    
    // Add click event for the detail sheet (we can link this later!)
    bookDiv.addEventListener('click', () => {
      console.log('Clicked:', book.title);
      // We will trigger the bottom sheet here in the next step
    });

    bookGrid.appendChild(bookDiv);
  });
}

// Run on load
loadBooks();
